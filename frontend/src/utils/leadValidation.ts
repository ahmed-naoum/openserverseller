/**
 * Validation for customer fields an agent can correct during a call.
 *
 * These values drive delivery: a malformed phone means the courier cannot reach
 * the customer, and Coliaty rejects the parcel. The API stores whatever it is
 * given, so bad input here becomes bad data downstream.
 */

/** Moroccan subscriber numbers are 9 digits and start with 5 (fixed), 6 or 7 (mobile). */
const MOROCCAN_SUBSCRIBER = /^[567]\d{8}$/;

export interface PhoneCheck {
  ok: boolean;
  /** Canonical +212XXXXXXXXX form, present only when ok. */
  e164?: string;
  reason?: string;
}

/**
 * Accepts the shapes agents actually type — `0612345678`, `+212612345678`,
 * `212612345678`, `612345678`, with spaces, dots, dashes or parentheses — and
 * returns the canonical E.164 form.
 */
export function checkMoroccanPhone(raw: string): PhoneCheck {
  const cleaned = (raw || '').replace(/[\s.\-()]/g, '');

  if (!cleaned) return { ok: false, reason: 'Le téléphone est obligatoire.' };
  if (/[^\d+]/.test(cleaned)) {
    return { ok: false, reason: 'Le téléphone ne doit contenir que des chiffres.' };
  }

  // Strip the country prefix in whichever form it was typed, then judge what is
  // left. Checking length before prefix means a wrong-length number is reported
  // as wrong-length, instead of the confusing "must start with 05/06/07".
  let subscriber: string;
  if (cleaned.startsWith('+212')) subscriber = cleaned.slice(4);
  else if (cleaned.startsWith('212')) subscriber = cleaned.slice(3);
  else if (cleaned.startsWith('0')) subscriber = cleaned.slice(1);
  else subscriber = cleaned;

  if (!/^\d+$/.test(subscriber)) {
    return { ok: false, reason: 'Format invalide. Ex : 0612345678 ou +212612345678' };
  }

  if (subscriber.length !== 9) {
    return {
      ok: false,
      reason:
        subscriber.length > 9
          ? `Numéro trop long (${subscriber.length} chiffres au lieu de 9). Ex : 0612345678`
          : `Numéro trop court (${subscriber.length} chiffres au lieu de 9). Ex : 0612345678`,
    };
  }

  if (!MOROCCAN_SUBSCRIBER.test(subscriber)) {
    return { ok: false, reason: 'Doit commencer par 05, 06 ou 07.' };
  }

  return { ok: true, e164: `+212${subscriber}` };
}

/** Display form for a stored number: +212612345678 -> 0612345678. */
export function formatMoroccanPhone(stored: string): string {
  const m = (stored || '').match(/^\+212(\d{9})$/);
  return m ? `0${m[1]}` : stored || '';
}

export function checkFullName(raw: string): { ok: boolean; reason?: string } {
  const value = (raw || '').trim();
  if (!value) return { ok: false, reason: 'Le nom est obligatoire.' };
  if (value.length < 3) return { ok: false, reason: 'Nom trop court (3 caractères minimum).' };
  if (value.length > 80) return { ok: false, reason: 'Nom trop long (80 caractères maximum).' };
  if (!/[\p{L}]/u.test(value)) return { ok: false, reason: 'Le nom doit contenir des lettres.' };
  return { ok: true };
}

export function checkAddress(raw: string): { ok: boolean; reason?: string } {
  const value = (raw || '').trim();
  if (!value) return { ok: false, reason: "L'adresse est obligatoire pour la livraison." };
  if (value.length < 5) return { ok: false, reason: 'Adresse trop courte pour une livraison.' };
  if (value.length > 200) return { ok: false, reason: 'Adresse trop longue (200 caractères maximum).' };
  return { ok: true };
}
