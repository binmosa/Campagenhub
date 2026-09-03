import React from 'react';
import { KPI, TrendChip } from '@heroui-pro/react';
import type { LucideIcon } from 'lucide-react';

/**
 * MetricCard — KPI tile for dashboard headers (every role).
 *
 * Wraps HeroUI Pro's <KPI> compound and applies design-taste rules:
 *   - tabular-nums on the primary value
 *   - title in muted (label-style), value in large foreground
 *   - optional trend shown as a single TrendChip (no double-representation)
 *   - optional sparkline (the landing Stats treatment) under the value
 *   - icon container respects KPI's semantic status (success/warning/danger),
 *     or renders unstyled (neutral) when no status is passed
 *
 * Usage:
 *   <MetricCard
 *     label="Active campaigns"
 *     value="12"
 *     hint="of 18 total"
 *     series={[3, 4, 4, 6, 9, 12]}
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
  /** Muted text right after the value ("from 12", "this month"). */
  hint?: React.ReactNode;
  trend?: Trend;
  icon?: LucideIcon;
  iconStatus?: 'success' | 'warning' | 'danger';
  /** Sparkline series, oldest → newest. Needs ≥ 2 points to render. */
  series?: number[];
  /** CSS color for the sparkline. Defaults to the campaign purple chart token. */
  chartColor?: string;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  iconStatus,
  series,
  chartColor = 'var(--chart-3, #6c63ff)',
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
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="text-3xl font-bold font-heading tabular-nums tracking-tight leading-none text-foreground">
          {value}
        </div>
        {hint && <span className="text-muted text-xs">{hint}</span>}
      </div>

      {trend && (
        <div className="mt-2 flex items-center gap-2">
          <TrendChip trend={trend.direction} variant="soft" size="sm">
            {trend.value}
          </TrendChip>
          {trend.hint && <span className="text-xs text-muted">{trend.hint}</span>}
        </div>
      )}

      {series && series.length >= 2 && (
        <KPI.Chart
          data={series.map((v) => ({ v }))}
          dataKey="v"
          color={chartColor}
          fillColor={chartColor}
          height={44}
          strokeWidth={2}
        />
      )}
    </KPI.Content>
  </KPI>
);

export default MetricCard;
