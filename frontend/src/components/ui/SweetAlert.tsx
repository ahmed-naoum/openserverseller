/**
 * SweetAlert — the one dialog style for every confirm / alert / prompt on the
 * platform.
 *
 * Two ways in:
 *
 *  1. Imperative (preferred — replaces window.confirm / alert / prompt):
 *
 *       if (await swal.danger({ title: 'Supprimer ?', text: 'Irréversible.' })) …
 *       await swal.success('Enregistré');
 *       const note = await swal.prompt({ title: 'Motif', input: { type: 'textarea' } });
 *       const r = await swal.fire({ title: '…', actions: [{ label: 'A', value: 'a' }] });
 *
 *     Backed by <SweetAlertHost />, mounted once in App.tsx. When no host is
 *     mounted (very early boot, storefront shell) the calls fall back to the
 *     native dialogs so a caller never hangs.
 *
 *  2. Declarative, for screens that keep their own state (loading flags,
 *     multi-step bodies such as an OTP form): render <SweetAlertCard /> directly.
 *     ConfirmationModal is a thin wrapper over it.
 *
 * Every dialog shares: blurred dark backdrop, spring-in white card with a
 * 28px radius, an animated icon (drawn check, drawn cross, pulsing warning…),
 * centered title + message, uniform buttons tinted by intent, an optional
 * auto-close timer bar, Escape / Enter handling and a body scroll lock.
 */
import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useAnimation, useReducedMotion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { LanguageContext } from '../../contexts/LanguageContext';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SweetAlertType = 'success' | 'error' | 'warning' | 'info' | 'question' | 'danger';

export type SweetAlertButtonVariant = 'primary' | 'danger' | 'success' | 'warning' | 'ghost';

export interface SweetAlertAction {
  label: ReactNode;
  /** Returned as `result.value` when this action is chosen. */
  value: string;
  variant?: SweetAlertButtonVariant;
  icon?: ReactNode;
  /** Runs before the dialog closes; the button shows a spinner meanwhile. A
   *  thrown error keeps the dialog open and shakes it. */
  onSelect?: () => unknown | Promise<unknown>;
}

export interface SweetAlertInput {
  type?: 'text' | 'textarea' | 'number' | 'password' | 'email' | 'tel';
  label?: ReactNode;
  placeholder?: string;
  defaultValue?: string;
  /** Return an error message to block confirmation, or null / undefined to accept. */
  validate?: (value: string) => string | null | undefined;
  /** When true (default) an empty value is refused with a generic message. */
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface SweetAlertOptions {
  type?: SweetAlertType;
  title: ReactNode;
  text?: ReactNode;
  /** Rich body rendered under the text (forms, lists…). */
  html?: ReactNode;
  /** Replaces the built-in animated icon. */
  icon?: ReactNode;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  /** Third, secondary button (SweetAlert's “deny”). Resolves with isDenied. */
  denyText?: ReactNode;
  /** Custom button set. When given, it replaces confirm / deny / cancel. */
  actions?: SweetAlertAction[];
  showCancel?: boolean;
  showClose?: boolean;
  /** Prompt input. Resolves `value` with the string entered. */
  input?: SweetAlertInput;
  /** Auto-dismiss after this many milliseconds (a progress bar counts down). */
  timer?: number;
  /** Clicking the backdrop dismisses (default true). */
  allowOutsideClick?: boolean;
  /** Escape dismisses (default true). */
  allowEscape?: boolean;
  /** Runs when confirm is pressed, before closing. The button shows a spinner;
   *  a thrown error is shown under the message and the dialog stays open. Its
   *  return value becomes `result.value` (unless an input is present). */
  onConfirm?: (value?: string) => unknown | Promise<unknown>;
  /** Which button receives focus when the dialog opens. Defaults to the cancel
   *  button for destructive dialogs, confirm otherwise. */
  focus?: 'confirm' | 'cancel' | 'none';
  /** Card width. */
  size?: 'sm' | 'md' | 'lg';
}

export type SweetAlertDismissReason = 'cancel' | 'backdrop' | 'esc' | 'close' | 'timer';

export interface SweetAlertResult<T = unknown> {
  isConfirmed: boolean;
  isDenied: boolean;
  isDismissed: boolean;
  value?: T;
  dismiss?: SweetAlertDismissReason;
}

/* ------------------------------------------------------------------ */
/* Store — the imperative queue the host renders                        */
/* ------------------------------------------------------------------ */

interface QueueEntry {
  id: number;
  options: SweetAlertOptions;
  resolve: (r: SweetAlertResult) => void;
  /** Live, host-controlled overrides (used by swal.loading().update()). */
  patch?: Partial<SweetAlertOptions> & { loading?: boolean };
}

type Listener = () => void;

let queue: QueueEntry[] = [];
let seq = 0;
const listeners = new Set<Listener>();
let hostCount = 0;

const emit = () => listeners.forEach((l) => l());

const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const hasHost = () => hostCount > 0;

function enqueue(options: SweetAlertOptions): { id: number; promise: Promise<SweetAlertResult> } {
  const id = ++seq;
  const promise = new Promise<SweetAlertResult>((resolve) => {
    queue = [...queue, { id, options, resolve }];
    emit();
  });
  return { id, promise };
}

function settle(id: number, result: SweetAlertResult) {
  const entry = queue.find((e) => e.id === id);
  if (!entry) return;
  queue = queue.filter((e) => e.id !== id);
  emit();
  entry.resolve(result);
}

function patchEntry(id: number, patch: QueueEntry['patch']) {
  const entry = queue.find((e) => e.id === id);
  if (!entry) return;
  entry.patch = { ...(entry.patch || {}), ...(patch || {}) };
  queue = [...queue];
  emit();
}

/* ------------------------------------------------------------------ */
/* Native fallbacks (no host mounted)                                   */
/* ------------------------------------------------------------------ */

const toPlain = (node: ReactNode): string => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toPlain).join('');
  return '';
};

