import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  Clock,
  DollarSign,
  FileText,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatBudget } from '../../lib/campaignFormat';
import { MetricCard, PageShell } from '../../components/ui';
import CampaignCard, { CampaignCardSkeleton } from '../../components/common/CampaignCard';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { accentFor } from '../talent/shared';

/**
 * BrandDashboard — the brand's overview: KPIs with 12-week sparklines,
 * what needs attention today, the latest briefs in the marketplace card
 * style, the applicant pipeline and the team.
 */
type Stats = {
  campaigns: { total: number; by_status: Record<string, number>; closing_soon: number };
  applications: { total: number; pending: number; shortlisted: number; accepted: number; rejected: number; other: number };
  budget: { committed_usd: number; active_usd: number };
  series: { weeks: string[]; campaigns: number[]; applications: number[]; accepted: number[] };
};

const memberName = (m: any): string =>
  m?.member?.creatorProfile?.full_name ||
  m?.member?.managerProfile?.full_name ||
  m?.member?.email?.split('@')[0] ||
  '—';
const memberAvatar = (m: any): string | undefined =>
  m?.member?.creatorProfile?.avatar_url || m?.member?.managerProfile?.avatar_url || undefined;

const BrandDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [brandName, setBrandName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    Promise.all([
      api.get('/campaigns/brand/stats'),
      api.get('/campaigns/mine'),
      api.get('/invitations/team').catch(() => ({ data: [] })),
      api.get('/invitations/sent').catch(() => ({ data: [] })),
      api.get('/brands/profile').catch(() => ({ data: null })),
    ])
      .then(([st, camps, teamRes, invRes, prof]) => {
        setStats(st.data);
        setCampaigns(Array.isArray(camps.data) ? camps.data : []);
        setTeam(Array.isArray(teamRes.data) ? teamRes.data : []);
        setPendingInvites((invRes.data || []).filter((i: any) => i.status === 'pending').length);
        setBrandName(prof.data?.company_name || '');
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const recent = useMemo(() => campaigns.slice(0, 3), [campaigns]);

  const attention = useMemo(() => {
    const items: { key: string; n: number; label: string; to: string; icon: React.ReactNode; tone: string }[] = [];
    const a = stats?.applications;
    const c = stats?.campaigns;
    if (a?.pending)
      items.push({ key: 'pending', n: a.pending, label: t('dash.attnPending'), to: '/dashboard/applications?status=pending', icon: <Users size={15} />, tone: '#ffb547' });
    if (c?.by_status?.draft)
      items.push({ key: 'draft', n: c.by_status.draft, label: t('dash.attnDrafts'), to: '/dashboard/campaigns?status=draft', icon: <FileText size={15} />, tone: '#6c63ff' });
    if (c?.closing_soon)
      items.push({ key: 'closing', n: c.closing_soon, label: t('dash.attnClosing'), to: '/dashboard/campaigns?status=active', icon: <Clock size={15} />, tone: '#ff7a45' });
    if (pendingInvites)
      items.push({ key: 'invites', n: pendingInvites, label: t('dash.attnInvites'), to: '/dashboard/invitations', icon: <Mail size={15} />, tone: '#00d4c7' });
    return items;
  }, [stats, pendingInvites, t]);

  const funnel = useMemo(() => {
    const a = stats?.applications;
    const rows = [
      { key: 'pending', n: a?.pending || 0, color: '#ffb547' },
      { key: 'shortlisted', n: a?.shortlisted || 0, color: '#6c63ff' },
      { key: 'accepted', n: a?.accepted || 0, color: '#16c784' },
      { key: 'rejected', n: a?.rejected || 0, color: '#c4cad8' },
    ];
    const max = Math.max(1, ...rows.map((r) => r.n));
    return { rows, max, total: a?.total || 0 };
  }, [stats]);

  const kpis = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        label={t('dash.kpiActiveCampaigns')}
        value={stats?.campaigns?.by_status?.active ?? 0}
        hint={t('dash.kpiOfTotal', { n: stats?.campaigns?.total ?? 0 })}
        series={stats?.series?.campaigns}
        icon={Briefcase}
        iconStatus={stats?.campaigns?.by_status?.active ? 'success' : undefined}
      />
      <MetricCard
        label={t('dash.kpiApplicants')}
        value={stats?.applications?.total ?? 0}
        hint={t('dash.kpiPendingN', { n: stats?.applications?.pending ?? 0 })}
        series={stats?.series?.applications}
        chartColor="var(--chart-1, #00d4c7)"
        icon={Users}
        iconStatus={stats?.applications?.pending ? 'warning' : undefined}
      />
      <MetricCard
        label={t('dash.kpiAccepted')}
        value={stats?.applications?.accepted ?? 0}
        hint={t('dash.kpiHired')}
        series={stats?.series?.accepted}
        chartColor="var(--color-signal-green, #16c784)"
        icon={Send}
        iconStatus="success"
      />
      <MetricCard
        label={t('dash.kpiBudget')}
        value={formatBudget(stats?.budget?.committed_usd ?? 0, 'USD')}
        hint={t('dash.kpiActiveBudget', { v: formatBudget(stats?.budget?.active_usd ?? 0, 'USD') })}
        icon={DollarSign}
      />
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('dash.welcome')}
      titleAccent={brandName || t('dash.welcomeAccent')}
      description={t('dash.overviewDesc')}
      icon={<LayoutDashboard size={18} />}
      actions={
        <>
          <Link to="/dashboard/talent">
            <Button variant="tertiary" size="md">
              <Star size={14} /> {t('dash.findTalent')}
            </Button>
          </Link>
          <Link to="/dashboard/campaigns?new=1">
            <Button variant="primary" size="md">
              <Plus size={14} /> {t('dash.newCampaign')}
            </Button>
          </Link>
        </>
      }
      stats={kpis}
    >
      {error && (
        <EmptyPanel
          tone="error"
          size="sm"
          icon={<AlertTriangle size={20} />}
          title={t('board.errTitle')}
          description={t('board.errDesc')}
          actions={
            <Button variant="primary" size="sm" onPress={() => { setLoading(true); load(); }}>
              {t('common.tryAgain')}
            </Button>
          }
        />
      )}

      {/* Needs attention */}
      {attention.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {attention.map((a) => (
            <Link key={a.key} to={a.to} className="v-talent-card p-3.5 flex items-center gap-3">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                style={{ background: `${a.tone}1f`, color: a.tone === '#c4cad8' ? '#4a5374' : a.tone }}
              >
                {a.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="v-ink font-medium tabular-nums" style={{ fontSize: 18, letterSpacing: '-0.015em', lineHeight: 1.1 }}>
                  {a.n}
                </div>
                <div className="v-caption v-muted truncate" style={{ fontSize: 12 }}>{a.label}</div>
              </div>
              <ArrowRight size={14} className="v-quiet shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent campaigns */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
              <Megaphone size={15} style={{ color: 'var(--color-campaign-purple)' }} /> {t('dash.recentCampaigns')}
            </h2>
            <Link to="/dashboard/campaigns">
              <Button variant="ghost" size="sm">
                {t('dash.seeAll')} <ArrowRight size={11} />
              </Button>
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <CampaignCardSkeleton key={i} />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyPanel
              icon={<Megaphone size={22} />}
              title={t('dash.noCampaignsTitle')}
              description={t('dash.noCampaignsDesc')}
              actions={
                <Link to="/dashboard/campaigns?new=1">
                  <Button variant="primary">
                    <Plus size={13} /> {t('dash.createFirst')}
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recent.map((camp, i) => (
                <CampaignCard
                  key={camp.id}
                  camp={camp}
                  index={i}
                  applied={false}
                  loggedIn
                  isCreator={false}
                  onApply={() => {}}
                  variant="owner"
                  onOpen={(c) => navigate(`/dashboard/applications?campaign=${c.id}`)}
                  actions={
                    <Button
                      variant={Number(camp.pending_count) > 0 ? 'primary' : 'tertiary'}
                      size="sm"
                      onPress={() => navigate(`/dashboard/applications?campaign=${camp.id}`)}
                    >
                      <Users size={11} />{' '}
                      {Number(camp.pending_count) > 0
                        ? t('dash.reviewN', { n: Number(camp.pending_count) })
                        : t('dash.applicantsN', { n: Number(camp.applicants_count) || 0 })}
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Pipeline + team */}
        <aside className="space-y-5">
          <div className="v-talent-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 15 }}>
                <Users size={14} style={{ color: 'var(--color-campaign-purple)' }} /> {t('dash.pipeline')}
              </h2>
              <span className="v-caption v-quiet tabular-nums" style={{ fontSize: 11.5 }}>
                {t('dash.pipelineTotal', { n: funnel.total })}
              </span>
            </div>
            {funnel.total === 0 && !loading ? (
              <EmptyPanel
                size="sm"
                icon={<Users size={18} />}
                title={t('dash.noApplicantsTitle')}
                description={t('dash.noApplicantsDesc')}
              />
            ) : (
              <ul className="space-y-2.5">
                {funnel.rows.map((r) => (
                  <li key={r.key}>
                    <div className="flex items-center justify-between v-caption mb-1" style={{ fontSize: 12 }}>
                      <span className="v-ink font-medium">{t(`appStatus.${r.key}`)}</span>
                      <span className="v-quiet tabular-nums">{r.n}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-cool-gray)' }}>
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${Math.max(r.n ? 6 : 0, (r.n / funnel.max) * 100)}%`,
                          background: r.key === 'shortlisted' ? 'var(--gradient-signature)' : r.color,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/dashboard/applications" className="block mt-3">
              <Button variant="tertiary" size="sm" fullWidth>
                {t('dash.openInbox')} <ArrowRight size={11} />
              </Button>
            </Link>
          </div>

          <div className="v-talent-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 15 }}>
                <Star size={14} style={{ color: 'var(--color-campaign-purple)' }} /> {t('dash.team')}
              </h2>
              <Link to="/dashboard/my-team">
                <Button variant="ghost" size="sm">
                  {t('dash.manage')} <ArrowRight size={11} />
                </Button>
              </Link>
            </div>
            {!loading && team.length === 0 ? (
              <EmptyPanel
                size="sm"
                icon={<Users size={18} />}
                title={t('dash.noTeamTitle')}
                description={t('dash.noTeamDesc')}
                actions={
                  <Link to="/dashboard/talent">
                    <Button variant="primary" size="sm">
                      <Star size={12} /> {t('dash.browseTalent')}
                    </Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {team.slice(0, 5).map((m) => {
                  const name = memberName(m);
                  const avatar = memberAvatar(m);
                  const accent = accentFor(String(m.member?.id || name));
                  return (
                    <li key={m.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="v-story-ring" style={{ padding: 2 }}>
                        {avatar ? (
                          <img src={avatar} alt="" className="h-8 w-8 object-cover" />
                        ) : (
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center text-xs font-medium text-white"
                            style={{ background: accent.from }}
                          >
                            {name[0]?.toUpperCase()}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="v-ink font-medium truncate" style={{ fontSize: 13 }}>{name}</div>
                        <div className="v-caption v-quiet capitalize" style={{ fontSize: 11 }}>
                          {m.member_type === 'manager' ? t('talent.managerFallback') : t('talent.creatorFallback')}
                        </div>
                      </div>
                      {m.payment_amount ? (
                        <Chip color="success" variant="soft" size="sm">
                          <Chip.Label className="tabular-nums">{formatBudget(m.payment_amount, m.currency || 'USD')}</Chip.Label>
                        </Chip>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { to: '/dashboard/applications', icon: <Users size={16} />, title: t('dash.qlInbox'), desc: t('dash.qlInboxDesc') },
          { to: '/dashboard/messages', icon: <MessageSquare size={16} />, title: t('dash.qlMessages'), desc: t('dash.qlMessagesDesc') },
          { to: '/dashboard/analytics', icon: <BarChart3 size={16} />, title: t('dash.qlAnalytics'), desc: t('dash.qlAnalyticsDesc') },
          { to: '/dashboard/ai', icon: <Sparkles size={16} />, title: t('dash.qlAi'), desc: t('dash.qlAiDesc') },
        ].map((q) => (
          <Link key={q.to} to={q.to} className="v-talent-card p-4 flex items-center gap-3">
            <span className="v-hero-icon" style={{ width: 36, height: 36, borderRadius: 11 }}>{q.icon}</span>
            <div className="min-w-0">
              <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{q.title}</div>
              <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>{q.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
};

export default BrandDashboard;
