import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Clock,
  DollarSign,
  FileText,
  Mail,
  Megaphone,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Separator,
} from '@heroui/react';
import {
  ChartTooltip,
  EmptyState,
  KPI,
  LineChart,
  Widget,
} from '@heroui-pro/react';
import api from '../../lib/api';
import { PageShell } from '../../components/ui';
import { LayoutDashboard } from 'lucide-react';

/**
 * Creator Dashboard — at-a-glance workspace.
 *
 *   1. Welcome banner (greeting + invitation alert + primary CTA)
 *   2. KPIGroup with 4 KPIs + sparklines
 *   3. Activity LineChart (Widget) — applications vs contracts trend
 *   4. Two-col grid: Recent contracts + Open campaigns
 *   5. Quick-action footer row
 */

type Application = {
  id: string;
  status: string;
  created_at?: string;
  campaign?: { title?: string; budget?: number | string };
};

type Contract = {
  id: string;
  status: string;
  title?: string;
  created_at?: string;
};

type Campaign = {
  id: string;
  title: string;
  niche?: string;
  category?: string;
  budget?: number | string;
  budget_range?: string;
  payout_range?: string;
  platform?: string;
  brand?: { brandProfile?: { company_name?: string; logo_url?: string }; email?: string };
};

type Invitation = {
  id: string;
  status: string;
  campaign?: { title?: string };
  brand?: { brandProfile?: { company_name?: string } };
};

const formatBudget = (raw?: number | string) => {
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
};

/* Build a 12-week activity series from raw applications + contracts. */
const buildActivitySeries = (apps: Application[], contracts: Contract[]) => {
  const weeks: { week: string; applications: number; contracts: number }[] = [];
  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  for (let i = 11; i >= 0; i--) {
    const start = now - (i + 1) * WEEK_MS;
    const end = now - i * WEEK_MS;
    const a = apps.filter((x) => {
      const t = x.created_at ? new Date(x.created_at).getTime() : 0;
      return t >= start && t < end;
    }).length;
    const c = contracts.filter((x) => {
      const t = x.created_at ? new Date(x.created_at).getTime() : 0;
      return t >= start && t < end;
    }).length;
    const dt = new Date(end);
    weeks.push({
      week: `${dt.getMonth() + 1}/${dt.getDate()}`,
      applications: a,
      contracts: c,
    });
  }
  return weeks;
};

