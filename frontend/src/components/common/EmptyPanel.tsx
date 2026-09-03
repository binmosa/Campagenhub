import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * EmptyPanel — THE "nothing here yet" widget, shared by every role.
 *
 * A dashed, gradient-washed surface with the story-ring orb from the
 * directory cards, so an empty dashboard still looks like the product
 * rather than a blank table. Three tones:
 *   - neutral: no data yet / no matches (default)
 *   - error:   the request failed (coral wash, retry action expected)
 *   - success: "all caught up" style moments
 *
 * Styles live in styles/landing-visitors.css (`.v-empty*`) so the widget
 * inherits the same palette on the public site and in the dashboard.
 */
export interface EmptyPanelProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Buttons / links rendered under the copy. */
  actions?: React.ReactNode;
  tone?: 'neutral' | 'error' | 'success';
  /** `sm` for in-card slots, `md` (default) for page-level empties. */
  size?: 'sm' | 'md';
  className?: string;
}

export const EmptyPanel: React.FC<EmptyPanelProps> = ({
  title,
  description,
  icon,
  actions,
  tone = 'neutral',
  size = 'md',
  className = '',
}) => (
  <div className={`v-empty ${className}`} data-tone={tone} data-size={size} role="status">
    <span className="v-empty-dot" style={{ left: '12%', top: '18%', width: 90, height: 90, background: '#6c63ff' }} aria-hidden />
    <span className="v-empty-dot" style={{ right: '10%', bottom: '12%', width: 110, height: 110, background: '#00d4c7' }} aria-hidden />

    <span className="v-empty-orb" aria-hidden>
      <span>{icon ?? <Inbox size={size === 'sm' ? 18 : 22} />}</span>
    </span>

    <h3 className="v-empty-title">{title}</h3>
    {description && <p className="v-empty-desc">{description}</p>}
    {actions && <div className="v-empty-actions">{actions}</div>}
  </div>
);

export default EmptyPanel;
