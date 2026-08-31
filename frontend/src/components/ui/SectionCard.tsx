import React from 'react';
import { Card } from '@heroui/react';

/**
 * SectionCard — surface container for grouped dashboard content.
 *
 * Wraps HeroUI's <Card> with our standard header/body slots and follows
 * the design-taste rules:
 *   - Uses Card.Header / Card.Content (no double-padding wrappers)
 *   - Title in Title Case, never ALL CAPS
 *   - Optional description capped at 2 lines via line-clamp
 *   - No extra shadow stacking (Card already has shadow-surface)
 *   - Footer is optional and sits cleanly below content (no separator
 *     unless the consumer explicitly needs one)
 *
 * Usage:
 *   <SectionCard
 *     title="Recent campaigns"
 *     description="Last 30 days"
 *     actions={<Button variant="ghost" size="sm">View all</Button>}
 *   >
 *     <CampaignTable />
 *   </SectionCard>
 *
 * This component is intended to *progressively* replace the legacy
 * `.card` utility from the v3-era index.css.
 */
interface SectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /**
   * Remove default padding from Card.Content. Use when the content needs
   * to be flush with the card edges (e.g., a full-bleed DataGrid or chart).
   */
  flushBody?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  actions,
  footer,
  children,
  className = '',
  bodyClassName = '',
  flushBody = false,
}) => (
  <Card className={className}>
    {(title || actions) && (
      <Card.Header>
        <div className="flex items-start justify-between gap-4 w-full">
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-semibold font-heading text-foreground leading-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-muted line-clamp-2">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </Card.Header>
    )}

    <Card.Content className={`${flushBody ? 'p-0' : ''} ${bodyClassName}`}>
      {children}
    </Card.Content>

    {footer && <Card.Footer>{footer}</Card.Footer>}
  </Card>
);

export default SectionCard;
