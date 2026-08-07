/**
 * Folds a string down to what an operator actually types: no accents, no
 * punctuation, no case. "Aït-Melloul", "ait melloul" and "aitmelloul" all have
 * to find each other — agents type fast and never reach for diacritics.
 *
 * Words stay separated by a single space so callers can still match on word
 * boundaries; compare compacted forms (spaces stripped) to ignore them.
 */
export const normalizeSearch = (raw: string): string =>
  (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