function nativeFallback(options: SweetAlertOptions): SweetAlertResult {
  const message = [toPlain(options.title), toPlain(options.text)].filter(Boolean).join('\n\n');
  if (options.input) {
    const v = window.prompt(message, options.input.defaultValue ?? '');
    return v === null
      ? { isConfirmed: false, isDenied: false, isDismissed: true, dismiss: 'cancel' }
      : { isConfirmed: true, isDenied: false, isDismissed: false, value: v };
  }
  const twoButtons = options.showCancel !== false && !options.actions;
  if (twoButtons) {
    const ok = window.confirm(message);
    return ok
      ? { isConfirmed: true, isDenied: false, isDismissed: false }
      : { isConfirmed: false, isDenied: false, isDismissed: true, dismiss: 'cancel' };
  }
  window.alert(message);
  return { isConfirmed: true, isDenied: false, isDismissed: false };
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

type TitleOrOptions = ReactNode | SweetAlertOptions;

const isOptions = (v: TitleOrOptions): v is SweetAlertOptions =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !React.isValidElement(v) && 'title' in (v as object);

const normalize = (v: TitleOrOptions, text?: ReactNode): SweetAlertOptions =>
  isOptions(v) ? v : { title: v, text };

function fire<T = unknown>(options: SweetAlertOptions): Promise<SweetAlertResult<T>> {
  if (!hasHost()) return Promise.resolve(nativeFallback(options) as SweetAlertResult<T>);
  return enqueue(options).promise as Promise<SweetAlertResult<T>>;
}

async function confirmWith(type: SweetAlertType, v: TitleOrOptions, text?: ReactNode): Promise<boolean> {
  const opts = normalize(v, text);
  const r = await fire({ type, showCancel: true, ...opts });
  return r.isConfirmed;
}

async function notifyWith(type: SweetAlertType, v: TitleOrOptions, text?: ReactNode): Promise<void> {
  const opts = normalize(v, text);
  await fire({ type, showCancel: false, ...opts });
}

export interface SweetAlertLoadingHandle {
  /** Change title / text while still loading. */
  update: (patch: Partial<Pick<SweetAlertOptions, 'title' | 'text' | 'html'>>) => void;
  /** Close silently. */
  close: () => void;
  /** Swap to a success dialog (auto-closes after `timer`, default 1800 ms). */
  success: (v: TitleOrOptions, text?: ReactNode) => Promise<void>;
  /** Swap to an error dialog with an OK button. */
  error: (v: TitleOrOptions, text?: ReactNode) => Promise<void>;
}

function loading(v: TitleOrOptions = 'Un instant…', text?: ReactNode): SweetAlertLoadingHandle {
  const opts = normalize(v, text);
  if (!hasHost()) {
    return {
      update: () => {},
      close: () => {},
      success: async (s, t) => notifyWith('success', s, t),
      error: async (s, t) => notifyWith('error', s, t),
    };
  }
  const { id } = enqueue({
    type: 'info',
    showCancel: false,
    showClose: false,
    allowOutsideClick: false,
    allowEscape: false,
    actions: [],
    ...opts,
  });
  patchEntry(id, { loading: true });

  const swapTo = (type: SweetAlertType, s: TitleOrOptions, t?: ReactNode, extra: Partial<SweetAlertOptions> = {}) => {
    const next = normalize(s, t);
    const entry = queue.find((e) => e.id === id);
    if (!entry) return notifyWith(type, next);
    // Rebuild the entry so the host re-reads a fresh option set.
    entry.options = {
      type,
      showCancel: false,
      showClose: true,
      allowOutsideClick: true,
      allowEscape: true,
      ...extra,
      ...next,
    };
    entry.patch = { loading: false };
    queue = [...queue];
    emit();
    return new Promise<void>((resolve) => {
      const original = entry.resolve;
      entry.resolve = (r) => {
        original(r);
        resolve();
      };
    });
  };

  return {
    update: (patch) => patchEntry(id, patch),
    close: () => settle(id, { isConfirmed: false, isDenied: false, isDismissed: true, dismiss: 'close' }),
    success: (s, t) => swapTo('success', s, t, { timer: 1800 }),
    error: (s, t) => swapTo('error', s, t),
  };
}

export const swal = {
  fire,
  /** Two-button question. Resolves true when confirmed. */
  confirm: (v: TitleOrOptions, text?: ReactNode) => confirmWith('question', v, text),
  /** Two-button destructive confirm (rose). Cancel gets focus by default. */
  danger: (v: TitleOrOptions, text?: ReactNode) => confirmWith('danger', v, text),
  /** Two-button cautionary confirm (amber). */
  warn: (v: TitleOrOptions, text?: ReactNode) => confirmWith('warning', v, text),
  success: (v: TitleOrOptions, text?: ReactNode) => notifyWith('success', v, text),
  error: (v: TitleOrOptions, text?: ReactNode) => notifyWith('error', v, text),
  warning: (v: TitleOrOptions, text?: ReactNode) => notifyWith('warning', v, text),
  info: (v: TitleOrOptions, text?: ReactNode) => notifyWith('info', v, text),
  /** Text prompt. Resolves the string, or null when dismissed. */
  prompt: async (options: Omit<SweetAlertOptions, 'input'> & { input?: SweetAlertInput }): Promise<string | null> => {
    const r = await fire<string>({ type: 'question', showCancel: true, ...options, input: options.input ?? { type: 'text' } });
    return r.isConfirmed ? (r.value ?? '') : null;
  },
  loading,
  /** Dismiss every open dialog. */
  close: () => {
    const pending = queue;
    queue = [];
    emit();
    pending.forEach((e) => e.resolve({ isConfirmed: false, isDenied: false, isDismissed: true, dismiss: 'close' }));
  },
  isOpen: () => queue.length > 0,
};

export default swal;

// Dev convenience: try any dialog from the browser console (`swal.danger('…')`).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).swal = swal;
}

