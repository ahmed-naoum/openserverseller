/**
 * Notifications — one stacked, grouped toast system for the whole platform.
 *
 * react-hot-toast stays the engine, so the ~1000 existing `toast.success(...)`
 * / `toast.error(...)` / `toast.promise(...)` calls keep working untouched. What
 * changed is the container: instead of react-hot-toast's <Toaster>, App.tsx
 * mounts <ToastStack />, which drives the store through `useToaster()` and
 * renders it the way a notification centre does:
 *
 *  - toasts pile into ONE stack (newest in front, older ones peeking behind);
 *    hovering or tapping the stack fans it out into a list
 *  - identical messages merge into a single card with a ×N counter instead of
 *    repeating down the screen
 *  - each card: tinted icon, title, optional description, optional action
 *    buttons, close on hover, swipe sideways to dismiss
 *  - timers pause while the stack is open; a “Tout effacer” pill clears it
 *
 * Rich notifications go through `notify`:
 *
 *   notify.success('Lead supprimé', {
 *     description: 'Le lead #4821 a été retiré de votre liste.',
 *     action: { label: 'Annuler', onClick: undo },
 *   });
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import toast, { resolveValue, useToaster, type Toast, type ToastOptions } from 'react-hot-toast';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { Check, X, AlertTriangle, Info, Loader2, Bell } from 'lucide-react';

export const TOAST_DURATION = 4000;

/** Cards rendered in the pile; anything older is held in the store until room frees up. */
const MAX_STACK = 5;
/** Vertical offset of each older card peeking out behind the front one (collapsed). */
const PEEK = 12;
/** Gap between cards once the stack is fanned out. */
const GAP = 10;
const WIDTH = 380;

type Kind = 'success' | 'error' | 'loading' | 'info';

const kindOf = (t: Toast): Kind =>
  t.type === 'success' || t.type === 'error' || t.type === 'loading' ? t.type : 'info';

const TONE: Record<Kind, { ring: string; icon: string }> = {
  success: { ring: 'bg-emerald-100', icon: 'text-emerald-600' },
  error: { ring: 'bg-rose-100', icon: 'text-rose-600' },
  loading: { ring: 'bg-primary-100', icon: 'text-primary-600' },
  info: { ring: 'bg-primary-100', icon: 'text-primary-600' },
};

/* ------------------------------------------------------------------ */
/* Rich message payload                                                 */
/* ------------------------------------------------------------------ */

export interface ToastAction {
  label: ReactNode;
  onClick: () => void;
  /** Keep the toast open after the click (default: dismiss). */
  keepOpen?: boolean;
  variant?: 'primary' | 'ghost';
}

export interface NotifyOptions extends ToastOptions {
  description?: ReactNode;
  action?: ToastAction;
  /** Second, secondary action. */
  secondaryAction?: ToastAction;
}

interface RichPayload {
  __rich: true;
  title: ReactNode;
  description?: ReactNode;
  action?: ToastAction;
  secondaryAction?: ToastAction;
}

const isRich = (v: unknown): v is RichPayload =>
  typeof v === 'object' && v !== null && (v as RichPayload).__rich === true;

const rich =
  (fn: (msg: any, opts?: ToastOptions) => string) =>
  (title: ReactNode, { description, action, secondaryAction, ...opts }: NotifyOptions = {}) =>
    fn(
      // The payload rides along as the "message"; the card knows how to lay it out.
      { __rich: true, title, description, action, secondaryAction } as unknown as string,
      {
        // An actionable toast deserves a little longer on screen.
        duration: action ? 7000 : undefined,
        ...opts,
      }
    );

export const notify = {
  success: rich(toast.success),
  error: rich(toast.error),
  info: rich(toast),
  loading: rich(toast.loading),
  /** Success toast with an Undo button. */
  undo: (title: ReactNode, onUndo: () => void, opts: Omit<NotifyOptions, 'action'> = {}) =>
    rich(toast.success)(title, { ...opts, action: { label: 'Annuler', onClick: onUndo } }),
  dismiss: toast.dismiss,
  /** Same toast id → the card updates in place instead of stacking. */
  promise: toast.promise,
};

export default notify;

/* ------------------------------------------------------------------ */
/* Card                                                                 */
/* ------------------------------------------------------------------ */

function KindIcon({ kind, custom }: { kind: Kind; custom?: ReactNode }) {
  if (custom != null && custom !== '') return <span className="text-base leading-none">{custom}</span>;
  switch (kind) {
    case 'success':
      return <Check size={16} strokeWidth={3} />;
    case 'error':
      return <AlertTriangle size={15} strokeWidth={2.6} />;
    case 'loading':
      return <Loader2 size={16} strokeWidth={2.6} className="animate-spin" />;
    default:
      return <Info size={16} strokeWidth={2.6} />;
  }
}

