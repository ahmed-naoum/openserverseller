/**
 * An inclusive `createdAt` window from two optional query params, or null when
 * neither bound was given. Each bound takes a bare `YYYY-MM-DD` or a full
 * date-time (`YYYY-MM-DDTHH:mm` — what a `datetime-local` input emits), so the
 * same filter serves "ce jour" and "entre 9h et midi".
 *
 * The rounding is what makes an inclusive range read the way a user says it:
 * a bare date covers its whole day, and a bound given to the minute covers that
 * whole minute — otherwise "jusqu'à 14:30" would silently drop 14:30:45.
 *
 * Every endpoint shares this one parser on purpose. The bare-date and date-time
 * forms are parsed differently by `new Date` (UTC vs local), so two hand-rolled
 * copies drift apart and two screens end up counting different windows from the
 * same pair of inputs.
 */
export const parseDateRange = (
  dateFrom: unknown,
  dateTo: unknown
): { gte?: Date; lte?: Date } | null => {
  // A bare date is spelled out as local midnight; `new Date('2026-08-09')`
  // would be UTC midnight while `new Date('2026-08-09T08:00')` is local.
  const toDate = (value: string) => {
    const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return bare
      ? new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3]))
      : new Date(value);
  };

  const range: { gte?: Date; lte?: Date } = {};

  if (typeof dateFrom === 'string' && dateFrom.trim()) {
    const from = toDate(dateFrom.trim());
    if (!Number.isNaN(from.getTime())) range.gte = from;
  }

  if (typeof dateTo === 'string' && dateTo.trim()) {
    const raw = dateTo.trim();
    const to = toDate(raw);
    if (!Number.isNaN(to.getTime())) {
      if (!/\d{2}:\d{2}/.test(raw)) to.setHours(23, 59, 59, 999);
      else if (!/\d{2}:\d{2}:\d{2}/.test(raw)) to.setSeconds(59, 999);
      range.lte = to;
    }
  }

  return range.gte || range.lte ? range : null;
};
