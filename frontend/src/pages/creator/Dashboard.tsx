import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Pencil,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatBudget, postedLabel } from '../../lib/campaignFormat';
import { APPLICATION_STATUS_COLOR, normalizeApplicationStatus } from '../../lib/catalog';
import { MetricCard, PageShell } from '../../components/ui';
import CampaignCard, { CampaignCardSkeleton } from '../../components/common/CampaignCard';
import { EmptyPanel } from '../../components/common/EmptyPanel';

/**
 * CreatorDashboard — the creator's overview: application funnel with
 * 12-week sparklines, earnings, what needs a reply today, briefs picked
 * for their country, and profile completeness.
 */
const WEEKS = 12;
const weekSeries = (rows: { created_at?: string }[], pick?: (r: any) => boolean): number[] => {
  const out = new Array(WEEKS).fill(0) as number[];
  const now = Date.now();
  const WEEK_MS = 7 * 86_400_000;
  for (const r of rows) {
    if (pick && !pick(r)) continue;
    const t = r.created_at ? new Date(r.created_at).getTime() : 0;
    if (!t) continue;
    const idx = WEEKS - 1 - Math.floor((now - t) / WEEK_MS);
    if (idx >= 0 && idx < WEEKS) out[idx]++;
  }
  return out;
};

const CreatorDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [me, setMe] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [picked, setPicked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    Promise.all([
      api.get('/auth/me').catch(() => ({ data: null })),
      api.get('/creators/profile').catch(() => ({ data: null })),
      api.get('/applications'),
      api.get('/invitations/received').catch(() => ({ data: [] })),
      api.get('/contracts/mine').catch(() => ({ data: [] })),
      api.get('/tasks/mine').catch(() => ({ data: [] })),
      api.get('/payments/transactions').catch(() => ({ data: [] })),
    ])
      .then(async ([meRes, prof, apps, invs, conts, tks, txs]) => {
        setMe(meRes.data);
        setProfile(prof.data);
        setApplications(Array.isArray(apps.data) ? apps.data : []);
        setInvitations(Array.isArray(invs.data) ? invs.data : []);
        setContracts(Array.isArray(conts.data) ? conts.data : []);
        setTasks(Array.isArray(tks.data) ? tks.data : []);
        setTransactions(Array.isArray(txs.data) ? txs.data : []);
        // Briefs picked for you: open briefs targeting your country (or anywhere).
        const params: Record<string, string> = { limit: '3', sort: 'newest', lang: i18n.language };
        if (prof.data?.country_code) params.country = prof.data.country_code;
        const list = await api.get('/campaigns/public-list', { params }).catch(() => ({ data: { items: [] } }));
        setPicked(list.data?.items || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const myId = me?.userId || me?.id;
  const firstName = (profile?.first_name || profile?.full_name || '').split(' ')[0];
  const appliedIds = useMemo(() => applications.map((a) => a.campaign?.id).filter(Boolean), [applications]);

  const funnel = useMemo(() => {
    const f = { total: applications.length, pending: 0, shortlisted: 0, accepted: 0, rejected: 0 };
    for (const a of applications) {
      const s = normalizeApplicationStatus(a.status);
      if (s === 'refunded') f.rejected++;
      else f[s]++;
    }
    return f;
  }, [applications]);

  const activeContracts = useMemo(() => contracts.filter((c) => ['active', 'approved'].includes(String(c.status))), [contracts]);
  const awaitingSignature = useMemo(() => contracts.filter((c) => c.status === 'pending_signature'), [contracts]);
  const openTasks = useMemo(() => tasks.filter((x) => ['pending', 'in_progress'].includes(String(x.status))), [tasks]);
  const pendingInvites = useMemo(() => invitations.filter((i) => i.status === 'pending'), [invitations]);

  const earnings = useMemo(() => {
    const byCur = new Map<string, number>();
    let count = 0;
    for (const tx of transactions) {
      if (String(tx.status) !== 'completed') continue;
      if (myId && tx.payee?.id && tx.payee.id !== myId) continue;
      const cur = tx.currency || 'USD';
      byCur.set(cur, (byCur.get(cur) || 0) + (Number(tx.amount) || 0));
      count++;
    }
    const [top] = [...byCur.entries()].sort((a, b) => b[1] - a[1]);
    return { label: top ? formatBudget(top[1], top[0]) : formatBudget(0, 'USD'), count, currencies: byCur.size };
  }, [transactions, myId]);

  const series = useMemo(
    () => ({
      applications: weekSeries(applications),
      accepted: weekSeries(applications, (a) => normalizeApplicationStatus(a.status) === 'accepted'),
      contracts: weekSeries(contracts),
    }),
    [applications, contracts],
  );

  const completeness = useMemo(() => {
    const p = profile || {};
    const checks = [p.full_name || p.first_name, p.username, p.bio, p.avatar_url, p.category, p.country, p.social_links];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
  }, [profile]);

  const attention = useMemo(() => {
    const items: { key: string; n: number; label: string; to: string; icon: React.ReactNode; tone: string }[] = [];
    if (pendingInvites.length)
      items.push({ key: 'inv', n: pendingInvites.length, label: t('cdash.attnInvites'), to: '/dashboard/invitations', icon: <Mail size={15} />, tone: '#6c63ff' });
    if (awaitingSignature.length)
      items.push({ key: 'sig', n: awaitingSignature.length, label: t('cdash.attnContracts'), to: '/dashboard/contracts', icon: <FileText size={15} />, tone: '#ffb547' });
    if (openTasks.length)
      items.push({ key: 'tasks', n: openTasks.length, label: t('cdash.attnTasks'), to: '/dashboard/workspace', icon: <ClipboardList size={15} />, tone: '#ff7a45' });
    if (funnel.shortlisted)
      items.push({ key: 'short', n: funnel.shortlisted, label: t('cdash.attnShortlisted'), to: '/dashboard/campaigns?tab=applications&status=shortlisted', icon: <Star size={15} />, tone: '#00d4c7' });
    return items;
  }, [pendingInvites, awaitingSignature, openTasks, funnel.shortlisted, t]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('cdash.morning') : hour < 18 ? t('cdash.afternoon') : t('cdash.evening');

  const kpis = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        label={t('cdash.kpiApplications')}
        value={funnel.total}
        hint={t('dash.kpiPendingN', { n: funnel.pending })}
        series={series.applications}
        icon={Briefcase}
        iconStatus={funnel.pending ? 'warning' : undefined}
      />
      <MetricCard
        label={t('appStatus.accepted')}
        value={funnel.accepted}
        hint={t('cdash.kpiRate', { pct: funnel.total ? Math.round((funnel.accepted / funnel.total) * 100) : 0 })}
        series={series.accepted}
        chartColor="var(--color-signal-green, #16c784)"
        icon={CheckCircle2}
        iconStatus="success"
      />
      <MetricCard
        label={t('cdash.kpiContracts')}
        value={activeContracts.length}
        hint={t('cdash.kpiContractsHint', { n: awaitingSignature.length })}
        series={series.contracts}
        chartColor="var(--chart-1, #00d4c7)"
        icon={FileText}
        iconStatus={awaitingSignature.length ? 'warning' : undefined}
      />
      <MetricCard
        label={t('cdash.kpiEarned')}
        value={earnings.label}
        hint={t('cdash.kpiEarnedHint', { n: earnings.count })}
        icon={DollarSign}
        iconStatus={earnings.count ? 'success' : undefined}
      />
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={`${greeting},`}
      titleAccent={firstName || t('cdash.you')}
      description={t('cdash.desc')}
      icon={<LayoutDashboard size={18} />}
      actions={
        <>
          <Link to="/dashboard/profile">
            <Button variant="tertiary" size="md">
              <Pencil size={13} /> {t('cdash.editProfile')}
            </Button>
          </Link>
          <Link to="/dashboard/campaigns?tab=browse">
            <Button variant="primary" size="md">
              <Megaphone size={14} /> {t('cdash.browse')}
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
          actions={<Button variant="primary" size="sm" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>}
        />
      )}

      {attention.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {attention.map((a) => (
            <Link key={a.key} to={a.to} className="v-talent-card p-3.5 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: `${a.tone}1f`, color: a.tone }}>
                {a.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="v-ink font-medium tabular-nums" style={{ fontSize: 18, letterSpacing: '-0.015em', lineHeight: 1.1 }}>{a.n}</div>
                <div className="v-caption v-muted truncate" style={{ fontSize: 12 }}>{a.label}</div>
              </div>
              <ArrowRight size={14} className="v-quiet shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 space-y-5">
          {/* Picked for you */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
                <Sparkles size={15} style={{ color: 'var(--color-campaign-purple)' }} />
                {profile?.country ? t('cdash.pickedIn', { country: profile.country }) : t('cdash.picked')}
              </h2>
              <Link to="/dashboard/campaigns?tab=browse">
                <Button variant="ghost" size="sm">
                  {t('dash.seeAll')} <ArrowRight size={11} />
                </Button>
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[0, 1].map((i) => (
                  <CampaignCardSkeleton key={i} />
                ))}
              </div>
            ) : picked.length === 0 ? (
              <EmptyPanel
                icon={<Megaphone size={22} />}
                title={t('cdash.noBriefsTitle')}
                description={t('cdash.noBriefsDesc')}
                actions={
                  <Link to="/dashboard/campaigns?tab=browse">
                    <Button variant="primary">{t('cdash.browse')}</Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {picked.slice(0, 2).map((camp, i) => (
                  <CampaignCard
                    key={camp.id}
                    camp={camp}
                    index={i}
                    applied={appliedIds.includes(camp.id)}
                    loggedIn
                    isCreator
                    onApply={() => navigate('/dashboard/campaigns?tab=browse')}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recent applications */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
                <Briefcase size={15} style={{ color: 'var(--color-campaign-purple)' }} /> {t('cdash.recentApps')}
              </h2>
              <Link to="/dashboard/campaigns?tab=applications">
                <Button variant="ghost" size="sm">
                  {t('dash.seeAll')} <ArrowRight size={11} />
                </Button>
              </Link>
            </div>
            {!loading && applications.length === 0 ? (
              <EmptyPanel
                size="sm"
                icon={<Briefcase size={18} />}
                title={t('cdash.noAppsTitle')}
                description={t('cdash.noAppsDesc')}
              />
            ) : (
              <ul className="v-talent-card divide-y divide-border">
                {applications.slice(0, 4).map((a) => {
                  const s = normalizeApplicationStatus(a.status);
                  const brand = a.campaign?.brand?.brandProfile?.company_name || a.campaign?.brand?.email?.split('@')[0] || '';
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{a.campaign?.title || '—'}</div>
                        <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                          {brand}{brand && a.created_at ? ' · ' : ''}{postedLabel(a.created_at)}
                        </div>
                      </div>
                      {a.campaign?.budget != null && (
                        <span className="v-ink font-medium tabular-nums hidden sm:inline" style={{ fontSize: 13, color: '#0b6e3e' }}>
                          {formatBudget(a.campaign.budget, a.campaign.currency || 'USD')}
                        </span>
                      )}
                      <Chip color={APPLICATION_STATUS_COLOR[s]} variant="soft" size="sm">
                        <Chip.Label>{t(`appStatus.${s}`)}</Chip.Label>
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          {/* Funnel */}
          <div className="v-talent-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 15 }}>
                <BarChart3 size={14} style={{ color: 'var(--color-campaign-purple)' }} /> {t('cdash.funnel')}
              </h2>
              <span className="v-caption v-quiet tabular-nums" style={{ fontSize: 11.5 }}>{t('dash.pipelineTotal', { n: funnel.total })}</span>
            </div>
            {funnel.total === 0 && !loading ? (
              <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('cdash.noAppsDesc')}</p>
            ) : (
              <ul className="space-y-2.5">
                {(['pending', 'shortlisted', 'accepted', 'rejected'] as const).map((k) => {
                  const n = funnel[k];
                  const max = Math.max(1, funnel.pending, funnel.shortlisted, funnel.accepted, funnel.rejected);
                  const color = k === 'pending' ? '#ffb547' : k === 'accepted' ? '#16c784' : k === 'rejected' ? '#c4cad8' : 'var(--gradient-signature)';
                  return (
                    <li key={k}>
                      <div className="flex items-center justify-between v-caption mb-1" style={{ fontSize: 12 }}>
                        <span className="v-ink font-medium">{t(`appStatus.${k}`)}</span>
                        <span className="v-quiet tabular-nums">{n}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-cool-gray)' }}>
                        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(n ? 6 : 0, (n / max) * 100)}%`, background: color }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Profile completeness */}
          <div className="v-talent-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 15 }}>
                <Users size={14} style={{ color: 'var(--color-campaign-purple)' }} /> {t('cdash.profile')}
              </h2>
              <span className="v-text-signature font-medium tabular-nums" style={{ fontSize: 18 }}>{completeness.pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-2.5" style={{ background: 'var(--color-cool-gray)' }}>
              <div className="h-full rounded-full" style={{ width: `${completeness.pct}%`, background: 'var(--gradient-signature)' }} />
            </div>
            <p className="v-caption v-quiet mb-3" style={{ fontSize: 12 }}>
              {completeness.pct >= 100 ? t('cdash.profileDone') : t('cdash.profileHint', { n: completeness.total - completeness.done, count: completeness.total - completeness.done })}
            </p>
            <Link to="/dashboard/profile">
              <Button variant={completeness.pct >= 100 ? 'tertiary' : 'primary'} size="sm" fullWidth>
                <Pencil size={12} /> {t('cdash.editProfile')}
              </Button>
            </Link>
          </div>

          {/* Contracts */}
          <div className="v-talent-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 15 }}>
                <FileText size={14} style={{ color: 'var(--color-campaign-purple)' }} /> {t('side.contracts')}
              </h2>
              <Link to="/dashboard/contracts">
                <Button variant="ghost" size="sm">
                  {t('dash.seeAll')} <ArrowRight size={11} />
                </Button>
              </Link>
            </div>
            {!loading && contracts.length === 0 ? (
              <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('cdash.noContracts')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {contracts.slice(0, 3).map((c) => {
                  const active = ['active', 'approved'].includes(String(c.status));
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="v-ink font-medium truncate" style={{ fontSize: 13 }}>{c.title || c.application?.campaign?.title || '—'}</div>
                        <div className="v-caption v-quiet tabular-nums" style={{ fontSize: 11 }}>
                          {c.payment_amount ? formatBudget(c.payment_amount, c.currency || 'USD') : postedLabel(c.created_at)}
                        </div>
                      </div>
                      <Chip color={active ? 'success' : c.status === 'pending_signature' ? 'warning' : 'default'} variant="soft" size="sm">
                        <Chip.Label>{t(`contractStatus.${c.status}`, { defaultValue: String(c.status).replace('_', ' ') })}</Chip.Label>
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { to: '/dashboard/workspace', icon: <ClipboardList size={16} />, title: t('side.workspace'), desc: t('cdash.qlWorkspace') },
          { to: '/dashboard/messages', icon: <MessageSquare size={16} />, title: t('side.messages'), desc: t('dash.qlMessagesDesc') },
          { to: '/dashboard/payments', icon: <DollarSign size={16} />, title: t('side.payments'), desc: t('cdash.qlPayments') },
          { to: '/dashboard/ai', icon: <Sparkles size={16} />, title: t('side.aiStudio'), desc: t('cdash.qlAi') },
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

export default CreatorDashboard;