function ActionButton({ action, toastId }: { action: ToastAction; toastId: string }) {
  const primary = (action.variant ?? 'primary') === 'primary';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        action.onClick();
        if (!action.keepOpen) toast.dismiss(toastId);
      }}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors ${
        primary ? 'bg-slate-900 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
      }`}
    >
      {action.label}
    </button>
  );
}

function ToastCard({
  t,
  count,
  interactive,
  onMeasure,
}: {
  t: Toast;
  count: number;
  interactive: boolean;
  onMeasure: (id: string, height: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onMeasure(t.id, el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [t.id, onMeasure]);

  if (t.type === 'custom') {
    return <div ref={ref}>{resolveValue(t.message, t)}</div>;
  }

  const kind = kindOf(t);
  const tone = TONE[kind];
  const raw = t.message as unknown;
  const payload: RichPayload = isRich(raw)
    ? raw
    : { __rich: true, title: resolveValue(t.message, t) };
  const dismissible = kind !== 'loading';

  return (
    <div
      ref={ref}
      role={kind === 'error' ? 'alert' : 'status'}
      className="group/toast relative flex items-start gap-3 ps-4 pe-3 py-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.28),0_2px_6px_rgba(15,23,42,0.06)] text-slate-900"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className={`shrink-0 mt-px w-8 h-8 rounded-full ${tone.ring} ${tone.icon} flex items-center justify-center`}>
        <KindIcon kind={kind} custom={t.icon} />
      </div>

      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 text-[13.5px] font-bold leading-snug break-words">{payload.title}</div>
          {count > 1 && (
            <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-black tabular-nums">
              ×{count}
            </span>
          )}
        </div>
        {payload.description && (
          <div className="mt-1 text-xs font-medium text-slate-500 leading-relaxed break-words">{payload.description}</div>
        )}
        {(payload.action || payload.secondaryAction) && (
          <div className="mt-2.5 flex items-center gap-2">
            {payload.action && <ActionButton action={payload.action} toastId={t.id} />}
            {payload.secondaryAction && (
              <ActionButton action={{ variant: 'ghost', ...payload.secondaryAction }} toastId={t.id} />
            )}
          </div>
        )}
      </div>

      {dismissible && (
        <button
          type="button"
          aria-label="Fermer"
          tabIndex={interactive ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation();
            toast.dismiss(t.id);
          }}
          className="shrink-0 -me-1 -mt-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all opacity-0 group-hover/toast:opacity-100 focus-visible:opacity-100"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stack                                                                */
/* ------------------------------------------------------------------ */

export function ToastStack() {
  const { toasts, handlers } = useToaster({ duration: TOAST_DURATION });
  const reduce = !!useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [heights, setHeights] = useState<Record<string, number>>({});
  // Merge counter per toast id — a duplicate bumps the newer card's count and
  // retires the older one.
  const countsRef = useRef<Record<string, number>>({});
  const [, bump] = useState(0);

  const onMeasure = useCallback((id: string, h: number) => {
    setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  // Newest first, as the store keeps them. Dismissed toasts stay in the store
  // for a moment (react-hot-toast's removeDelay) so their exit can animate;
  // they are rendered invisible rather than unmounted straight away.
  const visible = useMemo(() => toasts.filter((t) => t.visible), [toasts]);

  // Merge identical messages (same type, same plain-string message).
  useEffect(() => {
    const seen = new Map<string, Toast>();
    let changed = false;
    for (const t of visible) {
      const key = typeof t.message === 'string' ? `${t.type}::${t.message}` : null;
      if (!key) continue;
      const newer = seen.get(key);
      if (newer) {
        const older = t;
        countsRef.current[newer.id] = (countsRef.current[newer.id] || 1) + (countsRef.current[older.id] || 1);
        delete countsRef.current[older.id];
        toast.dismiss(older.id);
        changed = true;
      } else {
        seen.set(key, t);
      }
    }
    // Forget counters of cards that are gone.
    for (const id of Object.keys(countsRef.current)) {
      if (!toasts.some((t) => t.id === id)) delete countsRef.current[id];
    }
    if (changed) bump((n) => n + 1);
  }, [visible, toasts]);

  // Collapse the moment the pile empties, so it never reopens fanned out.
  useEffect(() => {
    if (visible.length === 0 && expanded) setExpanded(false);
  }, [visible.length, expanded]);

  const shown = visible.slice(0, MAX_STACK);
  const hidden = visible.length - shown.length;
  const shownIndex = new Map(shown.map((t, i) => [t.id, i] as const));

  // Layout: y offset per visible card.
  const offsets: number[] = [];
  let acc = 0;
  shown.forEach((t, i) => {
    if (expanded) {
      offsets.push(acc);
      acc += (heights[t.id] ?? 0) + GAP;
    } else {
      offsets.push(i * PEEK);
    }
  });
  const frontHeight = shown[0] ? heights[shown[0].id] ?? 0 : 0;
  const stackHeight = expanded ? Math.max(acc - GAP, 0) : frontHeight + Math.max(shown.length - 1, 0) * PEEK;
  const showClear = expanded && visible.length > 1;
  const containerHeight = stackHeight + (showClear ? 36 : 0);

  const open = () => {
    setExpanded(true);
    handlers.startPause();
  };
  const close = () => {
    setExpanded(false);
    handlers.endPause();
  };

  const onDragEnd = (t: Toast) => (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 600) toast.dismiss(t.id);
  };

  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.9 };
  const fade = { duration: reduce ? 0 : 0.18 };

  // Everything the store holds: the visible pile plus cards on their way out.
  // Cards beyond MAX_STACK wait invisibly until room frees up.
  const rendered = toasts.filter((t) => t.visible || heights[t.id] !== undefined);

  return (
    <div
      aria-live="polite"
      className="fixed z-[9999998] pointer-events-none"
      style={{ top: 16, insetInlineEnd: 16, width: `min(${WIDTH}px, calc(100vw - 32px))` }}
    >
      <div
        className="relative pointer-events-auto"
        style={{ height: containerHeight, transition: reduce ? undefined : 'height 0.28s cubic-bezier(0.22,1,0.36,1)' }}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
        }}
      >
        {rendered.map((t) => {
          const i = shownIndex.get(t.id);
          const inPile = i !== undefined;
          const isFront = i === 0;
          const interactive = inPile && (expanded || isFront);
          const y = inPile ? offsets[i] : 0;
          return (
            <motion.div
              key={t.id}
              initial={reduce ? false : { opacity: 0, y: -18, scale: 0.95 }}
              animate={
                inPile
                  ? {
                      opacity: expanded ? 1 : i < 3 ? 1 : 0,
                      y,
                      scale: expanded ? 1 : 1 - i * 0.045,
                      transition: spring,
                    }
                  : { opacity: 0, y: -8, scale: 0.94, transition: fade }
              }
              drag={interactive ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              dragSnapToOrigin
              onDragEnd={onDragEnd(t)}
              onClick={() => !expanded && open()}
              style={{
                position: 'absolute',
                top: 0,
                insetInlineEnd: 0,
                width: '100%',
                zIndex: inPile ? shown.length - i : 0,
                transformOrigin: 'top center',
                pointerEvents: interactive ? 'auto' : 'none',
                cursor: expanded ? 'default' : 'pointer',
                // Collapsed: the cards behind take the front card's height so a
                // taller one never pokes its buttons out from underneath.
                height: inPile && !expanded && !isFront && frontHeight ? frontHeight : undefined,
                overflow: inPile && !expanded && !isFront ? 'hidden' : undefined,
                borderRadius: 16,
              }}
              aria-hidden={!interactive}
            >
              <ToastCard t={t} count={countsRef.current[t.id] || 1} interactive={interactive} onMeasure={onMeasure} />
              {/* Collapsed: veil the cards behind so only a clean edge peeks out. */}
              <motion.div
                aria-hidden
                initial={false}
                animate={{ opacity: inPile && !expanded && !isFront ? 1 : 0 }}
                transition={fade}
                className="absolute inset-0 rounded-2xl bg-white pointer-events-none"
              />
            </motion.div>
          );
        })}

        {/* Footer: count + clear all, shown once the pile is fanned out. */}
        <motion.div
          initial={false}
          animate={{ opacity: showClear ? 1 : 0, y: showClear ? stackHeight + 8 : stackHeight - 4, transition: spring }}
          className="absolute top-0 w-full flex items-center justify-between gap-2"
          style={{ insetInlineEnd: 0, pointerEvents: showClear ? 'auto' : 'none' }}
          aria-hidden={!showClear}
        >
          <span className="ps-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <Bell size={12} />
            {visible.length} notifications{hidden > 0 ? ` · +${hidden}` : ''}
          </span>
          <button
            type="button"
            tabIndex={showClear ? 0 : -1}
            onClick={() => {
              toast.dismiss();
              close();
            }}
            className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur border border-slate-200 shadow-sm text-[11px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
          >
            Tout effacer
          </button>
        </motion.div>
      </div>
    </div>
  );
}

// Dev convenience: fire any toast from the browser console (`toast.success('…')`,
// `notify.undo('…', fn)`), against the app's own react-hot-toast instance.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).toast = toast;
  (window as any).notify = notify;
}
