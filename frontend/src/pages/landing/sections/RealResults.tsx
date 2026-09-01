import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { Button, Card, Chip } from '@heroui/react';
import {
  ChartTooltip,
  LineChart,
  RadarChart,
  Widget,
} from '@heroui-pro/react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

/**
 * RealResults — "Real campaigns. Real results."
 *
 * Series-A proof section sitting between HowItWorks and ActiveCampaigns.
 * Left  (60%): interactive LineChart Widget — brand-direct vs creator-driven
 *              reach across a year. The story: creators outperform brand
 *              channels by month 6, the gap widens through Q4.
 * Right (40%): RadarChart Card — 6-axis Campaign Performance Compass with
 *              two overlaid campaigns ("Summer UGC" vs "Holiday Push").
 *
 * Both charts read chart-1 / chart-3 which we map to Creator Teal +
 * Campaign Purple inside `.landing-visitors`.
 */

const REACH_DATA = [
  { month: 'Jan', brand: 12_000, creator: 8_000 },
  { month: 'Feb', brand: 14_000, creator: 11_000 },
  { month: 'Mar', brand: 13_000, creator: 16_000 },
  { month: 'Apr', brand: 15_000, creator: 22_000 },
  { month: 'May', brand: 16_000, creator: 28_000 },
  { month: 'Jun', brand: 14_000, creator: 31_000 },
  { month: 'Jul', brand: 17_000, creator: 38_000 },
  { month: 'Aug', brand: 18_000, creator: 44_000 },
  { month: 'Sep', brand: 16_000, creator: 52_000 },
  { month: 'Oct', brand: 19_000, creator: 61_000 },
  { month: 'Nov', brand: 21_000, creator: 72_000 },
  { month: 'Dec', brand: 22_000, creator: 84_000 },
];

const COMPASS_DATA = [
  { axis: 'Reach',         summer: 88, holiday: 72 },
  { axis: 'Engagement',    summer: 92, holiday: 65 },
  { axis: 'Conversion',    summer: 76, holiday: 80 },
  { axis: 'Brand fit',     summer: 82, holiday: 90 },
  { axis: 'Cost / impr.',  summer: 78, holiday: 70 },
  { axis: 'Time to ship',  summer: 85, holiday: 60 },
];

const formatK = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;

