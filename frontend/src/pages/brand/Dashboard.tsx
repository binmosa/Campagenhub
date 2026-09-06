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
import { formatBudget, postedLabel } from '../../lib/campaignFormat';
import { APPLICATION_STATUS_COLOR, CAMPAIGN_STATUS_COLOR, normalizeApplicationStatus, normalizeCampaignStatus } from '../../lib/catalog';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { DashPanel, PanelEmpty, PanelRow, PanelRows, PanelRowsSkeleton } from '../../components/common/DashPanel';
import { StoryAvatar } from '../../components/common/StoryAvatar';

/**
 * BrandDashboard — the brand's overview: KPIs with 12-week sparklines,
 * what needs attention today, the latest briefs in the marketplace card
 * style, the applicant pipeline and the team.
 */
type Stats = {
  campaigns: { total: number; by_status: Record<string, number>; closing_soon: number };
  applications: { total: number; pending: number; shortlisted: number; offered?: number; accepted: number; rejected: number; other: number };
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
  const [applications, setApplications] = useState<any[]>([]);
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
      api.get('/applications').catch(() => ({ data: [] })),
    ])
      .then(([st, camps, teamRes, invRes, prof, apps]) => {
        setStats(st.data);
        setCampaigns(Array.isArray(camps.data) ? camps.data : []);
        setTeam(Array.isArray(teamRes.data) ? teamRes.data : []);
        setPendingInvites((invRes.data || []).filter((i: any) => i.status === 'pending').length);
        setBrandName(prof.data?.company_name || '');
        setApplications(Array.isArray(apps.data) ? apps.data : []);
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
      { key: 'offered', n: (a as any)?.offered || 0, color: '#00d4c7' },
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

      {/* Home grid — every block is a DashPanel so both columns share one frame
          and each row stretches its two panels to the same height. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Row 1 — recent campaigns · applicant pipeline */}
        <DashPanel
          className="lg:col-span-2"
          icon={<Megaphone size={15} />}
          title={t('dash.recentCampaigns')}
          action={
            <Link to="/dashboard/campaigns">
              <Button variant="ghost" size="sm">
                {t('dash.seeAll')} <ArrowRight size={11} />
              </Button>
            </Link>
          }
        >
          {loading ? (
            <PanelRowsSkeleton n={3} />
          ) : recent.length === 0 ? (
            <PanelEmpty
              icon={<Megaphone size={16} />}
              title={t('dash.noCampaignsTitle')}
              desc={t('dash.noCampaignsDesc')}
              action={
                <Link to="/dashboard/campaigns?new=1">
                  <Button variant="primary" size="sm">
                    <Plus size={13} /> {t('dash.createFirst')}
                  </Button>
                </Link>
              }
            />
          ) : (
            <PanelRows>
              {recent.map((camp) => {
                const st = normalizeCampaignStatus(camp.status);
                const pending = Number(camp.pending_count) || 0;
                const sub = [camp.platform, postedLabel(camp.created_at), t('dash.applicantsN', { n: Number(camp.applicants_count) || 0 })].filter(Boolean).join(' · ');
                return (
                  <PanelRow
                    key={camp.id}
                    leading={
                      camp.cover_image ? (
                        <img src={camp.cover_image} alt="" className="h-9 w-9 rounded-[11px] object-cover" />
                      ) : (
                        <span className="v-hero-icon" style={{ width: 36, height: 36, borderRadius: 11 }}>
                          <Megaphone size={15} />
                        </span>
                      )
                    }
                    title={camp.title}
                    sub={sub}
                    trailing={
                      <>
                        {camp.budget != null && (
                          <span className="v-ink font-medium tabular-nums hidden sm:inline" style={{ fontSize: 13, color: '#0b6e3e' }}>
                            {formatBudget(camp.budget, camp.currency || 'USD')}
                          </span>
                        )}
                        <Chip color={CAMPAIGN_STATUS_COLOR[st]} variant="soft" size="sm">
                          <Chip.Label>{t(`status.${st}`, { defaultValue: st })}</Chip.Label>
                        </Chip>
                        <Button variant={pending > 0 ? 'primary' : 'tertiary'} size="sm" onPress={() => navigate(`/dashboard/applications?campaign=${camp.id}`)}>
                          <Users size={11} /> {pending > 0 ? t('dash.reviewN', { n: pending }) : t('dash.viewApplicants')}
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </PanelRows>
          )}
        </DashPanel>

        <DashPanel icon={<Users size={15} />} title={t('dash.pipeline')} meta={t('dash.pipelineTotal', { n: funnel.total })}>
          {funnel.total === 0 && !loading ? (
            <PanelEmpty icon={<Users size={16} />} title={t('dash.noApplicantsTitle')} desc={t('dash.noApplicantsDesc')} />
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
          <Link to="/dashboard/applications" className="block mt-auto pt-4">
            <Button variant="tertiary" size="sm" fullWidth>
              {t('dash.openInbox')} <ArrowRight size={11} />
            </Button>
          </Link>
        </DashPanel>

        {/* Row 2 — latest applicants · team */}
        <DashPanel
          className="lg:col-span-2"
          icon={<Briefcase size={15} />}
          title={t('dash.latestApplicants')}
          meta={stats?.applications?.pending ? t('dash.toReviewN', { count: stats.applications.pending }) : undefined}
          action={
            <Link to="/dashboard/applications">
              <Button variant="ghost" size="sm">
                {t('dash.seeAll')} <ArrowRight size={11} />
              </Button>
            </Link>
          }
        >
          {loading ? (
            <PanelRowsSkeleton n={3} />
          ) : applications.length === 0 ? (
            <PanelEmpty icon={<Briefcase size={16} />} title={t('dash.noApplicantsTitle')} desc={t('dash.noRecentApplicantsDesc')} />
          ) : (
            <PanelRows>
              {[...applications]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 4)
                .map((a) => {
                  const st = normalizeApplicationStatus(a.status);
                  const cp = a.creator?.creatorProfile || {};
                  const name = cp.full_name || a.creator?.email?.split('@')[0] || '—';
                  const sub = [a.campaign?.title, cp.category, postedLabel(a.created_at)].filter(Boolean).join(' · ');
                  return (
                    <PanelRow
                      key={a.id}
                      leading={<StoryAvatar src={cp.avatar_url} name={name} seed={a.creator?.id || name} size={36} />}
                      title={name}
                      sub={sub}
                      trailing={
                        <>
                          <Chip color={APPLICATION_STATUS_COLOR[st]} variant="soft" size="sm">
                            <Chip.Label>{t(`appStatus.${st}`)}</Chip.Label>
                          </Chip>
                          <Button variant={st === 'pending' ? 'primary' : 'tertiary'} size="sm" onPress={() => navigate(`/dashboard/applications?campaign=${a.campaign?.id || ''}`)}>
                            {t('dash.review')}
                          </Button>
                        </>
                      }
                    />
                  );
                })}
            </PanelRows>
          )}
        </DashPanel>

        <DashPanel
          icon={<Star size={15} />}
          title={t('dash.team')}
          action={
            <Link to="/dashboard/my-team">
              <Button variant="ghost" size="sm">
                {t('dash.manage')} <ArrowRight size={11} />
              </Button>
            </Link>
          }
        >
          {loading ? (
            <PanelRowsSkeleton n={3} />
          ) : team.length === 0 ? (
            <PanelEmpty
              icon={<Users size={16} />}
              title={t('dash.noTeamTitle')}
              desc={t('dash.noTeamDesc')}
              action={
                <Link to="/dashboard/talent">
                  <Button variant="primary" size="sm">
                    <Star size={12} /> {t('dash.browseTalent')}
                  </Button>
                </Link>
              }
            />
          ) : (
            <PanelRows>
              {team.slice(0, 5).map((m) => {
                const name = memberName(m);
                return (
                  <PanelRow
                    key={m.id}
                    leading={<StoryAvatar src={memberAvatar(m)} name={name} seed={String(m.member?.id || name)} size={36} />}
                    title={name}
                    sub={m.member_type === 'manager' ? t('talent.managerFallback') : t('talent.creatorFallback')}
                    trailing={
                      m.payment_amount ? (
                        <Chip color="success" variant="soft" size="sm">
                          <Chip.Label className="tabular-nums">{formatBudget(m.payment_amount, m.currency || 'USD')}</Chip.Label>
                        </Chip>
                      ) : undefined
                    }
                  />
                );
              })}
            </PanelRows>
          )}
        </DashPanel>
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
