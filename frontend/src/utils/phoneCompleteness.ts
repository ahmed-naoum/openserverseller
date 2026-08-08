/**
 * Is a captured checkout phone a number someone could actually dial?
 *
 * An abandoned cart stores whatever the visitor had typed at the moment they
 * left, so most of them hold a half-entered number — "0777", "180", "6533".
 * Those are noise in a call queue, and separating them is the whole point of
 * this check.
 *
 * Not a full E.164 registry. Morocco's rule is applied strictly (the business is
 * Moroccan COD, and a wrong local number is a wasted call), while anything that
 * carries an explicit country code is judged against the ITU length envelope so
 * foreign customers are not thrown away.
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

/** Moroccan subscriber numbers are 9 digits starting with 5 (fixed), 6 or 7 (mobile). */
const MOROCCAN_SUBSCRIBER = /^[567]\d{8}$/;

// ITU-T E.164: an international number never exceeds 15 digits including the
// country code, and nothing under 8 is dialable across a border.
const MIN_INTL_DIGITS = 8;
const MAX_INTL_DIGITS = 15;

export function checkPhoneCompleteness(raw?: string | null): PhoneCompleteness {
  const compact = (raw || '').trim().replace(/[\s.\-()/]/g, '');
  if (!compact) return { quality: 'incomplete', e164: null, reason: 'Aucun numéro saisi' };

  const digits = compact.replace(/\D/g, '');
  if (!digits) return { quality: 'incomplete', e164: null, reason: 'Aucun chiffre saisi' };

  const hasCountryCode = compact.startsWith('+') || compact.startsWith('00');
  // Digits after the international access prefix: country code + subscriber.
  const intlDigits = digits.startsWith('00') ? digits.slice(2) : digits;

  // Moroccan either because it carries the 212 country code, or because it was
  // typed bare — with no country code at all, a local number is what it is.
  const carriesMoroccanCode = intlDigits.startsWith('212');
  if (carriesMoroccanCode || !hasCountryCode) {
    const subscriber = carriesMoroccanCode ? intlDigits.slice(3) : digits.replace(/^0+/, '');

    if (MOROCCAN_SUBSCRIBER.test(subscriber)) {
      return { quality: 'complete', e164: `+212${subscriber}`, reason: null };
    }

    const n = subscriber.length;
    return {
      quality: 'incomplete',
      e164: null,
      reason:
        n === 0 ? 'Aucun chiffre saisi'
        : n < 9 ? `Trop court — ${n}/9 chiffres`
        : n > 9 ? `Trop long — ${n}/9 chiffres`
        : 'Doit commencer par 05, 06 ou 07',
    };
  }

  // Explicit country code, anywhere in the world.
  if (intlDigits.length >= MIN_INTL_DIGITS && intlDigits.length <= MAX_INTL_DIGITS) {
    return { quality: 'complete', e164: `+${intlDigits}`, reason: null };
  }
  return {
    quality: 'incomplete',
    e164: null,
    reason:
      intlDigits.length < MIN_INTL_DIGITS
        ? `Trop court — ${intlDigits.length} chiffres`
        : `Trop long — ${intlDigits.length} chiffres`,
  };
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
