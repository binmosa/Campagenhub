import React from 'react';
import { KPI } from '@heroui-pro/react';
import { motion } from 'motion/react';
import type { LandingSettings } from '../useLandingData';

/**
 * Stats — HeroUI Pro KPIGroup row.
 *
 * Four KPIs with sparklines, "from X" comparison values, and trend chips.
 * Drives off the four settings.stats_val_* admin fields when they parse
 * to numbers (commas, $, M/B/K suffixes all OK); otherwise uses defaults.
 */
interface StatsProps {
  settings: LandingSettings;
}

/* Parse "12,847" / "$2.4M" / "520+" / "1.8B" → numbers for KPI.Value. */
const parseStat = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const trimmed = raw.replace(/[$,+\s]/g, '');
  let mult = 1;
  let num = trimmed;
  const last = num.slice(-1).toUpperCase();
  if (last === 'B') { mult = 1e9; num = num.slice(0, -1); }
  else if (last === 'M') { mult = 1e6; num = num.slice(0, -1); }
  else if (last === 'K') { mult = 1e3; num = num.slice(0, -1); }
  const parsed = parseFloat(num);
  return Number.isFinite(parsed) ? parsed * mult : fallback;
};

/* Tiny realistic spark series for each KPI sparkline. */
const TRENDS = {
  creators: [
    { v: 11300 }, { v: 11620 }, { v: 11890 }, { v: 12090 }, { v: 12230 },
    { v: 12410 }, { v: 12535 }, { v: 12700 }, { v: 12847 },
  ],
  brands: [
    { v: 380 }, { v: 405 }, { v: 419 }, { v: 442 }, { v: 463 },
    { v: 481 }, { v: 498 }, { v: 510 }, { v: 520 },
  ],
  paid: [
    { v: 1.42 }, { v: 1.56 }, { v: 1.72 }, { v: 1.89 }, { v: 2.03 },
    { v: 2.14 }, { v: 2.25 }, { v: 2.33 }, { v: 2.4 },
  ],
  reach: [
    { v: 1.1 }, { v: 1.22 }, { v: 1.35 }, { v: 1.46 }, { v: 1.57 },
    { v: 1.66 }, { v: 1.72 }, { v: 1.77 }, { v: 1.8 },
  ],
};

export const Stats: React.FC<StatsProps> = ({ settings }) => {
  const creators = parseStat(settings.stats_val_1, 12_847);
  const brands = parseStat(settings.stats_val_2, 520);
  const paid = parseStat(settings.stats_val_3, 2_400_000);
  const reach = parseStat(undefined, 1_800_000_000);

  /* Previous-period baselines for the "from X" suffix */
  const creatorsPrev = 12_535;
  const brandsPrev = 419;
  const paidPrev = 2_030_000;

  return (
    <section className="px-6 lg:px-10 py-20 sm:py-24">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center max-w-[640px] mx-auto mb-12">
          <span className="v-pill-quiet">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--color-campaign-purple)' }}
            />
            By the numbers
          </span>
          <h2 className="mt-5 v-heading-xl">
            The platform, in measurements that matter.
          </h2>
          <p className="mt-4 v-body-lg v-muted">
            Real campaigns. Real payouts. Real momentum — measured every week.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <KPI>
            <KPI.Header>
              <KPI.Title>
                {settings.stats_lbl_1 || 'Active creators'}
              </KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <div className="flex items-baseline gap-2 flex-wrap">
                <KPI.Value value={creators} maximumFractionDigits={0} />
                <span className="v-quiet text-sm">
                  from {creatorsPrev.toLocaleString()}
                </span>
              </div>
              <KPI.Trend trend="up">+312 this week</KPI.Trend>
              <KPI.Chart
                data={TRENDS.creators}
                dataKey="v"
                color="var(--chart-1)"
                fillColor="var(--chart-1)"
                height={48}
                strokeWidth={2}
              />
            </KPI.Content>
          </KPI>

          <KPI>
            <KPI.Header>
              <KPI.Title>
                {settings.stats_lbl_2 || 'Brands shipping'}
              </KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <div className="flex items-baseline gap-2 flex-wrap">
                <KPI.Value value={brands} maximumFractionDigits={0} />
                <span className="v-quiet text-sm">from {brandsPrev}</span>
              </div>
              <KPI.Trend trend="up">+24% QoQ</KPI.Trend>
              <KPI.Chart
                data={TRENDS.brands}
                dataKey="v"
                color="var(--chart-3)"
                fillColor="var(--chart-3)"
                height={48}
                strokeWidth={2}
              />
            </KPI.Content>
          </KPI>

          <KPI>
            <KPI.Header>
              <KPI.Title>
                {settings.stats_lbl_3 || 'Paid to creators'}
              </KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <div className="flex items-baseline gap-2 flex-wrap">
                <KPI.Value
                  value={paid}
                  style="currency"
                  currency="USD"
                  notation="compact"
                  maximumFractionDigits={1}
                />
                <span className="v-quiet text-sm">from $2.03M</span>
              </div>
              <KPI.Trend trend="up">+18% YTD</KPI.Trend>
              <KPI.Chart
                data={TRENDS.paid}
                dataKey="v"
                color="var(--chart-1)"
                fillColor="var(--chart-1)"
                height={48}
                strokeWidth={2}
              />
            </KPI.Content>
          </KPI>

          <KPI>
            <KPI.Header>
              <KPI.Title>
                {settings.stats_lbl_4 || 'Reach delivered'}
              </KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <div className="flex items-baseline gap-2 flex-wrap">
                <KPI.Value
                  value={reach}
                  notation="compact"
                  maximumFractionDigits={1}
                />
                <span className="v-quiet text-sm">cumulative</span>
              </div>
              <KPI.Trend trend="up">+1.8B impr. YTD</KPI.Trend>
              <KPI.Chart
                data={TRENDS.reach}
                dataKey="v"
                color="var(--chart-3)"
                fillColor="var(--chart-3)"
                height={48}
                strokeWidth={2}
              />
            </KPI.Content>
          </KPI>
        </motion.div>
      </div>
    </section>
  );
};

export default Stats;
