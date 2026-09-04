import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart2,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  Headphones,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { weekSeries, weekSums, withinDays } from '../../lib/series';
import { postedLabel } from '../../lib/campaignFormat';
import { APPLICATION_STATUS_COLOR, CAMPAIGN_STATUS_COLOR, normalizeApplicationStatus, normalizeCampaignStatus } from '../../lib/catalog';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { StoryAvatar } from '../../components/common/StoryAvatar';
import { ALL_ROLES, SectionTitle, dateTime, money, userIdentity, type AdminUser } from './shared';

/**
 * AdminDashboard — the platform at a glance: who is on it, what is live,
 * what money is moving, and (above all) the queues that need a human
 * today — validations, payouts, tickets, follower claims, manager changes.
 */
const ROLE_TONE: Record<string, string> = {
  creator: '#6c63ff',
  brand: '#16c784',
  manager: '#ffb547',
  admin: '#ff5a5f',
  support: '#00d4c7',
  finance: '#4f7cff',
};

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [me, setMe] = useState<any>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [ticketStats, setTicketStats] = useState<any>({});
  const [claims, setClaims] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    const arr = (r: any) => (Array.isArray(r?.data) ? r.data : []);
    Promise.all([
      api.get('/auth/me').catch(() => ({ data: null })),
      api.get('/admin/users'),
      api.get('/admin/campaigns').catch(() => ({ data: [] })),
      api.get('/admin/applications').catch(() => ({ data: [] })),
      api.get('/admin/payouts').catch(() => ({ data: [] })),
      api.get('/admin/users/pending').catch(() => ({ data: [] })),
      api.get('/support/tickets/stats').catch(() => ({ data: {} })),
      api.get('/creators/admin/follower-claims', { params: { status: 'pending' } }).catch(() => ({ data: [] })),
      api.get('/managers/admin/feedback').catch(() => ({ data: [] })),
      api.get('/admin/audit-logs').catch(() => ({ data: [] })),
    ])
      .then(([meRes, u, c, a, p, pu, ts, cl, fb, al]) => {
        setMe(meRes.data);
        setUsers(arr(u));
        setCampaigns(arr(c));
        setApplications(arr(a));
        setPayouts(arr(p));
        setPendingUsers(arr(pu));
        setTicketStats(ts.data || {});
        setClaims(arr(cl));
        setFeedbacks(arr(fb).filter((f: any) => f.status === 'pending'));
        setAudit(arr(al));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const firstName = (me?.display_name || '').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('cdash.morning') : hour < 18 ? t('cdash.afternoon') : t('cdash.evening');

  const liveCampaigns = useMemo(() => campaigns.filter((c) => normalizeCampaignStatus(c.status) === 'active'), [campaigns]);
  const pendingApps = useMemo(() => applications.filter((a) => normalizeApplicationStatus(a.status) === 'pending'), [applications]);
  const pendingPayouts = useMemo(() => payouts.filter((p) => p.status === 'pending' || p.status === 'approved'), [payouts]);
  const paidVolume = useMemo(() => payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + (Number(p.amount) || 0), 0), [payouts]);
  const newUsers7d = useMemo(() => withinDays(users, 7), [users]);

  const series = useMemo(
    () => ({
      users: weekSeries(users),
      campaigns: weekSeries(campaigns),
      applications: weekSeries(applications),
      payouts: weekSums(payouts, (p) => p.status === 'paid'),
    }),
    [users, campaigns, applications, payouts],
  );

  const mix = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) counts[String(u.role || '').toLowerCase()] = (counts[String(u.role || '').toLowerCase()] || 0) + 1;
    const total = users.length || 1;
    return ALL_ROLES.map((r) => ({ role: r, n: counts[r] || 0, pct: Math.round(((counts[r] || 0) / total) * 100) })).filter((x) => x.n > 0);
  }, [users]);

  const attention = useMemo(() => {
    const items: { key: string; n: number; label: string; to: string; icon: React.ReactNode; tone: string }[] = [];
    if (pendingUsers.length) items.push({ key: 'kyc', n: pendingUsers.length, label: t('adm.dash.attnValidations'), to: '/dashboard/support', icon: <UserCheck size={15} />, tone: '#6c63ff' });
    if (pendingPayouts.length) items.push({ key: 'pay', n: pendingPayouts.length, label: t('adm.dash.attnPayouts'), to: '/dashboard/payouts', icon: <DollarSign size={15} />, tone: '#16c784' });
    if (ticketStats.open) items.push({ key: 'tix', n: ticketStats.open, label: t('adm.dash.attnTickets'), to: '/dashboard/support', icon: <Headphones size={15} />, tone: '#ff7a45' });
    if (claims.length) items.push({ key: 'claims', n: claims.length, label: t('adm.dash.attnClaims'), to: '/dashboard/follower-claims', icon: <BadgeCheck size={15} />, tone: '#00d4c7' });
    if (feedbacks.length) items.push({ key: 'fb', n: feedbacks.length, label: t('adm.dash.attnManagerChanges'), to: '/dashboard/support', icon: <AlertTriangle size={15} />, tone: '#ffb547' });
    return items;
  }, [pendingUsers, pendingPayouts, ticketStats, claims, feedbacks, t]);

  const kpis = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label={t('adm.dash.kpiUsers')} value={users.length} hint={t('adm.dash.kpiUsersHint', { n: newUsers7d })} series={series.users} icon={Users} iconStatus={newUsers7d ? 'success' : undefined} />
      <MetricCard label={t('adm.dash.kpiLive')} value={liveCampaigns.length} hint={t('dash.kpiOfTotal', { n: campaigns.length })} series={series.campaigns} chartColor="var(--chart-1, #00d4c7)" icon={Briefcase} />
      <MetricCard label={t('adm.dash.kpiApplications')} value={applications.length} hint={t('dash.kpiPendingN', { n: pendingApps.length })} series={series.applications} chartColor="var(--color-signal-green, #16c784)" icon={FileText} iconStatus={pendingApps.length ? 'warning' : undefined} />
      <MetricCard label={t('adm.dash.kpiPaid')} value={money(paidVolume)} hint={t('adm.dash.kpiPaidHint', { n: pendingPayouts.length })} series={series.payouts} chartColor="#ffb547" icon={DollarSign} iconStatus={pendingPayouts.length ? 'warning' : 'success'} />
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={`${greeting},`}
      titleAccent={firstName || t('side.roleAdmin')}
      description={t('adm.dash.desc')}
      icon={<LayoutDashboard size={18} />}
      actions={
        <>
          <Link to="/dashboard/site-control">
            <Button variant="tertiary" size="md">
              <Settings size={13} /> {t('side.siteControl')}
            </Button>
          </Link>
          <Link to="/dashboard/users">
            <Button variant="primary" size="md">
              <Users size={14} /> {t('adm.dash.manageUsers')}
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
          title={t('adm.errTitle')}
          description={t('adm.errDesc')}
          actions={<Button variant="primary" size="sm" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>}
        />
      )}

      {/* Needs a human today */}
      {!loading && !error && (attention.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {attention.map((a) => (
            <Link key={a.key} to={a.to} className="v-talent-card p-3.5 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: `${a.tone}1f`, color: a.tone }}>{a.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="v-ink font-medium tabular-nums" style={{ fontSize: 18, letterSpacing: '-0.015em', lineHeight: 1.1 }}>{a.n}</div>
                <div className="v-caption v-muted line-clamp-2" style={{ fontSize: 11.5, lineHeight: 1.25 }}>{a.label}</div>
              </div>
              <ArrowRight size={14} className="v-quiet shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyPanel tone="success" size="sm" icon={<CheckCircle2 size={20} />} title={t('adm.dash.clearTitle')} description={t('adm.dash.clearDesc')} />
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 space-y-5">
          {/* Recent applications */}
          <div>
            <SectionTitle
              icon={<FileText size={15} />}
              action={
                <Link to="/dashboard/applications">
                  <Button variant="ghost" size="sm">{t('dash.seeAll')} <ArrowRight size={11} /></Button>
                </Link>
              }
            >
              {t('adm.dash.recentApps')}
            </SectionTitle>
            {loading ? (
              <div className="v-talent-card p-4" aria-hidden><div className="v-skel h-4 w-1/3 mb-2" /><div className="v-skel h-3 w-2/3" /></div>
            ) : applications.length === 0 ? (
              <EmptyPanel icon={<FileText size={22} />} title={t('adm.dash.noAppsTitle')} description={t('adm.dash.noAppsDesc')} />
            ) : (
              <ul className="v-talent-card divide-y divide-border">
                {applications.slice(0, 6).map((a) => {
                  const who = userIdentity(a.creator);
                  const status = normalizeApplicationStatus(a.status);
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <StoryAvatar src={who.avatar} name={who.name || a.creator?.email} seed={a.creator?.id || a.id} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{who.name || a.creator?.email}</div>
                        <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                          {a.campaign?.title || t('dash.campaign')} · {a.campaign?.brand?.brandProfile?.company_name || a.campaign?.brand?.email?.split('@')[0] || ''} · {postedLabel(a.created_at)}
                        </div>
                      </div>
                      <Chip color={APPLICATION_STATUS_COLOR[status]} variant="soft" size="sm">
                        <Chip.Label>{t(`appStatus.${status}`, { defaultValue: status })}</Chip.Label>
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Recent campaigns */}
          <div>
            <SectionTitle
              icon={<Briefcase size={15} />}
              action={
                <Link to="/dashboard/campaigns">
                  <Button variant="ghost" size="sm">{t('dash.seeAll')} <ArrowRight size={11} /></Button>
                </Link>
              }
            >
              {t('dash.recentCampaigns')}
            </SectionTitle>
            {loading ? (
              <div className="v-talent-card p-4" aria-hidden><div className="v-skel h-4 w-1/3 mb-2" /><div className="v-skel h-3 w-2/3" /></div>
            ) : campaigns.length === 0 ? (
              <EmptyPanel icon={<Briefcase size={22} />} title={t('adm.dash.noCampsTitle')} description={t('adm.dash.noCampsDesc')} />
            ) : (
              <ul className="v-talent-card divide-y divide-border">
                {campaigns.slice(0, 5).map((c) => {
                  const who = userIdentity(c.brand);
                  const status = normalizeCampaignStatus(c.status);
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <StoryAvatar src={who.avatar} name={who.name || c.brand?.email} seed={c.brand?.id || c.id} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{c.title}</div>
                        <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                          {who.name || c.brand?.email} · {money(c.budget, c.currency || 'USD')} · {postedLabel(c.created_at)}
                        </div>
                      </div>
                      <Chip color={CAMPAIGN_STATUS_COLOR[status]} variant="soft" size="sm">
                        <Chip.Label>{t(`status.${status}`, { defaultValue: status })}</Chip.Label>
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          {/* Community mix */}
          <div className="v-talent-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 15 }}>
                <Users size={14} style={{ color: 'var(--color-campaign-purple)' }} /> {t('adm.dash.mix')}
              </h2>
              <span className="v-caption v-quiet tabular-nums" style={{ fontSize: 12 }}>{t('dash.pipelineTotal', { n: users.length })}</span>
            </div>
            {loading ? (
              <div className="space-y-2" aria-hidden><div className="v-skel h-3 w-full" /><div className="v-skel h-3 w-4/5" /><div className="v-skel h-3 w-3/5" /></div>
            ) : (
              <div className="space-y-2.5">
                {mix.map((m) => (
                  <div key={m.role}>
                    <div className="flex items-center justify-between mb-1 v-caption" style={{ fontSize: 12 }}>
                      <span className="inline-flex items-center gap-2 v-ink font-medium">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: ROLE_TONE[m.role] }} />
                        {t(`adm.roles.${m.role}`)}
                      </span>
                      <span className="v-quiet tabular-nums">{m.n} · {m.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-cool-gray)' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.pct}%`, background: ROLE_TONE[m.role] }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Health */}
          <div className="v-talent-card p-4">
            <h2 className="v-ink font-medium inline-flex items-center gap-2 mb-3" style={{ fontSize: 15 }}>
              <Activity size={14} style={{ color: 'var(--color-campaign-purple)' }} /> {t('adm.dash.health')}
            </h2>
            <dl className="grid grid-cols-2 gap-2 v-caption" style={{ fontSize: 12 }}>
              <div className="rounded-lg p-2.5" style={{ background: 'var(--color-cool-gray)' }}>
                <dt className="v-quiet">{t('adm.dash.hActive')}</dt>
                <dd className="v-ink font-medium tabular-nums">{users.filter((u) => u.account_status === 'active').length}</dd>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: 'var(--color-cool-gray)' }}>
                <dt className="v-quiet">{t('adm.dash.hBanned')}</dt>
                <dd className="v-ink font-medium tabular-nums">{users.filter((u) => u.is_banned).length}</dd>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: 'var(--color-cool-gray)' }}>
                <dt className="v-quiet">{t('adm.dash.hTickets')}</dt>
                <dd className="v-ink font-medium tabular-nums">{ticketStats.resolved || 0} / {ticketStats.total || 0}</dd>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: 'var(--color-cool-gray)' }}>
                <dt className="v-quiet">{t('adm.dash.hPending')}</dt>
                <dd className="v-ink font-medium tabular-nums">{users.filter((u) => u.account_status === 'pending_verification').length}</dd>
              </div>
            </dl>
          </div>

          {/* Staff activity */}
          <div className="v-talent-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 15 }}>
                <ClipboardList size={14} style={{ color: 'var(--color-campaign-purple)' }} /> {t('adm.dash.activity')}
              </h2>
              <Link to="/dashboard/payouts">
                <Button variant="ghost" size="sm">{t('dash.seeAll')} <ArrowRight size={11} /></Button>
              </Link>
            </div>
            {!loading && audit.length === 0 ? (
              <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('adm.dash.noActivity')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {audit.slice(0, 4).map((l) => {
                  let d: any = {};
                  try { d = JSON.parse(l.details || '{}'); } catch { /* raw */ }
                  return (
                    <li key={l.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="v-ink font-medium truncate" style={{ fontSize: 12.5 }}>{t(`adm.audit.${l.action}`, { defaultValue: String(l.action || '').replace(/_/g, ' ').toLowerCase() })}</span>
                        {d.amount && <span className="v-caption v-quiet tabular-nums shrink-0" style={{ fontSize: 11.5 }}>{money(d.amount)}</span>}
                      </div>
                      <div className="v-caption v-quiet truncate" style={{ fontSize: 11 }}>{l.user?.email || t('adm.audit.system')} · {dateTime(l.created_at)}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { to: '/dashboard/campaigns', icon: <Briefcase size={16} />, title: t('side.campaigns'), desc: t('adm.dash.qlCampaigns') },
          { to: '/dashboard/payouts', icon: <DollarSign size={16} />, title: t('side.payouts'), desc: t('adm.dash.qlPayouts') },
          { to: '/dashboard/support', icon: <Headphones size={16} />, title: t('side.support'), desc: t('adm.dash.qlSupport') },
          { to: '/dashboard/follower-claims', icon: <ShieldCheck size={16} />, title: t('side.followerClaims'), desc: t('adm.dash.qlClaims') },
          { to: '/dashboard/site-control', icon: <Settings size={16} />, title: t('side.siteControl'), desc: t('shell.promoAdminCta') },
          { to: '/dashboard/analytics', icon: <BarChart2 size={16} />, title: t('side.analytics'), desc: t('adm.dash.qlAnalytics') },
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

export default AdminDashboard;