const CreatorDashboard: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>('');

  useEffect(() => {
    Promise.all([
      api.get('/applications/mine').catch(() => ({ data: [] })),
      api.get('/invitations/received').catch(() => ({ data: [] })),
      api.get('/contracts/mine').catch(() => ({ data: [] })),
      api.get('/campaigns/active').catch(() => ({ data: [] })),
      api.get('/creators/profile').catch(() => ({ data: {} })),
    ]).then(([apps, invs, conts, camps, profile]) => {
      setApplications(apps.data || []);
      setInvitations((invs.data || []).filter((i: Invitation) => i.status === 'pending'));
      setContracts(conts.data || []);
      setCampaigns(camps.data || []);
      setDisplayName(profile.data?.full_name || '');
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    const active = contracts.filter((c) => c.status === 'active' || c.status === 'approved').length;
    const pending = applications.filter((a) => a.status === 'pending').length;
    const declined = applications.filter(
      (a) => a.status === 'declined' || a.status === 'rejected'
    ).length;
    return {
      applications: applications.length,
      active,
      pending,
      declined,
    };
  }, [applications, contracts]);

  const activitySeries = useMemo(
    () => buildActivitySeries(applications, contracts),
    [applications, contracts]
  );

  const sparkApps = useMemo(
    () => activitySeries.map((w) => ({ v: w.applications })),
    [activitySeries]
  );
  const sparkContracts = useMemo(
    () => activitySeries.map((w) => ({ v: w.contracts })),
    [activitySeries]
  );
  const sparkPending = useMemo(() => {
    if (!stats.pending) return Array.from({ length: 8 }, () => ({ v: 0 }));
    return Array.from({ length: 8 }, (_, i) => ({
      v: Math.round(((i + 1) / 8) * stats.pending),
    }));
  }, [stats.pending]);
  const sparkDeclined = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        v: Math.round((stats.declined * (i + 1)) / 8),
      })),
    [stats.declined]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-muted">Loading your workspace…</p>
      </div>
    );
  }

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <PageShell
      title={`${greeting}${displayName ? `, ${displayName.split(' ')[0]}` : ''}`}
      description="Here's what's happening with your collaborations today."
      icon={<LayoutDashboard size={18} />}
      eyebrow={
        <div className="flex items-center gap-2">
          <Chip color="accent" variant="soft" size="sm">
            <Sparkles size={11} /> Creator
          </Chip>
          <span className="text-xs text-muted">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      }
      actions={
        <Link to="/dashboard/campaigns">
          <Button variant="primary" size="md" className="!rounded-xl">
            <Megaphone size={14} /> Browse campaigns
          </Button>
        </Link>
      }
    >
      {/* ─── Pending invitations alert (conditional) ─────────────── */}
      {invitations.length > 0 && (
        <Card>
          <Card.Content className="p-4 sm:p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground shrink-0">
                <Mail size={17} />
              </span>
              <div className="min-w-0">
                <div className="text-foreground text-sm font-semibold">
                  {invitations.length} pending invitation
                  {invitations.length > 1 ? 's' : ''}
                </div>
                <div className="text-muted text-xs">
                  Brands want to collaborate with you.
                </div>
              </div>
            </div>
            <Link to="/dashboard/invitations" className="shrink-0">
              <Button variant="primary" size="sm">
                Review <ArrowRight size={12} />
              </Button>
            </Link>
          </Card.Content>
        </Card>
      )}

      {/* ─── KPI grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI>
          <KPI.Header>
            <KPI.Title>Applications</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={stats.applications} maximumFractionDigits={0} />
            <KPI.Trend trend={stats.applications > 0 ? 'up' : 'neutral'}>
              {applications.filter(
                (a) =>
                  a.created_at &&
                  Date.now() - new Date(a.created_at).getTime() <
                    7 * 24 * 60 * 60 * 1000
              ).length}{' '}
              this week
            </KPI.Trend>
          </KPI.Content>
          <KPI.Chart
            data={sparkApps}
            dataKey="v"
            color="var(--color-accent)"
            height={56}
            strokeWidth={1.5}
          />
        </KPI>

        <KPI>
          <KPI.Header>
            <KPI.Title>Active contracts</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={stats.active} maximumFractionDigits={0} />
            <KPI.Trend trend={stats.active > 0 ? 'up' : 'neutral'}>
              Currently signed
            </KPI.Trend>
          </KPI.Content>
          <KPI.Chart
            data={sparkContracts}
            dataKey="v"
            color="var(--color-success)"
            height={56}
            strokeWidth={1.5}
          />
        </KPI>

        <KPI>
          <KPI.Header>
            <KPI.Title>Pending review</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={stats.pending} maximumFractionDigits={0} />
            <KPI.Trend trend="neutral">Awaiting brand</KPI.Trend>
          </KPI.Content>
          <KPI.Chart
            data={sparkPending}
            dataKey="v"
            color="var(--color-warning)"
            height={56}
            strokeWidth={1.5}
          />
        </KPI>

        <KPI>
          <KPI.Header>
            <KPI.Title>Declined</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={stats.declined} maximumFractionDigits={0} />
            <KPI.Trend
              trend={stats.declined > stats.applications / 2 ? 'down' : 'neutral'}
            >
              Not a fit
            </KPI.Trend>
          </KPI.Content>
          <KPI.Chart
            data={sparkDeclined}
            dataKey="v"
            color="var(--color-muted)"
            height={56}
            strokeWidth={1.5}
          />
        </KPI>
      </div>

      {/* ─── Activity chart ──────────────────────────────────────── */}
      <Widget>
        <Widget.Header>
          <div className="flex-1 min-w-0">
            <Widget.Title>Activity · last 12 weeks</Widget.Title>
            <Widget.Description>
              Applications sent vs. contracts won
            </Widget.Description>
          </div>
          <Widget.Legend>
            <Widget.LegendItem color="var(--chart-3)">Applications</Widget.LegendItem>
            <Widget.LegendItem color="var(--chart-1)">Contracts</Widget.LegendItem>
          </Widget.Legend>
        </Widget.Header>
        <Widget.Content>
          {applications.length === 0 && contracts.length === 0 ? (
            <EmptyState>
              <EmptyState.Media>
                <TrendingUp className="size-6" />
              </EmptyState.Media>
              <EmptyState.Title>No activity yet</EmptyState.Title>
              <EmptyState.Description>
                Apply to your first campaign and watch this chart light up.
              </EmptyState.Description>
            </EmptyState>
          ) : (
            <LineChart data={activitySeries} height={220}>
              <LineChart.Grid vertical={false} />
              <LineChart.XAxis dataKey="week" tickMargin={8} />
              <LineChart.YAxis width={24} />
              <LineChart.Line
                dataKey="applications"
                name="Applications"
                dot={false}
                stroke="var(--chart-3)"
                strokeWidth={2.4}
                type="monotone"
              />
              <LineChart.Line
                dataKey="contracts"
                name="Contracts"
                dot={false}
                stroke="var(--chart-1)"
                strokeWidth={2.4}
                type="monotone"
              />
              <LineChart.Tooltip
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <ChartTooltip>
                      <ChartTooltip.Header>Week of {label}</ChartTooltip.Header>
                      {payload.map((entry) => (
                        <ChartTooltip.Item key={String(entry.dataKey)}>
                          <ChartTooltip.Indicator color={entry.color ?? entry.stroke} />
                          <ChartTooltip.Label>{entry.name}</ChartTooltip.Label>
                          <ChartTooltip.Value>{entry.value}</ChartTooltip.Value>
                        </ChartTooltip.Item>
                      ))}
                    </ChartTooltip>
                  );
                }}
              />
            </LineChart>
          )}
        </Widget.Content>
      </Widget>

      {/* ─── Two-column grid: Contracts + Campaigns ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title className="flex items-center gap-2 text-base">
              <FileText size={15} className="text-accent" />
              My contracts
            </Card.Title>
            <Link to="/dashboard/contracts">
              <Button variant="ghost" size="sm">
                See all <ArrowRight size={12} />
              </Button>
            </Link>
          </Card.Header>
          <Separator />
          <Card.Content className="p-0">
            {contracts.length === 0 ? (
              <EmptyState>
                <EmptyState.Media>
                  <FileText className="size-6" />
                </EmptyState.Media>
                <EmptyState.Title>No contracts yet</EmptyState.Title>
                <EmptyState.Description>
                  Accepted invitations become contracts.
                </EmptyState.Description>
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {contracts.slice(0, 5).map((c) => {
                  const isActive = c.status === 'active' || c.status === 'approved';
                  return (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <div className="min-w-0">
                        <div className="text-foreground text-sm font-semibold truncate">
                          {c.title || `Contract #${c.id?.slice(0, 8)}`}
                        </div>
                        <div className="text-muted text-xs">
                          {c.created_at
                            ? new Date(c.created_at).toLocaleDateString()
                            : '—'}
                        </div>
                      </div>
                      <Chip
                        color={isActive ? 'success' : 'warning'}
                        variant="soft"
                        size="sm"
                        className="capitalize shrink-0"
                      >
                        {c.status}
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title className="flex items-center gap-2 text-base">
              <Megaphone size={15} className="text-accent" />
              Open campaigns
            </Card.Title>
            <Link to="/dashboard/campaigns">
              <Button variant="ghost" size="sm">
                Browse all <ArrowRight size={12} />
              </Button>
            </Link>
          </Card.Header>
          <Separator />
          <Card.Content className="p-0">
            {campaigns.length === 0 ? (
              <EmptyState>
                <EmptyState.Media>
                  <Megaphone className="size-6" />
                </EmptyState.Media>
                <EmptyState.Title>No open campaigns</EmptyState.Title>
                <EmptyState.Description>Check back soon.</EmptyState.Description>
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {campaigns.slice(0, 5).map((c) => {
                  const brandName =
                    c.brand?.brandProfile?.company_name ||
                    c.brand?.email?.split('@')[0] ||
                    'Brand';
                  return (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar size="sm">
                          {c.brand?.brandProfile?.logo_url && (
                            <Avatar.Image
                              src={c.brand.brandProfile.logo_url}
                              alt={brandName}
                            />
                          )}
                          <Avatar.Fallback>
                            {brandName.slice(0, 2).toUpperCase()}
                          </Avatar.Fallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-foreground text-sm font-semibold truncate">
                            {c.title}
                          </div>
                          <div className="text-muted text-xs truncate">
                            {brandName}
                            {c.platform ? ` · ${c.platform}` : ''}
                          </div>
                        </div>
                      </div>
                      <Chip color="success" variant="soft" size="sm" className="shrink-0">
                        <DollarSign size={11} />
                        {c.budget_range || c.payout_range || formatBudget(c.budget)}
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* ─── Quick links footer ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Applications', icon: Briefcase, to: '/dashboard/campaigns' },
          { label: 'Contracts', icon: FileText, to: '/dashboard/contracts' },
          { label: 'Workspace', icon: Clock, to: '/dashboard/workspace' },
          { label: 'AI Studio', icon: Sparkles, to: '/dashboard/ai' },
        ].map((q) => {
          const Icon = q.icon;
          return (
            <Link key={q.to} to={q.to}>
              <Card className="h-full">
                <Card.Content className="p-4 flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground shrink-0">
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground text-sm font-semibold truncate">
                      {q.label}
                    </div>
                    <div className="text-muted text-xs">Open</div>
                  </div>
                  <ArrowUpRight size={13} className="text-muted shrink-0" />
                </Card.Content>
              </Card>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
};

export default CreatorDashboard;
