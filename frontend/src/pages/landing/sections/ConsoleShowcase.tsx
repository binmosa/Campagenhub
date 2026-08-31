import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Hash,
  Heart,
  MessageCircle,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { RadarChart, Segment } from '@heroui-pro/react';
import { AnimatePresence, motion } from 'motion/react';

/**
 * ConsoleShowcase — the interactive product console, now its own section.
 *
 * The hero belongs to creators; this section is where brands and managers
 * see the machinery: a live tabbed console (Overview / Campaigns / Creators /
 * Insights / Payouts) rendered as a real, clickable preview.
 */

type TabKey = 'overview' | 'campaigns' | 'creators' | 'insights' | 'payouts';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'creators', label: 'Creators' },
  { key: 'insights', label: 'Insights' },
  { key: 'payouts', label: 'Payouts' },
];

const TINY_CHART = [
  10, 14, 12, 18, 22, 19, 24, 28, 26, 32, 38, 35, 42, 48, 46, 54, 60, 58, 65, 72,
];

const BRAND = {
  purple: '#6c63ff',
  teal: '#00d4c7',
  blue: '#4f7cff',
  navy: '#0b1736',
  success: '#16c784',
  warning: '#ffb547',
  error: '#ff5a5f',
  lavender: '#f4f2ff',
  cool: '#e9edf5',
};

const SIGNATURE_BAR = `linear-gradient(180deg, ${BRAND.purple} 0%, ${BRAND.blue} 60%, ${BRAND.teal} 100%)`;

/* ── Reusable shells ────────────────────────────────────────────── */
const Pane: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    className="px-4 sm:px-6 pt-5 pb-6"
  >
    {children}
  </motion.div>
);

/* ── Sparkline (used in Overview) ───────────────────────────────── */
const ConsoleSparkline: React.FC<{ values?: number[] }> = ({ values = TINY_CHART }) => {
  const width = 460;
  const height = 120;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const step = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / (max - min)) * (height - 12) - 6;
    return [x, y] as const;
  });

  const pathD = points
    .map(([x, y], i) =>
      i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`
    )
    .join(' ');
  const areaD = `${pathD} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[120px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="v-console-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BRAND.purple} stopOpacity="0.28" />
          <stop offset="100%" stopColor={BRAND.teal} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="v-console-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={BRAND.purple} />
          <stop offset="50%" stopColor={BRAND.blue} />
          <stop offset="100%" stopColor={BRAND.teal} />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} y1={height * g} x2={width} y2={height * g} stroke="#eef0f6" strokeWidth={1} />
      ))}
      <motion.path
        d={areaD}
        fill="url(#v-console-area)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
      <motion.path
        d={pathD}
        fill="none"
        stroke="url(#v-console-line)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={4} fill={BRAND.success} />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={8} fill={BRAND.success} fillOpacity={0.18} />
    </svg>
  );
};

