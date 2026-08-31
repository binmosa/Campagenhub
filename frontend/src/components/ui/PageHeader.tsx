import React from 'react';
import { Breadcrumbs } from '@heroui/react';
import { useNavigate } from 'react-router-dom';

/**
 * PageHeader — standard heading block at the top of every dashboard page.
 *   - optional breadcrumb (Breadcrumbs.Item, no underline per design rules)
 *   - title (font-heading, Title Case)
 *   - optional 2-line description (muted)
 *   - optional trailing action slot
 *
 * Default top spacing: pt-8 (per design-taste rule on dashboard content).
 */
export type Crumb = { label: string; href?: string };

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
  className = '',
}) => {
  const navigate = useNavigate();

  return (
    <header className={`pt-8 pb-6 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs className="mb-3">
          {breadcrumbs.map((crumb, i) => (
            <Breadcrumbs.Item
              key={`${crumb.label}-${i}`}
              onPress={crumb.href ? () => navigate(crumb.href!) : undefined}
              className="no-underline"
            >
              {crumb.label}
            </Breadcrumbs.Item>
          ))}
        </Breadcrumbs>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold font-heading text-foreground tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted max-w-2xl line-clamp-2">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};

export default PageHeader;
