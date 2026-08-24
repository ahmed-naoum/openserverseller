/**
 * Reading a whole list off a paginated endpoint.
 *
 * Several pages needed "everything matching the current filter" — CSV exports, the
 * user pickers — and got it by asking for one very large page (`limit: 1000`,
 * `limit: 5000`). That silently truncated the moment the real list outgrew the
 * number, which is exactly the failure it looks like it is preventing. These
 * helpers walk pages to the end instead, and report when they stop early rather
 * than handing back a partial list that looks complete.
 */

/** Page size for the walk. Small enough to stay responsive, large enough to be few round trips. */
export const EXPORT_PAGE_SIZE = 500;

/** Ceiling on pages, so a server that never returns a short page can't loop forever. */
export const EXPORT_MAX_PAGES = 200;

export type PagedResult<T> = { rows: T[]; total: number };

/**
 * Call `load` for page 1, 2, 3 … until it returns a short page, and collect the rows.
 *
 * `complete` is false only when EXPORT_MAX_PAGES was reached with full pages still
 * coming — the caller is expected to say so out loud.
 */
export async function fetchAllPages<T>(
  load: (page: number, limit: number) => Promise<PagedResult<T>>,
  pageSize: number = EXPORT_PAGE_SIZE,
): Promise<{ rows: T[]; total: number; complete: boolean }> {
  const rows: T[] = [];
  let total = 0;

  for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
    const res = await load(page, pageSize);
    total = res.total || total;
    rows.push(...res.rows);
    if (res.rows.length < pageSize) {
      return { rows, total: total || rows.length, complete: true };
    }
  }

  return { rows, total: total || rows.length, complete: false };
}