export const RealResults: React.FC = () => {
  const { t } = useTranslation();
  return (
  <section
    id="real-results"
    className="px-6 lg:px-10 py-24 sm:py-28 v-bg-dawn-subtle"
  >
    <div className="max-w-[1100px] mx-auto">
      <div className="text-center max-w-[680px] mx-auto mb-14">
        <span className="v-pill-quiet">
          <Sparkles size={11} style={{ color: 'var(--color-campaign-purple)' }} />
          {t('results.pill')}
        </span>
        <h2 className="mt-5 v-heading-xl">
          {t('results.title')}
        </h2>
        <p className="mt-4 v-body-lg v-muted">
          {t('results.desc')}
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 lg:gap-6 items-stretch">
        {/* ── LEFT: Year-long reach LineChart ────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <Widget className="h-full">
            <Widget.Header>
              <div className="flex-1 min-w-0">
                <Widget.Title>Reach delivered, this year</Widget.Title>
                <Widget.Description>
                  Brand-direct posts vs. creators on the platform
                </Widget.Description>
              </div>
              <Widget.Legend>
                <Widget.LegendItem color="var(--chart-1)">Creator-driven</Widget.LegendItem>
                <Widget.LegendItem color="var(--chart-3)">Brand-direct</Widget.LegendItem>
              </Widget.Legend>
            </Widget.Header>
            <Widget.Content>
              <LineChart data={REACH_DATA} height={260}>
                <LineChart.Grid vertical={false} />
                <LineChart.XAxis dataKey="month" tickMargin={8} />
                <LineChart.YAxis tickFormatter={formatK} width={34} />
                <LineChart.Line
                  dataKey="creator"
                  name="Creator-driven"
                  dot={false}
                  stroke="var(--chart-1)"
                  strokeWidth={2.4}
                  type="monotone"
                />
                <LineChart.Line
                  dataKey="brand"
                  name="Brand-direct"
                  dot={false}
                  stroke="var(--chart-3)"
                  strokeWidth={2.4}
                  type="monotone"
                />
                <LineChart.Tooltip
                  content={({ active, label, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <ChartTooltip>
                        <ChartTooltip.Header>{label}</ChartTooltip.Header>
                        {payload.map((entry) => (
                          <ChartTooltip.Item key={String(entry.dataKey)}>
                            <ChartTooltip.Indicator color={entry.color ?? entry.stroke} />
                            <ChartTooltip.Label>{entry.name}</ChartTooltip.Label>
                            <ChartTooltip.Value>
                              {Number(entry.value).toLocaleString()} reach
                            </ChartTooltip.Value>
                          </ChartTooltip.Item>
                        ))}
                      </ChartTooltip>
                    );
                  }}
                />
              </LineChart>
            </Widget.Content>
            <Widget.Footer>
              <div className="flex items-center justify-between w-full flex-wrap gap-2">
                <Chip color="success" variant="soft" size="sm">
                  <ArrowUpRight size={11} />
                  Creator-driven +4.2× brand-direct YTD
                </Chip>
                <span className="v-caption v-quiet">Aggregated across 1,287 collabs</span>
              </div>
            </Widget.Footer>
          </Widget>
        </motion.div>

        {/* ── RIGHT: Campaign Performance Compass ────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="h-full">
            <Card.Header className="flex-row items-start justify-between">
              <div className="min-w-0">
                <Card.Title className="text-base">Campaign compass</Card.Title>
                <Card.Description className="text-xs">
                  6-axis ROI · two campaigns overlaid
                </Card.Description>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: 'var(--chart-1)' }} />
                  <span className="v-caption v-muted">Summer UGC</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: 'var(--chart-3)' }} />
                  <span className="v-caption v-muted">Holiday Push</span>
                </div>
              </div>
            </Card.Header>
            <Card.Content className="flex flex-col items-center">
              <RadarChart data={COMPASS_DATA} height={280}>
                <RadarChart.Grid />
                <RadarChart.AngleAxis dataKey="axis" />
                <RadarChart.Radar
                  dataKey="summer"
                  name="Summer UGC"
                  dot={{ fill: 'var(--chart-1)', r: 3, strokeWidth: 0 }}
                  fill="var(--chart-1)"
                  fillOpacity={0.20}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                />
                <RadarChart.Radar
                  dataKey="holiday"
                  name="Holiday Push"
                  dot={{ fill: 'var(--chart-3)', r: 3, strokeWidth: 0 }}
                  fill="var(--chart-3)"
                  fillOpacity={0.20}
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                />
                <RadarChart.Tooltip content={<RadarChart.TooltipContent />} />
              </RadarChart>
              <div className="w-full mt-2 grid grid-cols-2 gap-2">
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: 'rgba(0,212,199,0.08)',
                    border: '1px solid rgba(0,212,199,0.18)',
                  }}
                >
                  <div className="v-caption v-quiet">Summer UGC · ROI</div>
                  <div
                    className="mt-0.5 v-ink tabular-nums"
                    style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.016em' }}
                  >
                    3.8×
                  </div>
                </div>
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: 'rgba(108,99,255,0.08)',
                    border: '1px solid rgba(108,99,255,0.18)',
                  }}
                >
                  <div className="v-caption v-quiet">Holiday Push · ROI</div>
                  <div
                    className="mt-0.5 v-ink tabular-nums"
                    style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.016em' }}
                  >
                    2.6×
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>
        </motion.div>
      </div>

      <div className="mt-12 flex justify-center">
        <Link to="/register">
          <Button variant="primary" size="lg" className="!rounded-xl">
            {t('results.cta')} <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    </div>
  </section>
  );
};

export default RealResults;
