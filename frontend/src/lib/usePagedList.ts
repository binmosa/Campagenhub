import { useCallback, useEffect, useRef, useState } from 'react';
import api from './api';

/**
 * usePagedList — one server-paged list, shared by the back-office screens.
 *
 * These pages used to fetch a whole table and slice it in the browser, so
 * "Load more" only revealed rows that had already been downloaded. Here the
 * server does the filtering, the sorting and the slicing: changing a filter
 * or the search box refetches from offset 0, "Load more" appends the next
 * page, and `stats` carries whole-table figures so the KPI tiles stay true
 * while only one page is in memory.
 *
 * `params` is the filter set. Pass a stable object (useMemo) or a plain
 * literal — it is compared by value, not identity, so a literal is fine.
 */
export interface PagedState<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  /** Whole-table aggregates from the server (counts, sums) for the KPI row. */
  stats: any;
  /** First load, or a reload after the filters changed. */
  loading: boolean;
  /** A "Load more" fetch is in flight; the rows already shown stay put. */
  loadingMore: boolean;
  error: boolean;
  loadMore: () => void;
  /** Refetch page one — after an action that changes a row. */
  refresh: () => void;
}

export function usePagedList<T = any>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  pageSize = 30,
): PagedState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  // Compared by value so callers can pass a plain object literal.
  const key = JSON.stringify(params);
  // Only the newest request may write state: a slow first page must not
  // land on top of the results for a filter the user has since changed.
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (offset: number) => {
      const mine = ++requestId.current;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError(false);
      try {
        const clean = Object.fromEntries(
          Object.entries(JSON.parse(key) as Record<string, unknown>).filter(
            ([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all',
          ),
        );
        const res = await api.get(path, { params: { ...clean, limit: pageSize, offset } });
        if (mine !== requestId.current) return;
        const data = res.data || {};
        const page: T[] = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
        setItems((prev) => (offset === 0 ? page : [...prev, ...page]));
        setTotal(Number(data.total ?? page.length));
        setHasMore(!!data.hasMore);
        if (data.stats !== undefined) setStats(data.stats);
      } catch {
        if (mine !== requestId.current) return;
        setError(true);
        if (offset === 0) {
          setItems([]);
          setTotal(0);
          setHasMore(false);
        }
      } finally {
        if (mine === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [path, key, pageSize],
  );

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchPage(items.length);
  }, [fetchPage, items.length, hasMore, loadingMore]);

  const refresh = useCallback(() => fetchPage(0), [fetchPage]);

  return { items, total, hasMore, stats, loading, loadingMore, error, loadMore, refresh };
}

/**
 * Holds a value back until the user stops typing, so every keystroke in a
 * search box is not its own request.
 */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