/* ── OVERVIEW PANE ──────────────────────────────────────────────── */
const OverviewPane: React.FC = () => {
  const [range, setRange] = useState<'7D' | '30D' | '90D'>('7D');
  const rangeValues: Record<typeof range, number[]> = {
    '7D': TINY_CHART,
    '30D': [4, 8, 6, 12, 10, 16, 14, 18, 22, 19, 25, 28, 24, 30, 34, 30, 38, 42, 40, 48],
    '90D': [2, 5, 3, 7, 6, 9, 8, 12, 14, 11, 16, 20, 18, 24, 28, 26, 33, 38, 36, 44],
  };

  return (
    <Pane>
      <div className="grid grid-cols-12 gap-3 sm:gap-4">
        <div className="col-span-12 sm:col-span-4 v-hairline rounded-2xl p-4">
          <div className="v-caption v-quiet">Reach this week</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="v-ink font-medium tabular-nums" style={{ fontSize: 28, letterSpacing: '-0.018em' }}>
              1.24M
            </span>
            <Chip color="success" variant="soft" size="sm">
              <TrendingUp size={11} /> +24%
            </Chip>
          </div>
          <div className="mt-3 h-[28px] flex items-end gap-[3px]">
            {TINY_CHART.slice(0, 14).map((v, i) => (
              <motion.span
                key={i}
                className="flex-1 rounded-sm"
                initial={{ height: 0 }}
                animate={{ height: `${(v / 72) * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  background:
                    i === 13 ? SIGNATURE_BAR : 'rgba(108,99,255,0.28)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="col-span-12 sm:col-span-4 v-hairline rounded-2xl p-4">
          <div className="v-caption v-quiet">Active campaigns</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="v-ink font-medium tabular-nums" style={{ fontSize: 28, letterSpacing: '-0.018em' }}>
              248
            </span>
            <Chip color="success" variant="soft" size="sm">
              <TrendingUp size={11} /> +12
            </Chip>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {[BRAND.purple, BRAND.success, BRAND.warning, BRAND.error, BRAND.blue].map((c, i) => (
              <span
                key={i}
                className="h-7 w-7 rounded-full border-2"
                style={{ background: c, borderColor: '#fff', marginLeft: i === 0 ? 0 : -8 }}
              />
            ))}
            <span className="v-caption v-quiet ml-2">+ 22 brands</span>
          </div>
        </div>

        <div className="col-span-12 sm:col-span-4 v-hairline rounded-2xl p-4">
          <div className="v-caption v-quiet">Paid to creators</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="v-ink font-medium tabular-nums" style={{ fontSize: 28, letterSpacing: '-0.018em' }}>
              $2.4M
            </span>
            <Chip color="success" variant="soft" size="sm">
              <TrendingUp size={11} /> +18%
            </Chip>
          </div>
          <div className="mt-3 v-caption v-muted">Settled across 1,287 collabs · YTD</div>
        </div>

        <div className="col-span-12 v-hairline rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div>
              <div className="v-caption v-quiet">Engagement trend</div>
              <div className="v-ink font-medium" style={{ fontSize: 18, letterSpacing: '-0.018em' }}>
                24.7% avg ER
              </div>
            </div>
            <Segment
              selectedKey={range}
              onSelectionChange={(k) => setRange(k as typeof range)}
              size="sm"
            >
              <Segment.Item id="7D">7D</Segment.Item>
              <Segment.Item id="30D">30D</Segment.Item>
              <Segment.Item id="90D">90D</Segment.Item>
            </Segment>
          </div>
          <ConsoleSparkline key={range} values={rangeValues[range]} />
        </div>
      </div>
    </Pane>
  );
};

/* ── CAMPAIGNS PANE ─────────────────────────────────────────────── */
const CAMPAIGN_ROWS = [
  { brand: 'Glow Athletic', title: 'Summer fitness UGC challenge', platform: 'TikTok', budget: '$8.5k', applicants: 147, status: 'Live' as const, color: BRAND.purple },
  { brand: 'Aurora Skin', title: 'Reels: golden-hour routine', platform: 'Instagram', budget: '$4.2k', applicants: 89, status: 'Live' as const, color: BRAND.error },
  { brand: 'Nomad Audio', title: 'Long-form unboxing review', platform: 'YouTube', budget: '$12k', applicants: 64, status: 'Live' as const, color: BRAND.blue },
  { brand: 'Mesa Coffee', title: 'Morning ritual photo set', platform: 'Instagram', budget: '$3.6k', applicants: 38, status: 'Review' as const, color: BRAND.warning },
  { brand: 'Hyperloop Snacks', title: 'Gen-Z mealtime POV', platform: 'TikTok', budget: '$6.0k', applicants: 112, status: 'Live' as const, color: BRAND.teal },
];

const CampaignsPane: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'live' | 'review'>('all');
  const rows = CAMPAIGN_ROWS.filter(
    (r) => filter === 'all' || r.status.toLowerCase() === filter
  );

  return (
    <Pane>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Segment
            selectedKey={filter}
            onSelectionChange={(k) => setFilter(k as 'all' | 'live' | 'review')}
            size="sm"
          >
            <Segment.Item id="all">All</Segment.Item>
            <Segment.Item id="live">Live</Segment.Item>
            <Segment.Item id="review">Review</Segment.Item>
          </Segment>
          <span className="v-caption v-quiet">{rows.length} shown</span>
        </div>
        <Button size="sm" variant="primary" className="!rounded-lg">
          + New brief
        </Button>
      </div>

      <div className="v-hairline rounded-2xl overflow-hidden">
        <div
          className="hidden sm:grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.7fr] gap-3 px-4 py-2.5 v-caption v-quiet"
          style={{ background: 'rgba(244,242,255,0.5)', borderBottom: '1px solid var(--color-cool-gray)' }}
        >
          <span>Campaign</span>
          <span>Platform</span>
          <span className="text-right">Budget</span>
          <span className="text-right">Applicants</span>
          <span className="text-right">Status</span>
        </div>
        <AnimatePresence mode="popLayout">
          {rows.map((row, i) => (
            <motion.div
              key={row.title}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.24, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.7fr] gap-3 px-4 py-3 items-center"
              style={{ borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--color-cool-gray)' }}
            >
              <div className="min-w-0 flex items-center gap-2.5">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-medium shrink-0"
                  style={{ background: row.color, color: '#fff', fontSize: 11 }}
                >
                  {row.brand.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="v-body font-medium v-ink truncate" style={{ fontSize: 13 }}>
                    {row.title}
                  </div>
                  <div className="v-caption v-quiet truncate">{row.brand}</div>
                </div>
              </div>
              <div className="v-caption v-muted">{row.platform}</div>
              <div className="v-body v-ink tabular-nums text-right font-medium" style={{ fontSize: 13 }}>
                {row.budget}
              </div>
              <div className="v-caption v-muted tabular-nums text-right">{row.applicants}</div>
              <div className="flex justify-end">
                <Chip color={row.status === 'Live' ? 'success' : 'accent'} variant="soft" size="sm">
                  {row.status}
                </Chip>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Pane>
  );
};

/* ── CREATORS PANE ──────────────────────────────────────────────── */
const CREATOR_ROWS = [
  { handle: '@linaeats', niche: 'Food · Lifestyle', followers: '2.5M', er: '4.8%', fit: 96, color: BRAND.purple },
  { handle: '@omarjourneys', niche: 'Travel', followers: '880K', er: '5.1%', fit: 91, color: BRAND.teal },
  { handle: '@code.with.ada', niche: 'Tech · Career', followers: '410K', er: '6.4%', fit: 88, color: BRAND.warning },
  { handle: '@studioveda', niche: 'Beauty', followers: '1.1M', er: '3.9%', fit: 84, color: BRAND.error },
];

const CreatorsPane: React.FC = () => (
  <Pane>
    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
      <span className="v-pill-quiet">
        <Users size={11} style={{ color: BRAND.purple }} />
        12,847 creators · ranked by fit
      </span>
      <Button size="sm" variant="outline" className="!rounded-lg">
        <Hash size={12} /> Filter by niche
      </Button>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {CREATOR_ROWS.map((c, i) => (
        <motion.div
          key={c.handle}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="v-hairline rounded-2xl p-4 flex items-center gap-3"
        >
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-full font-medium shrink-0"
            style={{ background: c.color, color: '#fff', fontSize: 13 }}
          >
            {c.handle.slice(1, 3).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="v-body font-medium v-ink truncate" style={{ fontSize: 14 }}>
                {c.handle}
              </span>
              <CheckCircle2 size={12} style={{ color: BRAND.purple }} />
            </div>
            <div className="v-caption v-quiet truncate">{c.niche}</div>
            <div className="mt-1.5 flex items-center gap-3 v-caption v-muted">
              <span>{c.followers} followers</span>
              <span style={{ color: BRAND.success }}>{c.er} ER</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="v-caption font-medium tabular-nums" style={{ color: BRAND.purple }}>
              {c.fit}% fit
            </div>
            <div
              className="mt-1 h-1 w-16 rounded-full overflow-hidden"
              style={{ background: 'var(--color-cool-gray)' }}
            >
              <motion.div
                className="h-1 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${c.fit}%` }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: `linear-gradient(90deg, ${BRAND.purple}, ${BRAND.teal})` }}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  </Pane>
);

/* ── INSIGHTS PANE — Campaign Comparison Compass ───────────────── */
const COMPASS_DATA = [
  { axis: 'Reach',         summer: 88, holiday: 72 },
  { axis: 'Engagement',    summer: 92, holiday: 65 },
  { axis: 'Conversion',    summer: 76, holiday: 80 },
  { axis: 'Brand fit',     summer: 82, holiday: 90 },
  { axis: 'Cost / impr.',  summer: 78, holiday: 70 },
  { axis: 'Time to ship',  summer: 85, holiday: 60 },
];

const InsightsPane: React.FC = () => {
  const totals = [
    { label: 'Impressions', value: '8.4M', delta: '+12%', icon: TrendingUp },
    { label: 'Engagements', value: '612K', delta: '+18%', icon: Heart },
    { label: 'Comments', value: '94K', delta: '+9%', icon: MessageCircle },
  ];
  return (
    <Pane>
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
        {totals.map((t, i) => {
          const Icon = t.icon;
          return (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="v-hairline rounded-2xl p-4"
            >
              <div className="flex items-center justify-between">
                <span className="v-caption v-quiet">{t.label}</span>
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: BRAND.lavender, color: BRAND.purple }}
                >
                  <Icon size={12} />
                </span>
              </div>
              <div
                className="mt-1.5 v-ink font-medium tabular-nums"
                style={{ fontSize: 22, letterSpacing: '-0.018em' }}
              >
                {t.value}
              </div>
              <Chip color="success" variant="soft" size="sm" className="!mt-1">
                <ArrowUpRight size={11} />
                {t.delta} vs last month
              </Chip>
            </motion.div>
          );
        })}
      </div>

      <div className="v-hairline rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="v-caption v-quiet">Campaign comparison · 6-axis compass</div>
            <div className="v-ink font-medium" style={{ fontSize: 17, letterSpacing: '-0.018em' }}>
              Summer UGC outscores Holiday Push on reach + speed
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: BRAND.teal }} />
              <span className="v-caption v-muted">Summer UGC</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: BRAND.purple }} />
              <span className="v-caption v-muted">Holiday Push</span>
            </div>
          </div>
        </div>
        <div className="flex justify-center">
          <RadarChart data={COMPASS_DATA} height={280}>
            <RadarChart.Grid />
            <RadarChart.AngleAxis dataKey="axis" />
            <RadarChart.Radar
              dataKey="summer"
              name="Summer UGC"
              dot={{ fill: 'var(--chart-1)', r: 3, strokeWidth: 0 }}
              fill="var(--chart-1)"
              fillOpacity={0.18}
              stroke="var(--chart-1)"
              strokeWidth={2}
            />
            <RadarChart.Radar
              dataKey="holiday"
              name="Holiday Push"
              dot={{ fill: 'var(--chart-3)', r: 3, strokeWidth: 0 }}
              fill="var(--chart-3)"
              fillOpacity={0.18}
              stroke="var(--chart-3)"
              strokeWidth={2}
            />
            <RadarChart.Tooltip content={<RadarChart.TooltipContent />} />
          </RadarChart>
        </div>
      </div>
    </Pane>
  );
};

