import React from 'react';

/**
 * PageShell — single container that every dashboard page renders inside.
 *
 *   Standardizes max-width, vertical rhythm, and the title / description /
 *   actions block so every page in the authenticated app feels like one
 *   product. Use `containerSize="wide"` for table-heavy or kanban-style
 *   views and `containerSize="narrow"` for long-form reading columns; the
 *   default `"default"` covers ~95% of pages.
 *
 *   Two header treatments:
 *   - plain (default): compact title row, for utility pages.
 *   - `hero`: the landing's gradient wash band with a signature-gradient
 *     accent word and an optional KPI row — for role overviews and the
 *     directories (campaigns, talent, applications).
 *
 *   <PageShell
 *     hero
 *     title="Your"
 *     titleAccent="campaigns"
 *     description="Briefs you have posted, and who applied."
 *     icon={<Briefcase />}
 *     actions={<Button>New campaign</Button>}
 *     stats={<div className="grid …"><MetricCard … /></div>}
 *   >
 *     …
 *   </PageShell>
 */
interface PageShellProps {
  title: string;
  /** Second half of the title rendered in the signature gradient (hero only). */
  titleAccent?: string;
  description?: React.ReactNode;
  /** Optional icon rendered to the left of the title in accent color. */
  icon?: React.ReactNode;
  /** Right-aligned actions in the page header (Buttons, Chips, etc.). */
  actions?: React.ReactNode;
  /** Optional eyebrow above the title (Chip, badge, breadcrumb…). */
  eyebrow?: React.ReactNode;
  /** Gradient hero band instead of the plain header. */
  hero?: boolean;
  /** Rendered inside the hero band under the title (KPI row, quick links). */
  stats?: React.ReactNode;
  /** Container width tier. `default` = 6xl (1152px), wide = 7xl, narrow = 4xl. */
  containerSize?: 'default' | 'narrow' | 'wide';
  children: React.ReactNode;
}

const CONTAINER_CLASS: Record<NonNullable<PageShellProps['containerSize']>, string> = {
  narrow: 'max-w-4xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
};

export const PageShell: React.FC<PageShellProps> = ({
  title,
  titleAccent,
  description,
  icon,
  actions,
  eyebrow,
  hero = false,
  stats,
  containerSize = 'default',
  children,
}) => (
  <div className={`${CONTAINER_CLASS[containerSize]} mx-auto space-y-6`}>
    {hero ? (
      <div className="v-hero-band">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="mb-3">{eyebrow}</div>}
            <h1 className="v-heading-lg flex items-center gap-3 flex-wrap">
              {icon && <span className="v-hero-icon">{icon}</span>}
              <span>
                {title}
                {titleAccent && (
                  <>
                    {' '}
                    <span className="v-text-signature">{titleAccent}</span>
                  </>
                )}
              </span>
            </h1>
            {description && (
              <p className="v-body-lg v-muted mt-2 max-w-2xl">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {actions}
            </div>
          )}
        </header>
        {stats && <div className="mt-6">{stats}</div>}
      </div>
    ) : (
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="mb-2">{eyebrow}</div>}
          <h1 className="text-foreground text-2xl sm:text-[26px] font-semibold tracking-tight inline-flex items-center gap-2.5 leading-tight">
            {icon && (
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
                style={{
                  background: 'color-mix(in oklab, var(--accent) 14%, var(--surface))',
                  color: 'var(--accent)',
                }}
              >
                {icon}
              </span>
            )}
            <span className="truncate">{title}</span>
          </h1>
          {description && (
            <p className="text-muted text-sm mt-2 max-w-2xl leading-relaxed">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {actions}
          </div>
        )}
      </header>
    )}

    {children}
  </div>
);

export default PageShell;