/* ------------------------------------------------------------------ */
/* Theme                                                                */
/* ------------------------------------------------------------------ */

interface Tone {
  ring: string; // icon ring bg
  icon: string; // icon stroke color
  glow: string; // soft blob behind the icon
  bar: string; // timer bar
  button: SweetAlertButtonVariant;
}

const TONES: Record<SweetAlertType, Tone> = {
  success: { ring: 'bg-emerald-50', icon: 'text-emerald-500', glow: 'from-emerald-200/70', bar: 'bg-emerald-500', button: 'success' },
  error: { ring: 'bg-rose-50', icon: 'text-rose-500', glow: 'from-rose-200/70', bar: 'bg-rose-500', button: 'danger' },
  danger: { ring: 'bg-rose-50', icon: 'text-rose-500', glow: 'from-rose-200/70', bar: 'bg-rose-500', button: 'danger' },
  warning: { ring: 'bg-amber-50', icon: 'text-amber-500', glow: 'from-amber-200/70', bar: 'bg-amber-500', button: 'warning' },
  info: { ring: 'bg-primary-50', icon: 'text-primary-500', glow: 'from-primary-200/70', bar: 'bg-primary-500', button: 'primary' },
  question: { ring: 'bg-primary-50', icon: 'text-primary-500', glow: 'from-primary-200/70', bar: 'bg-primary-500', button: 'primary' },
};

