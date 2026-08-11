/**
 * Analytics primitives for the lead pages.
 *
 * The lead pages used to derive their charts inline, and each one got the same
 * three things wrong: days with no leads were dropped from the trend instead of
 * plotted as zero, `yyyy-MM-dd` keys were round-tripped through `new Date()`
 * (which parses them as UTC and shifts the label a day for anyone west of
 * Greenwich), and city names were grouped on a string the data does not agree
 * on — "AGADIR", "Agadir" and "Agadir, Morocco" counted as three cities.
 *
 * These helpers are the single answer to all three. They take rows and give
 * back chart-ready data; they know nothing about which page is asking.
 */

// ---------------------------------------------------------------------------
// Local-day arithmetic
//
// Everything here works in the VIEWER's timezone. A Moroccan seller asking for
// "today" means their today, and the row timestamps arrive as UTC ISO strings,
// so every bucket boundary has to be built from local getters rather than from
// `toISOString()` or from parsing a bare date string.
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-08-11` for the local day `d` falls on. Never use toISOString() for this. */
export const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Parse the `yyyy-MM-dd` an `<input type="date">` produces as LOCAL midnight.
 * `new Date('2026-08-11')` is UTC midnight, which is the 10th at 23:00 for
 * anyone behind UTC — a custom range that silently dropped a day.
 */
export const parseLocalDay = (value: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

export const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfLocalDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfLocalDay(b).getTime() - startOfLocalDay(a).getTime()) / 86_400_000);

// ---------------------------------------------------------------------------
// Zero-filled time series
// ---------------------------------------------------------------------------

export type Granularity = 'day' | 'week' | 'month';

/** Monday-based week start, month start, or the day itself. */
export const bucketStart = (d: Date, g: Granularity): Date => {
  if (g === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  const x = startOfLocalDay(d);
  if (g === 'week') x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

const nextBucket = (d: Date, g: Granularity): Date => {
  if (g === 'month') return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (g === 'week' ? 7 : 1));
};

/**
 * Daily up to ~2 months, then weekly, then monthly. A line chart with 900 daily
 * points is both unreadable and slow to render, and "Tous" on a two-year-old
 * account is exactly that.
 */
export const pickGranularity = (spanDays: number): Granularity =>
  spanDays <= 62 ? 'day' : spanDays <= 400 ? 'week' : 'month';

export type SeriesPoint = { key: string; date: Date } & Record<string, any>;

export type TimeSeries = {
  points: SeriesPoint[];
  granularity: Granularity;
  /** Buckets that held no rows at all — the ones the old chart silently dropped. */
  emptyBuckets: number;
};

/**
 * Bucket `rows` over a contiguous, gap-free timeline.
 *
 * `series` maps an output field name to a predicate; every bucket carries a
 * count for each, zero included. That gap-free part is the whole point: the
 * previous chart only emitted buckets that had data, so Recharts spaced a
 * ten-day silence exactly like a one-day one and drew a trend that never
 * happened.
 *
 * `from`/`to` pin the timeline to the range the user actually selected, so a
 * filter that returns two leads still renders the whole window rather than two
 * points touching the edges of the card.
 */
export function buildTimeSeries<T>(
  rows: T[],
  getDate: (row: T) => Date,
  series: Record<string, (row: T) => boolean>,
  opts: { from?: Date | null; to?: Date | null; maxBuckets?: number } = {}
): TimeSeries {
  const keys = Object.keys(series);
  const dated: Array<{ row: T; time: number }> = [];
  for (const row of rows) {
    const d = getDate(row);
    const time = d?.getTime?.();
    if (typeof time === 'number' && !Number.isNaN(time)) dated.push({ row, time });
  }

  // Reduce rather than Math.min(...arr): a few thousand leads spread as
  // arguments overflows the call stack.
  let min = opts.from ? opts.from.getTime() : Infinity;
  let max = opts.to ? opts.to.getTime() : -Infinity;
  if (!opts.from || !opts.to) {
    for (const { time } of dated) {
      if (!opts.from && time < min) min = time;
      if (!opts.to && time > max) max = time;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { points: [], granularity: 'day', emptyBuckets: 0 };
  }
  if (max < min) max = min;

  const from = new Date(min);
  const to = new Date(max);
  let granularity = pickGranularity(daysBetween(from, to) + 1);

  // Hard ceiling regardless of granularity, so a row with a corrupt far-future
  // timestamp cannot ask us to allocate a million buckets.
  const maxBuckets = opts.maxBuckets ?? 400;

  const counts = new Map<string, Record<string, number>>();
  const blank = () => {
    const o: Record<string, number> = { total: 0 };
    for (const k of keys) o[k] = 0;
    return o;
  };

  for (const { row, time } of dated) {
    const bucket = localDayKey(bucketStart(new Date(time), granularity));
    let entry = counts.get(bucket);
    if (!entry) { entry = blank(); counts.set(bucket, entry); }
    entry.total += 1;
    for (const k of keys) if (series[k](row)) entry[k] += 1;
  }

  const points: SeriesPoint[] = [];
  let cursor = bucketStart(from, granularity);
  const last = bucketStart(to, granularity);
  let emptyBuckets = 0;
  while (cursor.getTime() <= last.getTime() && points.length < maxBuckets) {
    const key = localDayKey(cursor);
    const entry = counts.get(key);
    if (!entry) emptyBuckets += 1;
    points.push({ key, date: new Date(cursor), ...(entry || blank()) });
    cursor = nextBucket(cursor, granularity);
  }

  return { points, granularity, emptyBuckets };
}

// ---------------------------------------------------------------------------
// City grouping
// ---------------------------------------------------------------------------

/**
 * Arabic letter forms that carry no distinction for a city name: the alef
 * variants, the two ways of writing a final ya, and the ta marbuta. Without
 * this "طنجة" and "طنجه" are two cities.
 */
const arabicFold = (s: string) =>
  s
    .replace(/[ً-ْٰـ]/g, '') // harakat, dagger alef, tatweel
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ -> ا
    .replace(/ى/g, 'ي') // ى -> ي
    .replace(/ة/g, 'ه'); // ة -> ه

/**
 * The key two spellings of the same city must share.
 *
 * Strips Latin accents, folds Arabic letter forms, drops a trailing country
 * ("Agadir, Morocco"), reduces punctuation to spaces and collapses whitespace.
 */
export const cityKey = (raw?: string | null): string => {
  const base = (raw ?? '').trim();
  if (!base) return '';
  return arabicFold(
    base
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // Latin combining accents
      // Only a trailing country, never an inner comma: "Sidi Ali, Ben Hamdouche"
      // is one place name and must keep both halves.
      .replace(/[,،]\s*(morocco|maroc|المغرب)\s*$/i, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ')
  );
};

/**
 * Canonical display label per key. Two jobs: give the accent-stripped key its
 * proper French spelling back ("fes" -> "Fès"), and put the Arabic spellings of
 * the big cities in the same bucket as the Latin ones — on a Moroccan COD book
 * Casablanca arrives in both scripts and splitting it hides the top market.
 *
 * Keys here are already cityKey()-normalised. Anything absent falls through to
 * title case, which is the safe default for the long tail of small towns.
 */
const CITY_LABELS: Record<string, string> = {
  // Latin spellings that lose their accents in the key
  'casablanca': 'Casablanca',
  'casa': 'Casablanca',
  'fes': 'Fès',
  'meknes': 'Meknès',
  'sale': 'Salé',
  'temara': 'Témara',
  'tetouan': 'Tétouan',
  'kenitra': 'Kénitra',
  'laayoune': 'Laâyoune',
  'beni mellal': 'Béni Mellal',
  'benimellal': 'Béni Mellal',
  'mohammedia': 'Mohammedia',
  'marrakech': 'Marrakech',
  'marrakesh': 'Marrakech',
  'tanger': 'Tanger',
  'tangier': 'Tanger',
  'agadir': 'Agadir',
  'rabat': 'Rabat',
  'oujda': 'Oujda',
  'nador': 'Nador',
  'settat': 'Settat',
  'safi': 'Safi',
  'el jadida': 'El Jadida',
  'essaouira': 'Essaouira',
  'khouribga': 'Khouribga',
  'berrechid': 'Berrechid',
  'taza': 'Taza',
  'al hoceima': 'Al Hoceima',
  'taroudant': 'Taroudant',
  'ouarzazate': 'Ouarzazate',

  // Arabic spellings of the same cities, post-fold
  'الدار البيضاء': 'Casablanca',
  'كازا': 'Casablanca',
  'كازابلانكا': 'Casablanca',
  'الرباط': 'Rabat',
  'مراكش': 'Marrakech',
  'فاس': 'Fès',
  'مكناس': 'Meknès',
  'طنجه': 'Tanger',
  'اكادير': 'Agadir',
  'سلا': 'Salé',
  'وجده': 'Oujda',
  'العيون': 'Laâyoune',
  'الناضور': 'Nador',
  'الناظور': 'Nador',
  'سطات': 'Settat',
  'القنيطره': 'Kénitra',
  'تطوان': 'Tétouan',
  'الجديده': 'El Jadida',
  'بني ملال': 'Béni Mellal',
  'خريبكه': 'Khouribga',
  'اسفي': 'Safi',
  'المحمديه': 'Mohammedia',
  'تارودانت': 'Taroudant',
  'ورزازات': 'Ouarzazate',
  'الصويره': 'Essaouira',
  'برشيد': 'Berrechid',
  'تازه': 'Taza',
  'الحسيمه': 'Al Hoceima',
  'طاطا': 'Tata',
  'الوليديه': 'Oualidia',
  'الولديه': 'Oualidia',
  'جديده': 'El Jadida',
};

const titleCase = (key: string) =>
  key.split(' ').map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');

export const cityLabel = (raw?: string | null, unknownLabel = 'Inconnue'): string => {
  const key = cityKey(raw);
  if (!key) return unknownLabel;
  return CITY_LABELS[key] || titleCase(key);
};

export type CityBucket = { name: string; value: number; isOther?: boolean };

/**
 * Group rows by normalised city, biggest first.
 *
 * Returns the FULL list; use `withOtherBucket` to cut it down for a chart. The
 * two are separate because the donut needs the top slice list while the header
 * needs the true number of distinct cities, and reading the latter off a
 * truncated array is how the old card came to label 10 as the city count.
 */
export function groupByCity<T>(
  rows: T[],
  getCity: (row: T) => string | null | undefined,
  unknownLabel = 'Inconnue'
): CityBucket[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = cityLabel(getCity(row), unknownLabel);
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

/**
 * Top `n` plus an "other" slice carrying the rest.
 *
 * A donut whose slices add up to a quarter of the data still LOOKS like a whole,
 * so the remainder has to be on it rather than dropped.
 */
export function withOtherBucket(
  buckets: CityBucket[],
  n: number,
  otherLabel = 'Autres'
): CityBucket[] {
  if (buckets.length <= n) return buckets;
  const head = buckets.slice(0, n);
  const rest = buckets.slice(n).reduce((sum, b) => sum + b.value, 0);
  return rest > 0 ? [...head, { name: otherLabel, value: rest, isOther: true }] : head;
}

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Percentage that renders as `-` rather than `NaN%` when nothing was counted. */
export const rate = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? (numerator / denominator) * 100 : null;

export const formatRate = (value: number | null, digits = 1) =>
  value === null ? '—' : `${value.toFixed(digits)}%`;

/** Median of a numeric list, or null when empty. Used for the delay stats. */
export const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** "2 j 4 h" / "5 h 30" / "12 min" — a delay a seller can read at a glance. */
export const formatDuration = (hours: number | null): string => {
  if (hours === null || !Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m ? `${h} h ${pad(m)}` : `${h} h`;
  }
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours - days * 24);
  return rem ? `${days} j ${rem} h` : `${days} j`;
};
