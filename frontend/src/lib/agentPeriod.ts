/**
 * The period vocabulary shared by every agent-facing statistics screen.
 *
 * The dashboard and the statistics page ask the same question of the same
 * endpoints, so the presets, the two date modes and the percentage formatting
 * live here rather than being copied into both. Two copies drift: the moment one
 * screen's "Hier" closes at midnight and the other's at 23:59, the same agent
 * reads two different numbers for the same day and neither is obviously wrong.
 */

/** `datetime-local` speaks local wall-clock; `toISOString` would shift the hour. */
export const toDateTimeInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Midnight, `days` days back — the start bound of a "derniers N jours" preset. */
export const startOfDaysAgo = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return toDateTimeInput(d);
};

/**
 * 23:59 on the day `days` days back — the closing bound of a single-day preset.
 * Deliberately not the next day's 00:00: the server treats a bound given to the
 * minute as covering that whole minute, so midnight would leak the first sixty
 * seconds of the following day into the count.
 */
export const endOfDaysAgo = (days: number) => {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  d.setDate(d.getDate() - days);
  return toDateTimeInput(d);
};

/**
 * The period filter scopes every figure by *arrival* or by *action*, never by a
 * lead's last touch. An empty bound means unbounded on that side, so most presets
 * are "since X" and stay correct as the day goes on. "Hier" is the exception: it
 * needs a closing bound, otherwise it would mean yesterday *and* today.
 */
export const PERIOD_PRESETS: { key: string; label: string; range: () => { from: string; to: string } }[] = [
  { key: 'today', label: "Aujourd'hui", range: () => ({ from: startOfDaysAgo(0), to: '' }) },
  { key: 'yesterday', label: 'Hier', range: () => ({ from: startOfDaysAgo(1), to: endOfDaysAgo(1) }) },
  { key: '7d', label: '7 jours', range: () => ({ from: startOfDaysAgo(6), to: '' }) },
  { key: '30d', label: '30 jours', range: () => ({ from: startOfDaysAgo(29), to: '' }) },
  { key: 'all', label: 'Tout', range: () => ({ from: '', to: '' }) },
];

/**
 * Which timestamp the period is read against. Two different questions, and an
 * agent needs both: "what did I get through today" is the work, "how are today's
 * arrivals doing" is the intake. A status moved this morning on a lead from last
 * week belongs to the first and not to the second.
 */
export const DATE_MODES = [
  { key: 'updatedAt', label: 'Mise à jour', hint: 'Compté à la date du changement de statut' },
  { key: 'createdAt', label: 'Création', hint: "Compté à la date d'arrivée du lead" },
] as const;

export type DateMode = (typeof DATE_MODES)[number]['key'];

/**
 * How the outcome tiles count. Both readings are true and neither replaces the
 * other: an agent who rings the same number three times before giving up did
 * three NO_REPLY calls on one lead. "Par lead" files each lead once, under the
 * last thing the agent did to it, so the slices add up to the leads worked; "par
 * action" counts every status change, so they add up to the work done.
 */
export const COUNT_MODES = [
  { key: 'leads', label: 'Par lead', hint: 'Chaque lead compté une fois, sous sa dernière action' },
  { key: 'actions', label: 'Par action', hint: 'Chaque changement de statut compté' },
] as const;

export type CountMode = (typeof COUNT_MODES)[number]['key'];

/**
 * `2026-08-09T14:30` → `09/08 à 14:30`. Read straight off the string: it is
 * already the wall-clock the agent typed, and a round-trip through `Date` would
 * only add a timezone to take back out.
 */
export const fmtDateTimeInput = (value: string) => {
  const [date, time] = value.split('T');
  const [, month, day] = date.split('-');
  return time ? `${day}/${month} à ${time}` : `${day}/${month}`;
};

export const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export const fmtPct = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** Thin space every three digits, the way MAD amounts read on the invoices. */
export const fmtNum = (n: number) =>
  Math.round(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
