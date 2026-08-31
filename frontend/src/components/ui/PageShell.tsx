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
 *   <PageShell
 *     title="Workspace"
 *     description="Manage tasks for your team."
 *     icon={<ClipboardList />}
 *     actions={<Button>New task</Button>}
 *   >
 *     <Card>…</Card>
 *   </PageShell>
 */
interface PageShellProps {
  title: string;
  description?: React.ReactNode;
  /** Optional icon rendered to the left of the title in accent color. */
  icon?: React.ReactNode;
  /** Right-aligned actions in the page header (Buttons, Chips, etc.). */
  actions?: React.ReactNode;
  /** Optional eyebrow above the title (Chip, badge, breadcrumb…). */
  eyebrow?: React.ReactNode;
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
  description,
  icon,
  actions,
  eyebrow,
  containerSize = 'default',
  children,
}) => (
  <div className={`${CONTAINER_CLASS[containerSize]} mx-auto space-y-6`}>
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
          <p className="text-muted text-sm mt-2 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {actions}
        </div>
      )}
    </header>

    {children}
  </div>
);

export default PageShell;
