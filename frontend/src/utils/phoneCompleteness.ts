/**
 * Is a captured checkout phone a number someone could actually dial?
 *
 * An abandoned cart stores whatever the visitor had typed at the moment they
 * left, so most of them hold a half-entered number — "0777", "180", "6533".
 * Those are noise in a call queue, and separating them is the whole point of
 * this check.
 *
 * The rule is length only: ITU-T E.164 says a dialable number carries between 8
 * and 15 digits, and anything inside that window is treated as callable. No
 * country-specific prefix rule — a Moroccan-looking number and a foreign one are
 * both real customers, and an agent judges the number better than a regex does.
 *
 * MUST stay in sync with backend/src/lib/phoneCompleteness.ts — the server does
 * the same split to build the tab counts and paginate.
 */

export type PhoneQuality = 'complete' | 'incomplete';

export interface PhoneCompleteness {
  quality: PhoneQuality;
  /** Canonical +… form; only set when complete. */
  e164: string | null;
  /** Short reason, for the agent, when incomplete. */
  reason: string | null;
}

// ITU-T E.164: an international number never exceeds 15 digits including the
// country code, and nothing under 8 is dialable.
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

/** Moroccan subscriber numbers are 9 digits starting with 5 (fixed), 6 or 7 (mobile). */
const MOROCCAN_SUBSCRIBER = /^[567]\d{8}$/;

/**
 * Best-effort dial string. A number that names its country is canonicalised; a
 * bare local one is only assumed Moroccan when it has the exact shape of a
 * Moroccan subscriber number. Anything else is dialled exactly as it was typed,
 * because guessing a country code would produce a number that rings nobody.
 */
function toE164(compact: string, digits: string): string {
  if (compact.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('212')) return `+${digits}`;

  const subscriber = digits.replace(/^0+/, '');
  if (MOROCCAN_SUBSCRIBER.test(subscriber)) return `+212${subscriber}`;

  return digits;
}

export function checkPhoneCompleteness(raw?: string | null): PhoneCompleteness {
  const compact = (raw || '').trim().replace(/[\s.\-()/]/g, '');
  if (!compact) return { quality: 'incomplete', e164: null, reason: 'Aucun numéro saisi' };

  const digits = compact.replace(/\D/g, '');
  if (!digits) return { quality: 'incomplete', e164: null, reason: 'Aucun chiffre saisi' };

  const n = digits.length;
  if (n < MIN_DIGITS) {
    return { quality: 'incomplete', e164: null, reason: `Trop court — ${n} chiffres, minimum ${MIN_DIGITS}` };
  }
  if (n > MAX_DIGITS) {
    return { quality: 'incomplete', e164: null, reason: `Trop long — ${n} chiffres, maximum ${MAX_DIGITS}` };
  }

  return { quality: 'complete', e164: toE164(compact, digits), reason: null };
}

/**
 * Masks a number for display: keeps the shape and the last two digits, so an
 * agent can tell two rows apart without the number being readable or copyable.
 */
export function maskPhone(raw?: string | null): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '—';
  if (digits.length <= 2) return '•'.repeat(digits.length);
  return `${'•'.repeat(Math.max(2, digits.length - 2))}${digits.slice(-2)}`;
}
