import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  DollarSign,
  FileText,
  LayoutDashboard,
  Megaphone,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { Avatar, Button, Card, Chip, Separator } from '@heroui/react';
import { EmptyState, KPI } from '@heroui-pro/react';
import api from '../../lib/api';
import { PageShell } from '../../components/ui';

type Stats = {
  totalUsers?: number;
  totalCreators?: number;
  totalBrands?: number;
  totalManagers?: number;
  totalAdmins?: number;
  activeCampaigns?: number;
  totalApplications?: number;
  totalPayoutAmount?: number;
};

type Application = {
  id: string;
  status: string;
  campaign?: { title?: string };
  creator?: {
    email?: string;
    creatorProfile?: { avatar_url?: string };
  };
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  accepted: 'success',
  rejected: 'danger',
  pending: 'warning',
  refunded: 'warning',
};

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats').catch(() => ({ data: null })),
      api.get('/admin/applications').catch(() => ({ data: [] })),
    ]).then(([statsRes, appsRes]) => {
      setStats(statsRes.data);
      setRecentApps((appsRes.data || []).slice(0, 5));
      setLoading(false);
    });
  }, []);

  const userPie = useMemo(
    () => [
      { name: 'Creators', value: stats?.totalCreators || 0 },
      { name: 'Brands', value: stats?.totalBrands || 0 },
      { name: 'Managers', value: stats?.totalManagers || 0 },
      { name: 'Admins', value: stats?.totalAdmins || 0 },
    ],
    [stats]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageShell
      title="Platform overview"
      description="Real-time view of all users, campaigns, and financials."
      icon={<LayoutDashboard size={18} />}
      eyebrow={
        <span className="inline-flex items-center gap-1.5">
          <Shield size={11} /> Admin control center
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          <Link to="/dashboard/site-control">
            <Button variant="tertiary" size="md">
              <Settings size={14} /> Site control
            </Button>
          </Link>
          <Link to="/dashboard/users">
            <Button variant="primary" size="md">
              <Users size={14} /> Manage users
            </Button>
          </Link>
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI>
          <KPI.Header>
            <KPI.Title>Total users</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value
              value={stats?.totalUsers || 0}
              maximumFractionDigits={0}
            />
            <KPI.Trend trend={(stats?.totalUsers || 0) > 0 ? 'up' : 'neutral'}>
              All roles combined
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Active campaigns</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value
              value={stats?.activeCampaigns || 0}
              maximumFractionDigits={0}
            />
            <KPI.Trend
              trend={(stats?.activeCampaigns || 0) > 0 ? 'up' : 'neutral'}
            >
              Live right now
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Applications</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value
              value={stats?.totalApplications || 0}
              maximumFractionDigits={0}
            />
            <KPI.Trend trend="neutral">Across all campaigns</KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Total payouts</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value
              value={stats?.totalPayoutAmount || 0}
              style="currency"
              currency="USD"
              notation="compact"
              maximumFractionDigits={1}
            />
            <KPI.Trend
              trend={(stats?.totalPayoutAmount || 0) > 0 ? 'up' : 'neutral'}
            >
              Lifetime disbursed
            </KPI.Trend>
          </KPI.Content>
        </KPI>
      </div>

      {/* User roles pie + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <Card.Header>
            <Card.Title className="inline-flex items-center gap-2 text-base">
              <Users size={15} className="text-accent" /> User roles
            </Card.Title>
            <Card.Description>Distribution by account type</Card.Description>
          </Card.Header>
          <Separator />
          <Card.Content className="p-4 space-y-3">
            {userPie.map((row, i) => {
              const total =
                userPie.reduce((s, r) => s + r.value, 0) || 1;
              const pct = Math.round((row.value / total) * 100);
              const colors = [
                'bg-accent',
                'bg-success',
                'bg-warning',
                'bg-foreground',
              ];
              return (
                <div key={row.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="inline-flex items-center gap-2 text-foreground text-sm font-medium">
                      <span
                        className={`inline-block size-2 rounded-full ${colors[i]}`}
                      />
                      {row.name}
                    </span>
                    <span className="text-muted text-xs tabular-nums">
                      {row.value} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[i]} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </Card.Content>
        </Card>

        <Card className="lg:col-span-2">
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title className="inline-flex items-center gap-2 text-base">
              <Activity size={15} className="text-accent" /> Recent applications
            </Card.Title>
            <Link to="/dashboard/applications">
              <Button variant="tertiary" size="sm">
                View all <ArrowRight size={11} />
              </Button>
            </Link>
          </Card.Header>
          <Separator />
          <Card.Content className="p-0">
            {recentApps.length === 0 ? (
              <div className="p-6">
                <EmptyState>
                  <EmptyState.Media>
                    <FileText className="size-7" />
                  </EmptyState.Media>
                  <EmptyState.Title>No applications yet</EmptyState.Title>
                  <EmptyState.Description>
                    Application activity will appear here.
                  </EmptyState.Description>
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentApps.map((app) => {
                  const email = app.creator?.email || 'Creator';
                  const initial = email[0].toUpperCase();
                  return (
                    <li
                      key={app.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <Avatar size="sm">
                        {app.creator?.creatorProfile?.avatar_url && (
                          <Avatar.Image
                            src={app.creator.creatorProfile.avatar_url}
                            alt={email}
                          />
                        )}
                        <Avatar.Fallback>{initial}</Avatar.Fallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground text-sm font-semibold truncate">
                          {email}
                        </div>
                        <div className="text-muted text-xs truncate">
                          {app.campaign?.title || 'Campaign'}
                        </div>
                      </div>
                      <Chip
                        color={STATUS_COLOR[app.status] || 'default'}
                        variant="soft"
                        size="sm"
                      >
                        <Chip.Label className="capitalize">
                          {app.status}
                        </Chip.Label>
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Link to="/dashboard/campaigns">
          <Card className="hover:border-accent/40 transition-colors h-full">
            <Card.Content className="p-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-accent-soft text-accent-soft-foreground">
                <Megaphone size={17} />
              </span>
              <div>
                <div className="text-foreground text-sm font-semibold">
                  Campaigns
                </div>
                <div className="text-muted text-xs">Moderate listings</div>
              </div>
            </Card.Content>
          </Card>
        </Link>
        <Link to="/dashboard/payouts">
          <Card className="hover:border-accent/40 transition-colors h-full">
            <Card.Content className="p-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-accent-soft text-accent-soft-foreground">
                <DollarSign size={17} />
              </span>
              <div>
                <div className="text-foreground text-sm font-semibold">
                  Payouts
                </div>
                <div className="text-muted text-xs">Approve & execute</div>
              </div>
            </Card.Content>
          </Card>
        </Link>
        <Link to="/dashboard/support">
          <Card className="hover:border-accent/40 transition-colors h-full">
            <Card.Content className="p-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-accent-soft text-accent-soft-foreground">
                <Shield size={17} />
              </span>
              <div>
                <div className="text-foreground text-sm font-semibold">
                  Support
                </div>
                <div className="text-muted text-xs">Verifications queue</div>
              </div>
            </Card.Content>
          </Card>
        </Link>
        <Link to="/dashboard/analytics">
          <Card className="hover:border-accent/40 transition-colors h-full">
            <Card.Content className="p-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-accent-soft text-accent-soft-foreground">
                <Activity size={17} />
              </span>
              <div>
                <div className="text-foreground text-sm font-semibold">
                  Analytics
                </div>
                <div className="text-muted text-xs">Platform trends</div>
              </div>
            </Card.Content>
          </Card>
        </Link>
      </div>
    </PageShell>
  );
};

export default AdminDashboard;