/* ── PAYOUTS PANE ───────────────────────────────────────────────── */
const PAYOUT_ROWS = [
  { to: '@omarjourneys', campaign: 'Nomad Audio · YT review', amount: '$1,250', when: '2m ago', status: 'Settled' as const, color: BRAND.success },
  { to: '@linaeats', campaign: 'Glow Athletic · TikTok UGC', amount: '$2,400', when: '14m ago', status: 'Settled' as const, color: BRAND.purple },
  { to: '@studioveda', campaign: 'Aurora Skin · Reels', amount: '$880', when: '1h ago', status: 'Pending' as const, color: BRAND.warning },
  { to: '@code.with.ada', campaign: 'Hyperloop · POV', amount: '$1,650', when: '3h ago', status: 'Escrow' as const, color: BRAND.teal },
];

const STATUS_COLOR: Record<'Settled' | 'Pending' | 'Escrow', 'success' | 'warning' | 'accent'> = {
  Settled: 'success',
  Pending: 'warning',
  Escrow: 'accent',
};

const PayoutsPane: React.FC = () => (
  <Pane>
    <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
      {[
        { label: 'Paid today', value: '$18,420', helper: '42 settlements', icon: DollarSign },
        { label: 'In escrow', value: '$54,900', helper: 'held until ship', icon: Clock },
        { label: 'YTD payouts', value: '$2.4M', helper: '+18%', icon: TrendingUp, success: true },
      ].map((t, i) => {
        const Icon = t.icon;
        return (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="v-hairline rounded-2xl p-4"
          >
            <div className="flex items-center justify-between">
              <span className="v-caption v-quiet">{t.label}</span>
              <Icon size={14} style={{ color: t.success ? BRAND.success : BRAND.purple }} />
            </div>
            <div
              className="mt-1.5 v-ink font-medium tabular-nums"
              style={{ fontSize: 22, letterSpacing: '-0.018em' }}
            >
              {t.value}
            </div>
            <div className="mt-1 v-caption v-muted">{t.helper}</div>
          </motion.div>
        );
      })}
    </div>

    <div className="v-hairline rounded-2xl overflow-hidden">
      <div
        className="hidden sm:grid grid-cols-[1.4fr_1.4fr_0.8fr_0.7fr_0.7fr] gap-3 px-4 py-2.5 v-caption v-quiet"
        style={{ background: 'rgba(244,242,255,0.5)', borderBottom: '1px solid var(--color-cool-gray)' }}
      >
        <span>Creator</span>
        <span>Campaign</span>
        <span className="text-right">Amount</span>
        <span className="text-right">When</span>
        <span className="text-right">Status</span>
      </div>
      {PAYOUT_ROWS.map((r, i) => (
        <motion.div
          key={r.to + i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: i * 0.04 }}
          className="grid grid-cols-[1.4fr_1.4fr_0.8fr_0.7fr_0.7fr] gap-3 px-4 py-3 items-center"
          style={{ borderBottom: i === PAYOUT_ROWS.length - 1 ? 'none' : '1px solid var(--color-cool-gray)' }}
        >
          <div className="min-w-0 flex items-center gap-2.5">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full font-medium shrink-0"
              style={{ background: r.color, color: '#fff', fontSize: 11 }}
            >
              {r.to.slice(1, 3).toUpperCase()}
            </span>
            <span className="v-body v-ink truncate font-medium" style={{ fontSize: 13 }}>
              {r.to}
            </span>
          </div>
          <div className="v-caption v-muted truncate">{r.campaign}</div>
          <div className="v-body v-ink tabular-nums text-right font-medium" style={{ fontSize: 13 }}>
            {r.amount}
          </div>
          <div className="v-caption v-quiet text-right">{r.when}</div>
          <div className="flex justify-end">
            <Chip color={STATUS_COLOR[r.status]} variant="soft" size="sm">
              {r.status}
            </Chip>
          </div>
        </motion.div>
      ))}
    </div>
  </Pane>
);

