import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * LoadMore — the foot of a server-paged list.
 *
 * Fetches the next page when the sentinel scrolls into view, so a reader
 * who keeps scrolling never has to aim at anything; the button stays for
 * keyboard users, for anyone who reaches the end faster than the observer,
 * and as the honest signal that there is more to come. It also says how
 * many rows are left, which an infinite scroller never does.
 */
export const LoadMore: React.FC<{
  onLoadMore: () => void;
  remaining: number;
  pending?: boolean;
  /** Turn off scroll-triggered loading; the button still works. */
  manual?: boolean;
}> = ({ onLoadMore, remaining, pending = false, manual = false }) => {
  const { t } = useTranslation();
  const sentinel = useRef<HTMLDivElement | null>(null);
  // The observer must see the current handler, not the one from the render
  // that created it, or it fetches the same page forever.
  const latest = useRef(onLoadMore);
  latest.current = onLoadMore;

  useEffect(() => {
    if (manual || pending) return;
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) latest.current();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [manual, pending]);

  if (remaining <= 0) return null;

  return (
    <div className="flex flex-col items-center gap-2 mt-6">
      <div ref={sentinel} aria-hidden style={{ height: 1, width: '100%' }} />
      <button
        type="button"
        onClick={onLoadMore}
        disabled={pending}
        className="v-facet-btn !px-4 !py-2.5"
        style={pending ? { opacity: 0.6, cursor: 'progress' } : undefined}
      >
        {pending ? t('common.loading') : t('common.loadMore', { n: remaining })}
      </button>
    </div>
  );
};

/** Skeleton rows shown under the list while the next page arrives. */
export const LoadMoreSkeleton: React.FC<{ n?: number }> = ({ n = 3 }) => (
  <ul className="space-y-3 mt-3" aria-hidden>
    {Array.from({ length: n }).map((_, i) => (
      <li key={i} className="v-talent-card p-4">
        <div className="flex items-center gap-3">
          <div className="v-skel h-11 w-11 !rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="v-skel h-4 w-1/3 mb-2" />
            <div className="v-skel h-3 w-2/3" />
          </div>
          <div className="v-skel h-7 w-20 !rounded-full" />
        </div>
      </li>
    ))}
  </ul>
);
