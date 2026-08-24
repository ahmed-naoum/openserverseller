/**
 * Query-string page/limit parsing for the list endpoints.
 *
 * Several routers were doing `parseInt(req.query.limit) || 20` inline, which has
 * two holes: `?limit=999999` turned into an unbounded table scan, and `?limit=abc`
 * fell through `parseInt` as NaN and reached Prisma's `take` as NaN. Both are
 * fixed here once so every list clamps the same way.
 *
 * `fallback` is the page size when the caller gives none; `max` is the ceiling a
 * caller may ask for. Neither is a cap on the endpoint's reported `total` — that
 * always comes from a separate count, so a clamped page never makes a number wrong,
 * only the number of rows in one response.
 */
export const resolvePageSize = (raw: unknown, fallback: number, max: number): number => {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return Math.min(fallback, max);
  return Math.min(parsed, max);
};

export const resolvePage = (raw: unknown): number => {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
};

/**
 * Read an entire result set in batches rather than in one flat `take`.
 *
 * For the endpoints whose caller genuinely needs everything (a CSV export, a page
 * that aggregates client-side). `hardCap` stays as an OOM backstop, and the caller
 * is expected to report when it was reached rather than letting a short answer
 * read as a complete one.
 */
export const fetchAllInBatches = async <T>(
  query: (skip: number, take: number) => Promise<T[]>,
  hardCap: number,
  batchSize = 1000,
): Promise<T[]> => {
  const rows: T[] = [];
  while (rows.length < hardCap) {
    const size = Math.min(batchSize, hardCap - rows.length);
    const batch = await query(rows.length, size);
    rows.push(...batch);
    if (batch.length < size) break;
  }
  return rows;
};
