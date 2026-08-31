import React from 'react';
import { KPI, TrendChip } from '@heroui-pro/react';
import type { LucideIcon } from 'lucide-react';

/**
 * MetricCard — KPI tile for dashboard headers.
 *
 * Wraps HeroUI Pro's <KPI> compound and applies design-taste rules:
 *   - tabular-nums on the primary value
 *   - title in muted (label-style), value in large foreground
 *   - optional trend shown as a single TrendChip (no double-representation)
 *   - icon container respects KPI's semantic status (success/warning/danger),
 *     or renders unstyled (neutral) when no status is passed
 *
 * Usage:
 *   <MetricCard
 *     label="Active campaigns"
 *     value="12"
 *     trend={{ value: '+18%', direction: 'up', hint: 'vs last week' }}
 *     icon={Briefcase}
 *   />
 */
type Direction = 'up' | 'down' | 'neutral';

interface Trend {
  value: string;
  direction: Direction;
  hint?: string;
}

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  trend?: Trend;
  icon?: LucideIcon;
  iconStatus?: 'success' | 'warning' | 'danger';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  trend,
  icon: Icon,
  iconStatus,
  className = '',
}) => (
  <KPI className={className}>
    <KPI.Header>
      <KPI.Title>{label}</KPI.Title>
      {Icon && (
        <KPI.Icon status={iconStatus}>
          <Icon size={16} />
        </KPI.Icon>
      )}
    </KPI.Header>

    <KPI.Content>
      {/* Custom value markup: KPI.Value wraps NumberValue which only accepts
          numeric values. We render the value as a styled span so callers can
          pass currency, ratios, or any composed string. */}
      <div className="text-3xl font-bold font-heading tabular-nums tracking-tight leading-none text-foreground">
        {value}
      </div>

      {trend && (
        <div className="mt-2 flex items-center gap-2">
          <TrendChip trend={trend.direction} variant="soft" size="sm">
            {trend.value}
          </TrendChip>
          {trend.hint && <span className="text-xs text-muted">{trend.hint}</span>}
        </div>
      )}
    </KPI.Content>
  </KPI>
);

export default MetricCard;
