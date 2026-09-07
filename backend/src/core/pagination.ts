/**
 * One pagination contract for every list the back office reads.
 *
 * The admin screens used to pull whole tables — every user, every payout,
 * and on the campaigns screen every application in the system just to count
 * applicants — then slice the array in the browser. That works on seed data
 * and falls over on a real one. Every paged endpoint now answers with this
 * shape, matching the public creator directory that already used it:
 *
 *   { items, total, limit, offset, hasMore }
 *
 * `total` is the count of rows matching the filters, not the page, so the
 * UI can say "30 of 4,812" and know whether to offer "Load more".
 */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PageParams {
  limit: number;
  offset: number;
  search: string;
}

/**
 * Read paging off a query string. A caller can ask for a bigger page but
 * never an unbounded one — `limit` is what stands between a back-office
 * screen and a table scan.
 */
export const readPageParams = (query: any, defaultLimit = 30, maxLimit = 100): PageParams => {
  const rawLimit = Number(query?.limit);
  const rawOffset = Number(query?.offset);
  return {
    limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxLimit) : defaultLimit,
    offset: Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0,
    search: typeof query?.search === 'string' ? query.search.trim().slice(0, 120) : '',
  };
};

export const asPage = <T>(items: T[], total: number, limit: number, offset: number): Page<T> => ({
  items,
  total,
  limit,
  offset,
  hasMore: offset + items.length < total,
});

/** `%term%` with the LIKE wildcards escaped, so a search for "100%" is literal. */
export const likeTerm = (term: string): string => `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
