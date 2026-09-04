/**
 * series — tiny helpers that turn a list of timestamped rows into the
 * sparkline arrays MetricCard renders. Shared by the role dashboards.
 */
export const WEEKS = 12;
const WEEK_MS = 7 * 86_400_000;

/** Count of rows per ISO week, oldest → newest, over the last `weeks` weeks. */
export const weekSeries = (
  rows: { created_at?: string | null }[],
  pick?: (r: any) => boolean,
  weeks: number = WEEKS,
): number[] => {
  const out = new Array(weeks).fill(0) as number[];
  const now = Date.now();
  for (const r of rows) {
    if (pick && !pick(r)) continue;
    const t = r.created_at ? new Date(r.created_at).getTime() : 0;
    if (!t) continue;
    const idx = weeks - 1 - Math.floor((now - t) / WEEK_MS);
    if (idx >= 0 && idx < weeks) out[idx]++;
  }
  return out;
};

/** Sum of `amount` per week (for money sparklines). */
export const weekSums = (
  rows: { created_at?: string | null; amount?: number | string | null }[],
  pick?: (r: any) => boolean,
  weeks: number = WEEKS,
): number[] => {
  const out = new Array(weeks).fill(0) as number[];
  const now = Date.now();
  for (const r of rows) {
    if (pick && !pick(r)) continue;
    const t = r.created_at ? new Date(r.created_at).getTime() : 0;
    if (!t) continue;
    const idx = weeks - 1 - Math.floor((now - t) / WEEK_MS);
    if (idx >= 0 && idx < weeks) out[idx] += Number(r.amount) || 0;
  }
  return out;
};

/** Rows created within the last `days` days. */
export const withinDays = (rows: { created_at?: string | null }[], days: number): number => {
  const cutoff = Date.now() - days * 86_400_000;
  return rows.filter((r) => r.created_at && new Date(r.created_at).getTime() >= cutoff).length;
};