/* ── Tab body switcher ──────────────────────────────────────────── */
const TAB_BODIES: Record<TabKey, React.FC> = {
  overview: OverviewPane,
  campaigns: CampaignsPane,
  creators: CreatorsPane,
  insights: InsightsPane,
  payouts: PayoutsPane,
};

/* ── Section ────────────────────────────────────────────────────── */
export const ConsoleShowcase: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('overview');
  const ActiveBody = TAB_BODIES[tab];

  return (
    <section id="console" className="relative">
      {/* Header */}
      <div className="px-6 lg:px-10 pt-20 sm:pt-24 pb-10 text-center">
        <div className="v-badge-new">For brands + managers</div>
        <h2 className="mt-5 v-heading-xl mx-auto" style={{ maxWidth: 640 }}>
          One console runs the whole collab
        </h2>
        <p className="mt-4 v-body-lg v-muted mx-auto" style={{ maxWidth: 560 }}>
          Post the brief, match the creators, watch the numbers, settle the payouts.
          Click around — this preview is live.
        </p>
        <div className="mt-7 flex items-center justify-center gap-2 flex-wrap">
          <Link to="/register?role=brand">
            <Button variant="primary" size="lg" className="!rounded-xl">
              Launch a campaign
            </Button>
          </Link>
          <Link to="/talent">
            <Button variant="ghost" size="lg" className="!rounded-xl">
              Browse creator talent <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </div>

      {/* Atmospheric gradient band + interactive preview */}
      <div className="relative">
        <div
          className="absolute inset-x-0 top-[120px] h-[420px] sm:h-[460px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(244,242,255,0.0) 0%, rgba(108,99,255,0.18) 22%, rgba(79,124,255,0.22) 55%, rgba(0,212,199,0.18) 100%)',
          }}
          aria-hidden
        />

        <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 pb-24 sm:pb-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="v-preview relative overflow-hidden mx-auto"
            style={{ borderRadius: 20 }}
          >
            {/* Browser chrome */}
            <div
              className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b"
              style={{ borderColor: 'var(--color-cool-gray)' }}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f57' }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#febc2e' }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#28c840' }} />
                <span className="ml-3 v-caption v-quiet">campgainshub.app/{tab}</span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <Chip color="success" variant="soft" size="sm">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: BRAND.success }} />
                  Live
                </Chip>
              </div>
            </div>

            {/* Tabs — HeroUI Pro Segment (smooth selection indicator) */}
            <div className="px-4 sm:px-6 pt-5 overflow-x-auto">
              <Segment
                selectedKey={tab}
                onSelectionChange={(k) => setTab(k as TabKey)}
                size="md"
              >
                {TABS.map((t, i) => (
                  <React.Fragment key={t.key}>
                    {i > 0 && <Segment.Separator />}
                    <Segment.Item id={t.key}>{t.label}</Segment.Item>
                  </React.Fragment>
                ))}
              </Segment>
            </div>

            {/* Body */}
            <AnimatePresence mode="wait">
              <ActiveBody key={tab} />
            </AnimatePresence>
          </motion.div>

          {/* Floating side glass — left search */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="absolute hidden lg:flex items-center gap-2 v-card v-float-fast"
            style={{
              left: -32,
              top: 360,
              padding: '10px 14px',
              borderRadius: 9999,
              boxShadow: 'rgba(11,23,54,0.10) 0 8px 24px',
            }}
          >
            <Search size={14} className="v-quiet" />
            <span className="v-body v-muted">Search 12,847 creators</span>
            <span
              className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md v-caption"
              style={{
                background: 'var(--color-cool-gray)',
                color: 'var(--color-graphite)',
                fontSize: 10,
              }}
            >
              ⌘K
            </span>
          </motion.div>

          {/* Floating tag — right */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="absolute hidden lg:flex items-center gap-2 v-card v-float-slow"
            style={{
              right: -28,
              top: 280,
              padding: '10px 14px',
              borderRadius: 12,
              boxShadow: 'rgba(11,23,54,0.10) 0 8px 24px',
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: BRAND.success }} />
            <span className="v-body v-ink font-medium">Payout sent</span>
            <span className="v-caption v-quiet">$1,250 → @omar</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ConsoleShowcase;
