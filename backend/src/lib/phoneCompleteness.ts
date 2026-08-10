/**
 * Is a captured checkout phone a number someone could actually dial?
 *
 * An abandoned cart stores whatever the visitor had typed at the moment they
 * left, so most of them hold a half-entered number — "0777", "180", "6533".
 * Splitting those out is what lets an agent work a queue of numbers that can
 * actually be called.
 *
 * The rule is length only: ITU-T E.164 says a dialable number carries between 8
 * and 15 digits, and anything inside that window counts as complete.
 *
 * MUST stay in sync with frontend/src/utils/phoneCompleteness.ts. The counts and
 * pagination are computed here; the page only re-runs it to label each row.
 */

export type PhoneQuality = 'complete' | 'incomplete';

// ITU-T E.164: an international number never exceeds 15 digits including the
// country code, and nothing under 8 is dialable.
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

export function phoneQuality(raw?: string | null): PhoneQuality {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS ? 'complete' : 'incomplete';
}

export const isCompletePhone = (raw?: string | null) => phoneQuality(raw) === 'complete';
