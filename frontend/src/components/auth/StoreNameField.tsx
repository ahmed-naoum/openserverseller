import { useEffect, useRef, useState } from 'react';
import { Loader2, Store } from 'lucide-react';
import { authApi } from '../../lib/api';

export type StoreNameStatus = 'idle' | 'checking' | 'available' | 'invalid' | 'taken';

/**
 * The server's rejection codes, mapped to this form's translation keys — the
 * API answers in French, and the sign-up form runs in French, English and
 * Arabic.
 */
const REASON_KEY: Record<string, string> = {
  required: 'store_name_required',
  length: 'store_name_length',
  invalid: 'store_name_invalid',
  reserved: 'store_name_reserved',
  blocked: 'store_name_blocked',
  taken: 'store_name_taken',
};

const MIN = 3;
const MAX = 30;
const PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Everything typed here ends up as a hostname, so the field only ever holds
 * characters a hostname can carry. Doing it on the way IN — rather than
 * rejecting afterwards — means a seller typing "Ma Boutique" watches it become
 * `ma-boutique` instead of hitting an error they have to decode.
 *
 * A trailing hyphen survives on purpose: `ma-super-` is what "ma-super-boutique"
 * looks like halfway through being typed, and eating the separator would make
 * multi-word names impossible to enter.
 */
export function sanitizeStoreName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX);
}

/**
 * The value as it would be stored: the typing-in-progress hyphen dropped.
 * Validate, probe and submit this — never the raw field value.
 */
export function finalizeStoreName(raw: string): string {
  return sanitizeStoreName(raw).replace(/-+$/, '');
}

/** Shape check only — the same rules the backend applies, minus uniqueness. */
export function localStoreNameError(raw: string): string | null {
  const value = finalizeStoreName(raw);
  if (!value) return 'store_name_required';
  if (value.length < MIN || value.length > MAX) return 'store_name_length';
  if (!PATTERN.test(value)) return 'store_name_invalid';
  return null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Reported on every transition so the parent can gate its submit button. */
  onStatusChange?: (status: StoreNameStatus) => void;
  /** A server-side rejection for this field, rendered in place of local feedback. */
  serverError?: string | null;
  label: string;
  placeholder: string;
  hint?: string;
  /** Translator for the status keys this component emits. */
  t: (key: string) => string;
  rtl?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  name?: string;
}

/**
 * The store-name input: choose it once, at sign-up, and it becomes the
 * storefront's address. Availability is probed against the unauthenticated
 * endpoint as the user types, debounced, with every in-flight answer discarded
 * once a newer keystroke arrives — otherwise a slow response for "shop" lands
 * after a fast one for "shoppy" and marks the wrong name taken.
 */
export default function StoreNameField({
  value,
  onChange,
  onStatusChange,
  serverError,
  label,
  placeholder,
  hint,
  t,
  rtl = false,
  disabled = false,
  autoFocus = false,
  name = 'storeName',
}: Props) {
  const [status, setStatus] = useState<StoreNameStatus>('idle');
  const [message, setMessage] = useState('');
  const requestId = useRef(0);

  const domainSuffix = window.location.host.replace(/^www\./, '');

  useEffect(() => {
    onStatusChange?.(status);
  }, [status]);

  useEffect(() => {
    const settled = finalizeStoreName(value);
    const localError = localStoreNameError(value);

    if (!settled) {
      setStatus('idle');
      setMessage('');
      return;
    }

    if (localError) {
      setStatus('invalid');
      setMessage(t(localError));
      return;
    }

    setStatus('checking');
    setMessage('');

    const ticket = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const { data } = await authApi.checkStoreName(settled);
        if (ticket !== requestId.current) return;
        setStatus(data.available ? 'available' : 'taken');
        setMessage(
          data.available
            ? t('store_name_available')
            : t(REASON_KEY[data.reason] || 'store_name_taken')
        );
      } catch (err: any) {
        if (ticket !== requestId.current) return;
        // A probe that could not run is not a verdict: leave the field neutral
        // rather than blocking a legitimate name on a network hiccup. The
        // backend re-checks on submit either way.
        setStatus('idle');
        setMessage('');
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [value]);

  const shownError = serverError || (status === 'invalid' || status === 'taken' ? message : '');

  return (
    <div className="space-y-1.5">
      <label className={`text-xs font-bold text-slate-700 flex justify-between ${rtl ? 'mr-1' : 'ml-1'}`}>
        <span>
          {label} <span className="text-[#ff5722]">*</span>
        </span>
        {shownError ? (
          <span className="text-red-500 text-[10px] font-bold">{shownError}</span>
        ) : status === 'available' ? (
          <span className="text-green-500 text-[10px] font-bold">{message}</span>
        ) : null}
      </label>

      <div
        className={`relative flex items-center rounded-xl border bg-[#f8f9fa] focus-within:bg-white transition-all overflow-hidden ${
          shownError
            ? 'border-red-300 ring-4 ring-red-500/10'
            : status === 'available'
            ? 'border-emerald-300 ring-4 ring-emerald-500/10'
            : 'border-transparent focus-within:border-[#ff5722] focus-within:ring-4 focus-within:ring-[#ff5722]/10'
        }`}
      >
        <div className={`${rtl ? 'pr-4 pl-0' : 'pl-4 pr-0'} text-slate-400 flex-shrink-0`}>
          <Store size={18} />
        </div>
        <input
          type="text"
          name={name}
          dir="ltr"
          autoFocus={autoFocus}
          disabled={disabled}
          className="w-full bg-transparent py-2.5 px-3 text-[13px] text-slate-700 font-medium placeholder:text-slate-400 outline-none disabled:cursor-not-allowed disabled:opacity-60"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(sanitizeStoreName(e.target.value))}
          onBlur={() => {
            // Commit the settled form once they stop typing, so what the field
            // shows and what gets submitted are the same string.
            const settled = finalizeStoreName(value);
            if (settled !== value) onChange(settled);
          }}
        />
        <span className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 border-l border-slate-200 px-3 py-2.5 bg-slate-100/70">
          {status === 'checking' && <Loader2 size={11} className="animate-spin" />}
          <span dir="ltr">.{domainSuffix}</span>
        </span>
      </div>

      {hint && <p className={`text-[10px] text-slate-500 ${rtl ? 'mr-1' : 'ml-1'}`}>{hint}</p>}
    </div>
  );
}
