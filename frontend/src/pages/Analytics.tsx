import React, { useEffect, useState } from 'react';
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
      title="Analytics &"
      titleAccent="insights"
      description="Applicants over time, budget in USD, platform mix — plus content monitoring and AI matching tools."
      icon={<BarChart2 size={18} />}
    >
      {/* Tabs */}
      <Segment
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(k as TabKey)}
      >
        <Segment.Item id="overview">
          <BarChart2 size={13} /> Overview
        </Segment.Item>
        <Segment.Item id="monitor">
          <Eye size={13} /> Content monitoring
        </Segment.Item>
        <Segment.Item id="match">
          <Target size={13} /> Smart match
        </Segment.Item>
        <Segment.Item id="predict">
          <TrendingUp size={13} /> Performance AI
        </Segment.Item>
        {role === 'admin' && (
          <Segment.Item id="vision">
            <Shield size={13} /> Vision research
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
  const isBrand = role === 'brand';

  /* ── Brand: server stats ───────────────────────────────────────── */
  if (isBrand) {
    const total = stats?.campaigns?.total ?? campaigns.length;
    if (!total) {
      return (
        <EmptyPanel
          icon={<TrendingUp size={22} />}
          title="No campaign data yet"
          description="Post your first brief and this page fills with applicants over time, budget by week and your platform split."
          actions={
            <Link to="/dashboard/campaigns?new=1">
              <Button variant="primary">Create a campaign</Button>
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
                <EmptyPanel size="sm" icon={<Users size={18} />} title="No applicants in the last 12 weeks" description="Applicant activity shows up here the week it happens." />
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

/* ── Content monitoring tab ───────────────────────────────────────── */
const ContentMonitoringTab: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingTaskId, setAnalyzingTaskId] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<any>(null);

  const load = () => {
    api
      .get('/tasks/assigned')
      .then((r) => {
        const activeTasks = (r.data || []).filter((t: any) => t.post_link);
        setTasks(activeTasks);
        setLoading(false);

        if (!analyzingTaskId) {
          const pendingTask = activeTasks.find(
            (t: any) =>
              t.ai_review?.includes('[JOB_ID]') &&
              (t.ai_review?.includes('Bot is still scraping') ||
                t.ai_review?.includes('Re-analyzing'))
          );
          if (pendingTask) {
            const match = pendingTask.ai_review.match(/\[JOB_ID\](\w+)/);
            if (match) {
              setAnalyzingTaskId(pendingTask.id);
              setBotStatus({
                status: 'running',
                step: 'resuming',
                detail: 'Resuming bot tracker…',
                progress: 30,
              });
            }
          }
        }
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!analyzingTaskId) return;
    let stopped = false;
    const pollInterval = setInterval(async () => {
      if (stopped) return;
      try {
        const taskRes = await api.get('/tasks/assigned');
        const updatedTasks = (taskRes.data || []).filter(
          (t: any) => t.post_link
        );
        setTasks(updatedTasks);

        const task = updatedTasks.find((t: any) => t.id === analyzingTaskId);
        if (!task) return;

        if (
          task.ai_review &&
          !task.ai_review.includes('Re-analyzing') &&
          !task.ai_review.includes('🔄') &&
          !task.ai_review.includes('[JOB_ID]')
        ) {
          setBotStatus({
            status: 'complete',
            step: 'done',
            detail: 'Analysis complete',
            progress: 100,
          });
          setTimeout(() => {
            setAnalyzingTaskId(null);
            setBotStatus(null);
          }, 2500);
          stopped = true;
          clearInterval(pollInterval);
          return;
        }

        const jobMatch = task.ai_review?.match(/\[JOB_ID\](\w+)/);
        if (jobMatch) {
          const jobId = jobMatch[1];
          const statusRes = await api.get(`/ai/bot-status/${jobId}`);
          if (statusRes.data) {
            setBotStatus(statusRes.data);
            const isDone =
              statusRes.data.status === 'complete' ||
              statusRes.data.status === 'error' ||
              statusRes.data.status === 'failed';
            const isLost =
              statusRes.data.success === false && !statusRes.data.status;

            if (isDone || isLost) {
              let finalReview = `Analysis failed: ${
                statusRes.data.detail ||
                statusRes.data.error ||
                'Job expired'
              }`;
              if (
                statusRes.data.status === 'complete' &&
                statusRes.data.result
              ) {
                const r = statusRes.data.result;
                const m = r.metrics || {};
                const parts = [
                  `[METRICS] Metrics: ${m.likes ?? '-'} likes · Engagement: ${
                    m.engagement_rate || '-'
                  }`,
                  `AI Bot Report — Platform: ${r.platform || 'Unknown'}`,
                  `Metrics: ${m.likes ?? '-'} likes · Engagement: ${
                    m.engagement_rate || '-'
                  }`,
                  `Brand Safety: ${r.brand_safety_score ?? '-'}/100 | Campaign Match: ${
                    r.campaign_match ? 'Yes' : 'No'
                  }`,
                  `${r.ai_notes || statusRes.data.ai_notes || 'Analysis complete.'}`,
                ];
                if (r.screenshot)
                  parts.push(
                    `[BASE64_IMAGE]data:image/png;base64,${r.screenshot}`
                  );
                finalReview = parts.join('\n');
              }

              try {
                await api.patch(`/tasks/${task.id}/ai-review`, {
                  review: finalReview,
                });
              } catch (e) {
                console.error('Failed to save AI review', e);
              }

              setTimeout(() => {
                load();
                setAnalyzingTaskId(null);
                setBotStatus(null);
              }, 2500);
              stopped = true;
              clearInterval(pollInterval);
            }
          }
        }
      } catch {
        /* silent */
      }
    }, 2000);

    return () => {
      stopped = true;
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzingTaskId]);

  const reanalyze = async (taskId: string) => {
    try {
      setAnalyzingTaskId(taskId);
      setBotStatus({
        status: 'running',
        step: 'init',
        detail: 'Starting bot…',
        progress: 0,
      });
      await api.post(`/tasks/${taskId}/reanalyze`);
    } catch {
      alert('Re-analysis failed');
      setAnalyzingTaskId(null);
      setBotStatus(null);
    }
  };

  const cancelAnalysis = async () => {
    if (!analyzingTaskId) return;
    const taskId = analyzingTaskId;
    setAnalyzingTaskId(null);
    setBotStatus(null);
    try {
      await api.patch(`/tasks/${taskId}/ai-review`, {
        review: 'Analysis cancelled by user.',
      });
      load();
    } catch (e) {
      console.error('Failed to save cancel state', e);
    }
  };

  const parseReview = (review: string) => {
    if (!review) return { lines: [] as string[], hasMetrics: false };
    const cleanedLines = review
      .split('\n')
      .filter(
        (l) =>
          l &&
          !l.startsWith('[JOB_ID]') &&
          !l.startsWith('[BASE64_IMAGE]') &&
          !l.startsWith('[METRICS]')
      );
    const metricsLine = review
      .split('\n')
      .find((l) => l.includes('Metrics:') || l.includes('📊'));
    let likes = '';
    let engagement = '';
    if (metricsLine) {
      const lM = metricsLine.match(/([\d,]+)\s*likes/i);
      const eM = metricsLine.match(/Engagement:\s*([\d.]+%)/i);
      if (lM) likes = lM[1];
      if (eM) engagement = eM[1];
    }
    const imgLine = review
      .split('\n')
      .find((l) => l.startsWith('[BASE64_IMAGE]'));
    const screenshotSrc = imgLine
      ? imgLine.replace('[BASE64_IMAGE]', '')
      : '';
    return {
      lines: cleanedLines,
      hasMetrics: !!likes,
      likes,
      engagement,
      screenshotSrc,
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <Card.Header className="flex-row items-start justify-between gap-3">
        <div>
          <Card.Title className="text-base">Content monitoring</Card.Title>
          <Card.Description>
            Track and verify content submitted by creators. The bot scrapes and
            analyzes post performance.
          </Card.Description>
        </div>
        <Button variant="tertiary" size="sm" onPress={load}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </Card.Header>
      <Separator />
      <Card.Content className="p-5 space-y-4">
        <Card className="bg-warning-soft border-warning/40">
          <Card.Content className="p-3 inline-flex items-center gap-2 text-xs text-warning-soft-foreground font-medium">
            <AlertTriangle size={12} /> Only Instagram links are currently
            supported for AI monitoring. Other links will fail.
          </Card.Content>
        </Card>

        {/* Live bot activity */}
        {analyzingTaskId && botStatus && (
          <Card className="bg-accent-soft border-accent/40">
            <Card.Content className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Bot size={18} />
                </span>
                <div className="flex-1">
                  <h4 className="text-foreground text-sm font-semibold">
                    Live tracking
                  </h4>
                  <p className="text-muted text-xs">
                    {botStatus.platform && `${botStatus.platform} · `}
                    {botStatus.status === 'running'
                      ? 'Working…'
                      : botStatus.status === 'complete'
                      ? 'Done'
                      : botStatus.status}
                  </p>
                </div>
                {botStatus.status === 'running' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!text-danger"
                    onPress={cancelAnalysis}
                  >
                    <XCircle size={13} /> Cancel
                  </Button>
                )}
                {botStatus.status === 'complete' && (
                  <CheckCircle2 className="text-success" size={20} />
                )}
              </div>

              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-700"
                  style={{ width: `${botStatus.progress || 0}%` }}
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Chip color="accent" variant="soft" size="sm">
                  <Chip.Label>Step: {botStatus.step || 'init'}</Chip.Label>
                </Chip>
                <span className="text-foreground flex-1 truncate">
                  {botStatus.detail || 'Initializing…'}
                </span>
                <span className="text-muted font-semibold tabular-nums">
                  {botStatus.progress || 0}%
                </span>
              </div>

              {botStatus.screenshot && (
                <div className="rounded-lg overflow-hidden border border-accent/40">
                  <div className="bg-overlay text-overlay-foreground text-[10px] font-medium px-3 py-1.5 flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="size-2 rounded-full bg-danger" />
                      <span className="size-2 rounded-full bg-warning" />
                      <span className="size-2 rounded-full bg-success" />
                    </div>
                    <span className="truncate">
                      Bot browser view: {botStatus.url?.substring(0, 60)}…
                    </span>
                  </div>
                  <img
                    src={`data:image/png;base64,${botStatus.screenshot}`}
                    alt="Bot browser view"
                    className="w-full h-auto max-h-96 object-contain bg-overlay"
                  />
                </div>
              )}
            </Card.Content>
          </Card>
        )}

        {tasks.length === 0 ? (
          <div className="py-12">
            <EmptyState>
              <EmptyState.Media>
                <LinkIcon className="size-7" />
              </EmptyState.Media>
              <EmptyState.Title>No content links yet</EmptyState.Title>
              <EmptyState.Description>
                When creators submit post links in the Workspace, they'll
                appear here with bot analysis.
              </EmptyState.Description>
            </EmptyState>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const isReanalyzing = analyzingTaskId === task.id;
              const isOffline =
                task.ai_review?.includes('offline') ||
                task.ai_review?.includes('Re-analyzing');
              const isFailed = task.ai_review?.includes('Analysis failed');
              const isOk =
                task.ai_review &&
                !isOffline &&
                !task.ai_review?.includes('🔄') &&
                !isFailed;
              const parsed = parseReview(task.ai_review || '');

              const status = isReanalyzing
                ? 'analyzing'
                : isOk
                ? 'analyzed'
                : isFailed
                ? 'failed'
                : isOffline
                ? 'pending'
                : 'monitoring';
              const statusColor: Record<
                string,
                'success' | 'warning' | 'danger' | 'accent' | 'default'
              > = {
                analyzing: 'accent',
                analyzed: 'success',
                failed: 'danger',
                pending: 'warning',
                monitoring: 'warning',
              };
              const statusLabel: Record<string, string> = {
                analyzing: 'Bot active',
                analyzed: 'Analyzed',
                failed: 'Failed',
                pending: 'Pending',
                monitoring: 'Monitoring',
              };

              return (
                <Card
                  key={task.id}
                  className={
                    isReanalyzing
                      ? 'border-accent/40'
                      : isFailed
                      ? 'border-danger/40'
                      : ''
                  }
                >
                  <Card.Content className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={task.post_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent text-sm font-semibold break-all hover:underline"
                          >
                            {task.post_link}
                          </a>
                          <Chip
                            color={statusColor[status]}
                            variant="soft"
                            size="sm"
                          >
                            {status === 'analyzing' && <Bot size={11} />}
                            {status === 'analyzed' && (
                              <CheckCircle2 size={11} />
                            )}
                            {status === 'failed' && (
                              <AlertTriangle size={11} />
                            )}
                            {status === 'pending' && <Clock size={11} />}
                            {status === 'monitoring' && (
                              <RefreshCw size={11} className="animate-spin" />
                            )}
                            <Chip.Label>{statusLabel[status]}</Chip.Label>
                          </Chip>
                        </div>
                        <div className="text-muted text-xs">
                          Task:{' '}
                          <span className="text-foreground font-semibold">
                            {task.title}
                          </span>{' '}
                          · Submitted by:{' '}
                          <span className="text-foreground font-semibold">
                            {task.assignedTo?.email?.split('@')[0] ||
                              'Creator'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="tertiary"
                        size="sm"
                        isDisabled={!!analyzingTaskId}
                        onPress={() => reanalyze(task.id)}
                      >
                        <RefreshCw size={12} /> Re-analyze
                      </Button>
                    </div>

                    {parsed.hasMetrics && !isReanalyzing && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-surface-secondary rounded-lg p-2 text-center">
                          <div className="text-muted text-[10px] font-medium uppercase inline-flex items-center justify-center gap-1.5 mb-0.5">
                            <Heart size={11} /> Likes
                          </div>
                          <div className="text-foreground text-sm font-semibold tabular-nums">
                            {parsed.likes}
                          </div>
                        </div>
                        <div className="bg-surface-secondary rounded-lg p-2 text-center">
                          <div className="text-muted text-[10px] font-medium uppercase inline-flex items-center justify-center gap-1.5 mb-0.5">
                            <TrendingUp size={11} /> Engagement
                          </div>
                          <div className="text-foreground text-sm font-semibold tabular-nums">
                            {parsed.engagement}
                          </div>
                        </div>
                      </div>
                    )}

                    {task.ai_review && !isReanalyzing && (
                      <Card
                        className={
                          isOffline
                            ? 'bg-warning-soft border-warning/40'
                            : 'bg-surface-secondary'
                        }
                      >
                        <Card.Content className="p-3 text-xs leading-relaxed">
                          <p className="text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 inline-flex items-center gap-1.5">
                            <Bot size={11} /> Analysis report
                          </p>
                          {parsed.lines.map((line, i) => (
                            <div key={i} className="mb-0.5 text-foreground">
                              {line}
                            </div>
                          ))}
                          {parsed.screenshotSrc && (
                            <div className="mt-3 rounded-lg overflow-hidden border border-border">
                              <img
                                src={parsed.screenshotSrc}
                                alt="Scraped post"
                                className="w-full h-auto max-h-96 object-contain bg-overlay"
                              />
                            </div>
                          )}
                        </Card.Content>
                      </Card>
                    )}
                  </Card.Content>
                </Card>
              );
            })}
          </div>
        )}
      </Card.Content>
    </Card>
  );
};

export default Analytics;
