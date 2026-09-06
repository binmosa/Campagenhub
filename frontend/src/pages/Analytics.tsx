import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  BarChart2,
  Bot,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  Heart,
  Link as LinkIcon,
  RefreshCw,
  Shield,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, Card, Chip, Separator } from '@heroui/react';
import { EmptyState, KPI, Segment } from '@heroui-pro/react';
import api from '../lib/api';
import { SmartMatch, PerformancePredictor, DeepResearch } from './AiHub';
import { MetricCard, PageShell } from '../components/ui';
import { EmptyPanel } from '../components/common/EmptyPanel';
import { formatBudget } from '../lib/campaignFormat';
import { Link } from 'react-router-dom';

type TabKey = 'overview' | 'monitor' | 'match' | 'predict' | 'vision';

const Analytics: React.FC = () => {
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const role = localStorage.getItem('role') || 'creator';

  useEffect(() => {
    const load = async () => {
      try {
        const endpoint = role === 'brand' ? '/campaigns/brand' : '/applications';
        const [res, st] = await Promise.all([
          api.get(endpoint),
          role === 'brand' ? api.get('/campaigns/brand/stats').catch(() => ({ data: null })) : Promise.resolve({ data: null }),
        ]);
        setCampaigns(res.data || []);
        setStats(st.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [role]);

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('ops.an.title')}
      titleAccent={t('ops.an.accent')}
      description={t('ops.an.desc')}
      icon={<BarChart2 size={18} />}
    >
      {/* Tabs */}
      <Segment
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(k as TabKey)}
      >
        <Segment.Item id="overview">
          <BarChart2 size={13} /> {t('ops.an.tabOverview')}
        </Segment.Item>
        <Segment.Item id="monitor">
          <Eye size={13} /> {t('ops.an.tabMonitor')}
        </Segment.Item>
        <Segment.Item id="match">
          <Target size={13} /> {t('ops.an.tabMatch')}
        </Segment.Item>
        <Segment.Item id="predict">
          <TrendingUp size={13} /> {t('ops.an.tabPredict')}
        </Segment.Item>
        {role === 'admin' && (
          <Segment.Item id="vision">
            <Shield size={13} /> {t('ops.an.tabVision')}
          </Segment.Item>
        )}
      </Segment>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && <OverviewTab campaigns={campaigns} role={role} stats={stats} />}
          {activeTab === 'monitor' && <ContentMonitoringTab />}
          {activeTab === 'match' && (
            <Card>
              <Card.Content className="p-5">
                <SmartMatch />
              </Card.Content>
            </Card>
          )}
          {activeTab === 'predict' && (
            <Card>
              <Card.Content className="p-5">
                <PerformancePredictor />
              </Card.Content>
            </Card>
          )}
          {activeTab === 'vision' && role === 'admin' && (
            <Card>
              <Card.Content className="p-5">
                <DeepResearch />
              </Card.Content>
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
};

/* ── Overview tab ─────────────────────────────────────────────────── */
/* Chart palette — CSS tokens so charts follow the product theme (the old
   oklch literals were light-mode-only and off-brand). */
const CHART = {
  purple: 'var(--chart-3, #6c63ff)',
  teal: 'var(--chart-1, #00d4c7)',
  blue: 'var(--chart-2, #4f7cff)',
  violet: 'var(--chart-4, #7b61ff)',
  deep: 'var(--chart-5, #00cfc8)',
  grid: 'var(--color-cool-gray, #e9edf5)',
  axis: 'var(--color-ash, #8a93a8)',
};
const PIE_COLORS = [CHART.purple, CHART.teal, CHART.blue, CHART.violet, CHART.deep];
const TOOLTIP_STYLE = {
  borderRadius: 12,
  fontSize: 12,
  background: 'var(--color-paper, #fff)',
  border: '1px solid var(--color-cool-gray, #e9edf5)',
  boxShadow: 'rgba(11,23,54,0.10) 0 8px 24px -8px',
  color: 'var(--color-deep-navy, #0b1736)',
};

const weekLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/**
 * OverviewTab — brands read the server-aggregated stats (funnels, weekly
 * series, USD budget); creators/managers see their own application funnel
 * derived client-side. Empty → EmptyPanel instead of a blank chart.
 */
const OverviewTab: React.FC<{ campaigns: any[]; role: string; stats: any | null }> = ({ campaigns, role, stats }) => {
  const { t } = useTranslation();
  const isBrand = role === 'brand';

  /* ── Brand: server stats ───────────────────────────────────────── */
  if (isBrand) {
    const total = stats?.campaigns?.total ?? campaigns.length;
    if (!total) {
      return (
        <EmptyPanel
          icon={<TrendingUp size={22} />}
          title={t('ops.an.emptyTitle')}
          description={t('ops.an.emptyDesc')}
          actions={
            <Link to="/dashboard/campaigns?new=1">
              <Button variant="primary">{t('ops.an.createCampaign')}</Button>
            </Link>
          }
        />
      );
    }
    const series = stats?.series || { weeks: [], campaigns: [], applications: [], accepted: [] };
    const WEEKLY = (series.weeks || []).map((w: string, i: number) => ({
      week: weekLabel(w),
      applications: series.applications?.[i] ?? 0,
      accepted: series.accepted?.[i] ?? 0,
      campaigns: series.campaigns?.[i] ?? 0,
    }));
    const platformCounts: Record<string, number> = {};
    for (const c of campaigns) {
      for (const p of String(c.platform || 'Other').split(/[,|]+/)) {
        const k = p.trim() || 'Other';
        platformCounts[k] = (platformCounts[k] || 0) + 1;
      }
    }
    const PLATFORM_DATA = Object.keys(platformCounts).map((k) => ({ name: k, value: platformCounts[k] }));
    const apps = stats?.applications || {};
    const acceptRate = apps.total ? Math.round((apps.accepted / apps.total) * 100) : 0;
    const committed = Number(stats?.budget?.committed_usd || 0);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Active campaigns" value={stats?.campaigns?.by_status?.active ?? 0} hint={`of ${total} total`} series={series.campaigns} icon={Target} />
          <MetricCard label="Applicants" value={apps.total ?? 0} hint={`${apps.pending ?? 0} pending`} series={series.applications} chartColor={CHART.teal} icon={Users} />
          <MetricCard label="Accept rate" value={`${acceptRate}%`} hint={`${apps.accepted ?? 0} accepted`} series={series.accepted} chartColor="var(--color-signal-green, #16c784)" icon={TrendingUp} iconStatus="success" />
          <MetricCard label="Committed budget" value={formatBudget(committed, 'USD')} hint={`${formatBudget(Number(stats?.budget?.active_usd || 0), 'USD')} live`} icon={DollarSign} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <Card.Header>
              <Card.Title className="text-base">Applicants per week</Card.Title>
              <Card.Description>Last 12 weeks · applications vs. accepted</Card.Description>
            </Card.Header>
            <Separator />
            <Card.Content className="p-5">
              {WEEKLY.every((w: any) => !w.applications && !w.accepted) ? (
                <EmptyPanel size="sm" icon={<Users size={18} />} title={t('ops.an.emptyApplicants')} description={t('ops.an.emptyApplicantsDesc')} />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={WEEKLY}>
                    <defs>
                      <linearGradient id="gradApps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART.purple} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CHART.purple} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradAcc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART.teal} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CHART.teal} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: CHART.axis }} stroke={CHART.grid} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} stroke={CHART.grid} tickLine={false} width={28} />
                    <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="applications" name="Applications" stroke={CHART.purple} fill="url(#gradApps)" strokeWidth={2} />
                    <Area type="monotone" dataKey="accepted" name="Accepted" stroke={CHART.teal} fill="url(#gradAcc)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title className="text-base">Platform split</Card.Title>
              <Card.Description>Campaigns by target platform</Card.Description>
            </Card.Header>
            <Separator />
            <Card.Content className="p-5">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={PLATFORM_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" stroke="var(--color-paper, #fff)">
                    {PLATFORM_DATA.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {PLATFORM_DATA.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 text-foreground font-medium">
                      <span className="inline-block size-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {p.name}
                    </span>
                    <span className="text-muted tabular-nums">{p.value}</span>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    );
  }

  /* ── Creator / manager: my applications ───────────────────────── */
  if (campaigns.length === 0) {
    return (
      <EmptyPanel
        icon={<TrendingUp size={22} />}
        title="No activity yet"
        description="Apply to a brief and your funnel, budget exposure and platform mix appear here."
        actions={
          <Link to="/campaigns">
            <Button variant="primary">Browse open briefs</Button>
          </Link>
        }
      />
    );
  }
  const accepted = campaigns.filter((a) => String(a.status).toLowerCase() === 'accepted').length;
  const pending = campaigns.filter((a) => String(a.status).toLowerCase() === 'pending').length;
  const exposure = campaigns.reduce((s, a) => s + Number(a.campaign?.budget_usd ?? (a.campaign?.currency === 'USD' ? a.campaign?.budget : 0) ?? 0), 0);

  const monthly = new Map<string, { label: string; count: number; accepted: number }>();
  for (const a of campaigns) {
    const d = new Date(a.created_at || Date.now());
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = monthly.get(key) || { label: d.toLocaleString(undefined, { month: 'short', year: '2-digit' }), count: 0, accepted: 0 };
    row.count++;
    if (String(a.status).toLowerCase() === 'accepted') row.accepted++;
    monthly.set(key, row);
  }
  const MONTHLY = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  const platformCounts: Record<string, number> = {};
  for (const a of campaigns) {
    for (const p of String(a.campaign?.platform || 'Other').split(/[,|]+/)) {
      const k = p.trim() || 'Other';
      platformCounts[k] = (platformCounts[k] || 0) + 1;
    }
  }
  const PLATFORM_DATA = Object.keys(platformCounts).map((k) => ({ name: k, value: platformCounts[k] }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Applications" value={campaigns.length} hint="all time" icon={Target} />
        <MetricCard label="Pending" value={pending} hint="awaiting review" icon={Users} iconStatus={pending ? 'warning' : undefined} />
        <MetricCard label="Accepted" value={accepted} hint={`${campaigns.length ? Math.round((accepted / campaigns.length) * 100) : 0}% rate`} icon={TrendingUp} iconStatus="success" />
        <MetricCard label="Budget exposure" value={formatBudget(exposure, 'USD')} hint="briefs applied to" icon={DollarSign} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <Card.Header>
            <Card.Title className="text-base">Applications by month</Card.Title>
            <Card.Description>Sent vs. accepted</Card.Description>
          </Card.Header>
          <Separator />
          <Card.Content className="p-5">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={MONTHLY}>
                <defs>
                  <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART.purple} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART.purple} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axis }} stroke={CHART.grid} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} stroke={CHART.grid} tickLine={false} width={28} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="count" name="Sent" stroke={CHART.purple} fill="url(#gradSent)" strokeWidth={2} />
                <Area type="monotone" dataKey="accepted" name="Accepted" stroke={CHART.teal} fill="none" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title className="text-base">Platform split</Card.Title>
            <Card.Description>Briefs you applied to</Card.Description>
          </Card.Header>
          <Separator />
          <Card.Content className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={PLATFORM_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" stroke="var(--color-paper, #fff)">
                  {PLATFORM_DATA.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-3">
              {PLATFORM_DATA.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2 text-foreground font-medium">
                    <span className="inline-block size-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {p.name}
                  </span>
                  <span className="text-muted tabular-nums">{p.value}</span>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
};

/* ── Submitted content tab ────────────────────────────────────────── */
/** Every link creators submitted on their tasks, newest first — the brand
 *  approves or sends back right here; there is no automated review. */
const ContentMonitoringTab: React.FC = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    api
      .get('/tasks/assigned')
      .then((r) => setTasks((r.data || []).filter((x: any) => x.post_link)))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const setStatus = async (id: string, status: 'reviewed' | 'in_progress') => {
    setBusy(id);
    try {
      await api.patch(`/tasks/${id}`, { status });
      load();
    } catch {
      /* the row keeps its state; the workspace shows the same task */
    } finally {
      setBusy(null);
    }
  };

  const STATUS: Record<string, { key: string; color: 'success' | 'warning' | 'accent' | 'default' }> = {
    completed: { key: 'ops.ws.status.completed', color: 'accent' },
    reviewed: { key: 'ops.ws.status.reviewed', color: 'success' },
    in_progress: { key: 'ops.ws.status.in_progress', color: 'warning' },
    pending: { key: 'ops.ws.status.pending', color: 'default' },
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="v-talent-card p-4">
            <div className="v-skel h-4 w-1/3 mb-2" />
            <div className="v-skel h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }
  if (tasks.length === 0) {
    return (
      <EmptyPanel
        icon={<LinkIcon size={22} />}
        title={t('ops.an.subEmptyTitle')}
        description={t('ops.an.subEmptyDesc')}
        actions={
          <Link to="/dashboard/workspace">
            <Button variant="primary">{t('ops.an.openWorkspace')}</Button>
          </Link>
        }
      />
    );
  }

  const waiting = tasks.filter((x) => x.status === 'completed').length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="v-body v-muted" style={{ fontSize: 13 }}>
          {t('ops.an.subIntro', { count: tasks.length, waiting })}
        </p>
        <Link to="/dashboard/workspace">
          <Button variant="tertiary" size="sm">
            {t('ops.an.openWorkspace')}
          </Button>
        </Link>
      </div>
      <ul className="v-talent-card v-static divide-y divide-border px-4">
        {tasks.map((task) => {
          const st = STATUS[task.status] || STATUS.pending;
          let host = task.post_link;
          try {
            host = new URL(task.post_link).hostname.replace(/^www\./, '');
          } catch {
            /* keep the raw link */
          }
          return (
            <li key={task.id} className="flex items-center gap-3 py-3">
              <span className="v-hero-icon shrink-0" style={{ width: 36, height: 36, borderRadius: 11 }}>
                <LinkIcon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{task.title}</div>
                <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                  {[task.campaign?.title, task.assignedTo?.email?.split('@')[0], task.platform].filter(Boolean).join(' · ')}
                </div>
                <a href={task.post_link} target="_blank" rel="noopener noreferrer" className="v-caption font-medium hover:underline inline-flex items-center gap-1" style={{ color: 'var(--color-campaign-purple)', fontSize: 12 }}>
                  <LinkIcon size={10} /> {host}
                </a>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <Chip color={st.color} variant="soft" size="sm">
                  <Chip.Label>{t(st.key)}</Chip.Label>
                </Chip>
                {task.status === 'completed' && (
                  <>
                    <Button variant="tertiary" size="sm" onPress={() => setStatus(task.id, 'in_progress')} isPending={busy === task.id}>
                      {t('ops.ws.sendBack')}
                    </Button>
                    <Button variant="primary" size="sm" onPress={() => setStatus(task.id, 'reviewed')} isPending={busy === task.id}>
                      <CheckCircle2 size={11} /> {t('ops.ws.approve')}
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Analytics;