const BUTTON: Record<SweetAlertButtonVariant, string> = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/25 focus-visible:ring-primary-300',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/25 focus-visible:ring-rose-300',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 focus-visible:ring-emerald-300',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25 focus-visible:ring-amber-300',
  ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-600 focus-visible:ring-slate-300',
};

const SIZES = { sm: 'max-w-sm', md: 'max-w-[440px]', lg: 'max-w-xl' } as const;

/* ------------------------------------------------------------------ */
/* Animated icons                                                       */
/* ------------------------------------------------------------------ */

const draw = (delay: number, reduce: boolean) =>
  reduce
    ? { initial: { pathLength: 1, opacity: 1 }, animate: { pathLength: 1, opacity: 1 } }
    : {
        initial: { pathLength: 0, opacity: 0 },
        animate: { pathLength: 1, opacity: 1 },
        transition: { delay, duration: 0.45, ease: 'easeOut' as const },
      };

function AlertIcon({ type, reduce }: { type: SweetAlertType; reduce: boolean }) {
  const common = {
    width: 36,
    height: 36,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (type) {
    case 'success':
      return (
        <svg {...common}>
          <motion.path d="M4.5 12.5l4.5 4.5L19.5 6.5" {...draw(0.25, reduce)} />
        </svg>
      );
    case 'error':
      return (
        <svg {...common}>
          <motion.path d="M6 6l12 12" {...draw(0.25, reduce)} />
          <motion.path d="M18 6L6 18" {...draw(0.4, reduce)} />
        </svg>
      );
    case 'danger':
      return (
        <svg {...common}>
          <motion.path d="M4 7h16" {...draw(0.25, reduce)} />
          <motion.path d="M10 11v6M14 11v6" {...draw(0.4, reduce)} />
          <motion.path d="M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" {...draw(0.3, reduce)} />
        </svg>
      );
    case 'warning':
      return (
        <svg {...common}>
          <motion.path d="M12 3l9.5 16.5H2.5L12 3z" {...draw(0.2, reduce)} />
          <motion.path d="M12 9v4.5" {...draw(0.45, reduce)} />
          <motion.path d="M12 17h.01" {...draw(0.6, reduce)} />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <motion.circle cx="12" cy="12" r="9" {...draw(0.2, reduce)} />
          <motion.path d="M12 11v5" {...draw(0.45, reduce)} />
          <motion.path d="M12 8h.01" {...draw(0.6, reduce)} />
        </svg>
      );
    case 'question':
    default:
      return (
        <svg {...common}>
          <motion.circle cx="12" cy="12" r="9" {...draw(0.2, reduce)} />
          <motion.path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 3.5" {...draw(0.45, reduce)} />
          <motion.path d="M12 17h.01" {...draw(0.65, reduce)} />
        </svg>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Labels — optional i18n                                               */
/* ------------------------------------------------------------------ */

function useSwalLabels() {
  const ctx = useContext(LanguageContext);
  return useMemo(() => {
    const t = ctx?.t;
    return {
      confirm: t ? t('confirm', 'dashboard', 'Confirmer') : 'Confirmer',
      cancel: t ? t('cancel', 'dashboard', 'Annuler') : 'Annuler',
      ok: t ? t('ok', 'dashboard', 'OK') : 'OK',
      required: t ? t('swal_required', 'dashboard', 'Ce champ est obligatoire.') : 'Ce champ est obligatoire.',
      failed: t ? t('swal_failed', 'dashboard', "L'opération a échoué. Réessayez.") : "L'opération a échoué. Réessayez.",
      close: t ? t('close', 'dashboard', 'Fermer') : 'Fermer',
    };
  }, [ctx]);
}

/* ------------------------------------------------------------------ */
/* Card                                                                 */
/* ------------------------------------------------------------------ */

export interface SweetAlertCardProps extends Omit<SweetAlertOptions, 'onConfirm'> {
  open: boolean;
  /** Called with the input value (if any). May be async: the confirm button
   *  spins until it settles and a throw keeps the dialog open. */
  onConfirm?: (value?: string) => unknown | Promise<unknown>;
  onDeny?: () => void;
  onCancel?: (reason: SweetAlertDismissReason) => void;
  onAction?: (action: SweetAlertAction) => void;
  /** Externally controlled busy state (spinner on confirm, other controls locked). */
  loading?: boolean;
  confirmDisabled?: boolean;
  /** Extra classes on the card. */
  className?: string;
  /** Render into document.body (default true). */
  portal?: boolean;
  children?: ReactNode;
}

export function SweetAlertCard(props: SweetAlertCardProps) {
  const {
    open,
    type = 'question',
    title,
    text,
    html,
    icon,
    confirmText,
    cancelText,
    denyText,
    actions,
    showCancel = true,
    showClose,
    input,
    timer,
    allowOutsideClick = true,
    allowEscape = true,
    onConfirm,
    onDeny,
    onCancel,
    onAction,
    focus,
    size = 'md',
    loading = false,
    confirmDisabled = false,
    className = '',
    portal = true,
    children,
  } = props;

  const labels = useSwalLabels();
  const reduce = !!useReducedMotion();
  const titleId = useId();
  const descId = useId();

  const [value, setValue] = useState(input?.defaultValue ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // which button is running
  const shakeCtrl = useAnimation();
  const cardRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  const tone = TONES[type];
  const isBusy = loading || busy !== null;
  const isDestructive = type === 'danger' || type === 'error';

  // Reset per open.
  useEffect(() => {
    if (open) {
      setValue(input?.defaultValue ?? '');
      setError(null);
      setBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus management + scroll lock.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const target = focus ?? (input ? 'input' : isDestructive ? 'cancel' : 'confirm');
    const raf = requestAnimationFrame(() => {
      if (target === 'input') inputRef.current?.focus();
      else if (target === 'cancel') (cancelRef.current ?? confirmRef.current)?.focus();
      else if (target === 'confirm') (confirmRef.current ?? cancelRef.current)?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      const el = previouslyFocused.current as HTMLElement | null;
      if (el && typeof el.focus === 'function') el.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dismiss = useCallback(
    (reason: SweetAlertDismissReason) => {
      if (isBusy && reason !== 'timer') return;
      onCancel?.(reason);
    },
    [isBusy, onCancel]
  );

  const fail = (message?: string) => {
    setError(message || labels.failed);
    if (!reduce) shakeCtrl.start({ x: [0, -10, 10, -7, 7, -3, 3, 0], transition: { duration: 0.45 } });
  };

  const runConfirm = async () => {
    if (isBusy || confirmDisabled) return;
    if (input) {
      const v = value;
      if ((input.required ?? true) && !v.trim()) return fail(labels.required);
      const problem = input.validate?.(v);
      if (problem) return fail(problem);
    }
    if (!onConfirm) return;
    try {
      setBusy('confirm');
      setError(null);
      await onConfirm(input ? value : undefined);
    } catch (err: any) {
      fail(err?.response?.data?.message || err?.message);
    } finally {
      setBusy(null);
    }
  };

  const runAction = async (a: SweetAlertAction) => {
    if (isBusy) return;
    try {
      setBusy(a.value);
      setError(null);
      if (a.onSelect) await a.onSelect();
      onAction?.(a);
    } catch (err: any) {
      fail(err?.response?.data?.message || err?.message);
    } finally {
      setBusy(null);
    }
  };

  // Keyboard.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (allowEscape) {
          e.preventDefault();
          dismiss('esc');
        }
        return;
      }
      if (e.key === 'Enter') {
        const el = document.activeElement as HTMLElement | null;
        if (el?.tagName === 'TEXTAREA') return;
        if (el?.tagName === 'BUTTON' || el?.tagName === 'A') return; // let the focused button act
        if (actions && actions.length) return; // ambiguous
        e.preventDefault();
        runConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allowEscape, dismiss, value, isBusy, confirmDisabled, actions]);

  // Timer.
  useEffect(() => {
    if (!open || !timer) return;
    const id = window.setTimeout(() => onCancel?.('timer'), timer);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, timer]);

  const okOnly = showCancel === false && !denyText && (!actions || actions.length === 0);
  const confirmLabel = confirmText ?? (okOnly ? labels.ok : labels.confirm);
  const cancelLabel = cancelText ?? labels.cancel;

  const spring = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 22, stiffness: 320, mass: 0.9 };

  const content = (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 sm:p-6"
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22 }}
            onClick={() => allowOutsideClick && dismiss('backdrop')}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.82, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12, transition: { duration: reduce ? 0 : 0.18 } }}
            transition={spring}
            className={`relative w-full ${SIZES[size]} z-10`}
          >
          <motion.div
            ref={cardRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={text ? descId : undefined}
            animate={shakeCtrl}
            className={`relative w-full bg-white rounded-[28px] shadow-[0_40px_90px_-24px_rgba(15,23,42,0.45)] border border-white/70 overflow-hidden ${className}`}
            dir={typeof document !== 'undefined' ? document.documentElement.getAttribute('dir') || undefined : undefined}
          >
            {/* Glow */}
            <div
              className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-gradient-to-b ${tone.glow} to-transparent blur-2xl opacity-80`}
            />

            {showClose && (
              <button
                type="button"
                aria-label={labels.close}
                onClick={() => dismiss('close')}
                disabled={isBusy}
                className="absolute top-4 end-4 z-10 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <X size={16} />
              </button>
            )}

            <div className="relative px-6 pt-8 pb-2 sm:px-8 text-center">
              {/* Icon */}
              <motion.div
                initial={reduce ? false : { scale: 0.4, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ ...spring, delay: reduce ? 0 : 0.08 }}
                className={`relative mx-auto mb-5 w-[76px] h-[76px] rounded-full ${tone.ring} ${tone.icon} flex items-center justify-center`}
              >
                {/* Pulse ring */}
                {!reduce && (
                  <motion.span
                    aria-hidden
                    initial={{ scale: 0.7, opacity: 0.55 }}
                    animate={{ scale: 1.45, opacity: 0 }}
                    transition={{ duration: 1.1, delay: 0.2, ease: 'easeOut', repeat: type === 'warning' || type === 'danger' ? Infinity : 0, repeatDelay: 0.6 }}
                    className={`absolute inset-0 rounded-full border-2 ${tone.icon.replace('text-', 'border-')}`}
                  />
                )}
                {loading || (busy && !actions?.length && !onConfirm) ? (
                  <Loader2 size={34} className="animate-spin" />
                ) : icon ? (
                  icon
                ) : (
                  <AlertIcon type={type} reduce={reduce} />
                )}
              </motion.div>

              <motion.h2
                id={titleId}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : 0.14, duration: 0.3 }}
                className="text-xl font-black text-slate-900 tracking-tight leading-snug"
              >
                {title}
              </motion.h2>

              {text != null && text !== '' && (
                <motion.p
                  id={descId}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 0.2, duration: 0.3 }}
                  className="mt-2.5 text-sm text-slate-500 font-medium leading-relaxed whitespace-pre-line"
                >
                  {text}
                </motion.p>
              )}

              {(html || children) && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 0.24, duration: 0.3 }}
                  className="mt-4 text-start"
                >
                  {html}
                  {children}
                </motion.div>
              )}

              {input && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 0.24, duration: 0.3 }}
                  className="mt-5 text-start"
                >
                  {input.label && (
                    <label className="block mb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                      {input.label}
                    </label>
                  )}
                  {input.type === 'textarea' ? (
                    <textarea
                      ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value);
                        setError(null);
                      }}
                      placeholder={input.placeholder}
                      maxLength={input.maxLength}
                      rows={3}
                      disabled={isBusy}
                      className={`w-full px-4 py-3 rounded-2xl bg-slate-50 border-2 text-sm font-semibold text-slate-800 outline-none transition-all resize-none focus:bg-white ${
                        error ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-primary-400 focus:ring-4 focus:ring-primary-100'
                      }`}
                    />
                  ) : (
                    <input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      type={input.type ?? 'text'}
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value);
                        setError(null);
                      }}
                      placeholder={input.placeholder}
                      min={input.min}
                      max={input.max}
                      maxLength={input.maxLength}
                      disabled={isBusy}
                      className={`w-full px-4 py-3 rounded-2xl bg-slate-50 border-2 text-sm font-semibold text-slate-800 outline-none transition-all focus:bg-white ${
                        error ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-primary-400 focus:ring-4 focus:ring-primary-100'
                      }`}
                    />
                  )}
                </motion.div>
              )}

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    role="alert"
                    className="mt-3 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 text-start"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Buttons */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.28, duration: 0.3 }}
              className="px-6 pb-6 pt-4 sm:px-8 flex flex-col-reverse sm:flex-row gap-3"
            >
              {actions && actions.length > 0 ? (
                actions.map((a) => (
                  <ActionButton
                    key={a.value}
                    variant={a.variant ?? 'primary'}
                    busy={busy === a.value}
                    disabled={isBusy}
                    onClick={() => runAction(a)}
                  >
                    {a.icon}
                    {a.label}
                  </ActionButton>
                ))
              ) : actions && actions.length === 0 ? null : (
                <>
                  {showCancel && (
                    <ActionButton ref={cancelRef} variant="ghost" disabled={isBusy} onClick={() => dismiss('cancel')}>
                      {cancelLabel}
                    </ActionButton>
                  )}
                  {denyText && (
                    <ActionButton variant="ghost" disabled={isBusy} onClick={() => !isBusy && onDeny?.()}>
                      {denyText}
                    </ActionButton>
                  )}
                  <ActionButton
                    ref={confirmRef}
                    variant={tone.button}
                    busy={busy === 'confirm' || loading}
                    disabled={isBusy || confirmDisabled}
                    onClick={runConfirm}
                  >
                    {confirmLabel}
                  </ActionButton>
                </>
              )}
            </motion.div>

            {/* Timer bar */}
            {timer && !reduce ? (
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: timer / 1000, ease: 'linear' }}
                style={{ originX: 0 }}
                className={`absolute bottom-0 left-0 right-0 h-1 ${tone.bar} opacity-70`}
              />
            ) : null}
          </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!portal || typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}

const ActionButton = React.forwardRef<
  HTMLButtonElement,
  {
    variant: SweetAlertButtonVariant;
    busy?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
  }
>(function ActionButton({ variant, busy, disabled, onClick, children }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={disabled ? undefined : { scale: 0.96 }}
      whileHover={disabled ? undefined : { y: -1 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 min-h-[46px] px-5 py-3 rounded-2xl text-sm font-black tracking-tight flex items-center justify-center gap-2 transition-colors outline-none focus-visible:ring-4 disabled:opacity-60 disabled:cursor-not-allowed ${BUTTON[variant]}`}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </motion.button>
  );
});

/* ------------------------------------------------------------------ */
/* Host — renders the imperative queue                                  */
/* ------------------------------------------------------------------ */

export function SweetAlertHost() {
  const [, force] = useState(0);

  useEffect(() => {
    hostCount += 1;
    const unsub = subscribe(() => force((n) => n + 1));
    return () => {
      hostCount -= 1;
      unsub();
    };
  }, []);

  const current = queue[0];
  if (!current) return <SweetAlertCard open={false} title="" />;

  const { id, options, patch } = current;
  const merged: SweetAlertOptions = { ...options, ...(patch || {}) };
  const isLoading = !!patch?.loading;

  return (
    <SweetAlertCard
      key={id}
      open
      {...merged}
      loading={isLoading}
      allowOutsideClick={isLoading ? false : merged.allowOutsideClick}
      allowEscape={isLoading ? false : merged.allowEscape}
      showClose={isLoading ? false : merged.showClose}
      onConfirm={async (value) => {
        const out = options.onConfirm ? await options.onConfirm(value) : undefined;
        settle(id, {
          isConfirmed: true,
          isDenied: false,
          isDismissed: false,
          value: options.input ? value : out,
        });
      }}
      onDeny={() => settle(id, { isConfirmed: false, isDenied: true, isDismissed: false })}
      onCancel={(reason) => settle(id, { isConfirmed: false, isDenied: false, isDismissed: true, dismiss: reason })}
      onAction={(a) => settle(id, { isConfirmed: true, isDenied: false, isDismissed: false, value: a.value })}
    />
  );
}
