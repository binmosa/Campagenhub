import React from 'react';

/**
 * DashPanel — the one framed section used on every role's home page.
 *
 * Every block of an overview (recent rows, funnel bars, checklists, the
 * payout card) is a DashPanel so the two columns of the home grid read as a
 * single family: same frame, same 15px title with the purple icon, same
 * header action slot, same row anatomy (`PanelRow`) and the same compact
 * empty state (`PanelEmpty`). Panels are `flex-col` so a CSS grid row
 * stretches them to equal height and the columns stay aligned.
 */
export const DashPanel: React.FC<{
  icon: React.ReactNode;
  title: React.ReactNode;
  /** Small quiet text on the right of the title (counts, percentages). */
  meta?: React.ReactNode;
  /** Header action — usually a ghost "See all" link button. */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ icon, title, meta, action, className = '', children }) => (
  <section className={`v-talent-card v-static p-4 flex flex-col min-w-0 ${className}`}>
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="v-ink font-medium inline-flex items-center gap-2 min-w-0" style={{ fontSize: 15, letterSpacing: '-0.012em' }}>
        <span className="shrink-0 inline-flex" style={{ color: 'var(--color-campaign-purple)' }}>
          {icon}
        </span>
        <span className="truncate">{title}</span>
      </h2>
      {(meta || action) && (
        <div className="shrink-0 flex items-center gap-2">
          {meta && (
            <span className="v-caption v-quiet tabular-nums" style={{ fontSize: 11.5 }}>
              {meta}
            </span>
          )}
          {action}
        </div>
      )}
    </div>
    <div className="flex-1 min-h-0 flex flex-col">{children}</div>
  </section>
);

/** Divided list container for `PanelRow`s. */
export const PanelRows: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <ul className={`divide-y divide-border ${className}`}>{children}</ul>
);

/** One row: optional avatar/icon, title + quiet subline, trailing amount / chip / button. */
export const PanelRow: React.FC<{
  leading?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}> = ({ leading, title, sub, trailing, className = '' }) => (
  <li className={`flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 ${className}`}>
    {leading && <div className="shrink-0 inline-flex">{leading}</div>}
    <div className="min-w-0 flex-1">
      <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>
        {title}
      </div>
      {sub && (
        <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
          {sub}
        </div>
      )}
    </div>
    {trailing && <div className="shrink-0 flex items-center gap-2">{trailing}</div>}
  </li>
);

/** Compact centred empty state that keeps panel heights in step. */
export const PanelEmpty: React.FC<{
  icon: React.ReactNode;
  title: React.ReactNode;
  desc?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ icon, title, desc, action }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center py-5 px-3" role="status">
    <span className="v-hero-icon" style={{ width: 38, height: 38, borderRadius: 12 }}>
      {icon}
    </span>
    <div className="v-ink font-medium mt-2.5" style={{ fontSize: 13.5 }}>
      {title}
    </div>
    {desc && (
      <p className="v-caption v-quiet mt-1" style={{ fontSize: 12, maxWidth: '36ch' }}>
        {desc}
      </p>
    )}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

/** Row skeletons shown while a panel loads. */
export const PanelRowsSkeleton: React.FC<{ n?: number; avatar?: boolean }> = ({ n = 3, avatar = true }) => (
  <ul className="divide-y divide-border" aria-hidden>
    {Array.from({ length: n }).map((_, i) => (
      <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
        {avatar && <div className="v-skel h-9 w-9 !rounded-full shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="v-skel h-3.5 w-2/5 mb-2" />
          <div className="v-skel h-3 w-3/5" />
        </div>
        <div className="v-skel h-6 w-16 !rounded-full" />
      </li>
    ))}
  </ul>
);
