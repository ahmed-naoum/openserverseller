/**
 * Is a captured checkout phone a number someone could actually dial?
 *
 * An abandoned cart stores whatever the visitor had typed at the moment they
 * left, so most of them hold a half-entered number — "0777", "180", "6533".
 * Splitting those out is what lets an agent work a queue of numbers that can
 * actually be called.
 *
 * MUST stay in sync with frontend/src/utils/phoneCompleteness.ts. The counts and
 * pagination are computed here; the page only re-runs it to label each row.
 */

export type PhoneQuality = 'complete' | 'incomplete';

/** Moroccan subscriber numbers are 9 digits starting with 5 (fixed), 6 or 7 (mobile). */
const MOROCCAN_SUBSCRIBER = /^[567]\d{8}$/;

// ITU-T E.164: an international number never exceeds 15 digits including the
// country code, and nothing under 8 is dialable across a border.
const MIN_INTL_DIGITS = 8;
const MAX_INTL_DIGITS = 15;

export function phoneQuality(raw?: string | null): PhoneQuality {
  const compact = (raw || '').trim().replace(/[\s.\-()/]/g, '');
  if (!compact) return 'incomplete';

  const digits = compact.replace(/\D/g, '');
  if (!digits) return 'incomplete';

  const hasCountryCode = compact.startsWith('+') || compact.startsWith('00');
  const intlDigits = digits.startsWith('00') ? digits.slice(2) : digits;

  const carriesMoroccanCode = intlDigits.startsWith('212');
  if (carriesMoroccanCode || !hasCountryCode) {
    const subscriber = carriesMoroccanCode ? intlDigits.slice(3) : digits.replace(/^0+/, '');
    return MOROCCAN_SUBSCRIBER.test(subscriber) ? 'complete' : 'incomplete';
  }

  return intlDigits.length >= MIN_INTL_DIGITS && intlDigits.length <= MAX_INTL_DIGITS
    ? 'complete'
    : 'incomplete';
}

export const isCompletePhone = (raw?: string | null) => phoneQuality(raw) === 'complete';
