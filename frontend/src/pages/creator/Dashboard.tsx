import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Clock,
  Circle,
  ClipboardList,
  DollarSign,
  FileText,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Pencil,
  Share2,
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
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { DashPanel, PanelEmpty, PanelRow, PanelRows, PanelRowsSkeleton } from '../../components/common/DashPanel';
import { StoryAvatar } from '../../components/common/StoryAvatar';
import PayoutSummary from '../../components/PayoutSummary';
import { StarterHome } from '../../components/creator/StarterHome';
import { AddPlatformsModal } from '../../components/creator/AddPlatformsModal';
import { SOCIAL_PLATFORMS, parseSocialLinks } from '../../lib/socialLinks';

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
  const [addingPlatforms, setAddingPlatforms] = useState(false);
  const [applications, setApplications] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [picked, setPicked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /* Until something is happening (an application or a contract) the home
     is a simple "what next" page. A creator can opt into the full board;
     the choice is remembered on this device. */
  const [fullBoard, setFullBoard] = useState<boolean>(() => {
    try { return localStorage.getItem('creator_full_board') === '1'; } catch { return false; }
  });
  const setBoard = (full: boolean) => {
    setFullBoard(full);
    try { localStorage.setItem('creator_full_board', full ? '1' : '0'); } catch { /* private mode */ }
  };

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
    const f = { total: applications.length, pending: 0, shortlisted: 0, offered: 0, accepted: 0, rejected: 0 };
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
    const sl = p.social_links;
    const hasSocials = Array.isArray(sl) ? sl.length > 0 : sl && typeof sl === 'object' ? Object.keys(sl).length > 0 : !!sl;
    const items = [
      { key: 'chkName', done: !!(p.full_name || p.first_name) },
      { key: 'chkHandle', done: !!p.username },
      { key: 'chkBio', done: !!p.bio },
      { key: 'chkAvatar', done: !!p.avatar_url },
      { key: 'chkNiches', done: !!p.category },
      { key: 'chkLocation', done: !!p.country },
      { key: 'chkSocials', done: hasSocials },
    ];
    const done = items.filter((i) => i.done).length;
    return { items, done, total: items.length, pct: Math.round((done / items.length) * 100) };
  }, [profile]);

  /** Platforms our team has not verified yet — named, so a newly added one is visible at once. */
  const waitingPlatforms = useMemo(() => {
    const socials = parseSocialLinks(profile?.social_links);
    return SOCIAL_PLATFORMS.filter((p) => socials[p.id]?.url && socials[p.id]?.status !== 'verified' && socials[p.id]?.status !== 'rejected').map((p) => p.label.replace(' / Twitter', ''));
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
      items.push({ key: 'short', n: funnel.shortlisted, label: t('cdash.attnShortlisted'), to: '/dashboard/applications?status=shortlisted', icon: <Star size={15} />, tone: '#00d4c7' });
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

  const quiet = !loading && !error && applications.length === 0 && contracts.length === 0;
  if (quiet && !fullBoard) {
    return <StarterHome me={me} profile={profile} onRefresh={load} onShowFull={() => setBoard(true)} />;
  }

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
          {quiet && (
            <Button variant="ghost" size="md" onPress={() => setBoard(false)} data-testid="starter-show-simple">
              {t('starter.simpleDashboard')}
            </Button>
          )}
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

      {/* Home grid — every block is a DashPanel so both columns share one frame
          and each row stretches its two panels to the same height. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Row 1 — briefs picked for you · profile strength */}
        <DashPanel
          className="lg:col-span-2"
          icon={<Sparkles size={15} />}
          title={profile?.country ? t('cdash.pickedIn', { country: profile.country }) : t('cdash.picked')}
          action={
            <Link to="/dashboard/campaigns?tab=browse">
              <Button variant="ghost" size="sm">
                {t('dash.seeAll')} <ArrowRight size={11} />
              </Button>
            </Link>
          }
        >
          {loading ? (
            <PanelRowsSkeleton n={3} />
          ) : picked.length === 0 ? (
            <PanelEmpty
              icon={<Megaphone size={16} />}
              title={t('cdash.noBriefsTitle')}
              desc={t('cdash.noBriefsDesc')}
              action={
                <Link to="/dashboard/campaigns?tab=browse">
                  <Button variant="primary" size="sm">{t('cdash.browse')}</Button>
                </Link>
              }
            />
          ) : (
            <PanelRows>
              {picked.slice(0, 3).map((camp) => {
                const bp = camp.brand?.brandProfile || {};
                const company = bp.company_name || camp.brand?.email?.split('@')[0] || '';
                const applied = appliedIds.includes(camp.id);
                const sub = [company, camp.platform, postedLabel(camp.created_at), t('cdash.appliedN', { count: Number(camp.applicants_count) || 0 })]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <PanelRow
                    key={camp.id}
                    leading={<StoryAvatar src={bp.logo_url} name={company} seed={camp.brand?.id || company} size={36} />}
                    title={camp.title}
                    sub={sub}
                    trailing={
                      <>
                        {camp.budget != null && (
                          <span className="v-ink font-medium tabular-nums hidden sm:inline" style={{ fontSize: 13, color: '#0b6e3e' }}>
                            {formatBudget(camp.budget, camp.currency || 'USD')}
                          </span>
                        )}
                        {applied ? (
                          <Chip color="success" variant="soft" size="sm">
                            <CheckCircle2 size={11} />
                            <Chip.Label>{t('cdash.applied')}</Chip.Label>
                          </Chip>
                        ) : (
                          <Button variant="primary" size="sm" onPress={() => navigate('/dashboard/campaigns?tab=browse')}>
                            {t('cdash.apply')}
                          </Button>
                        )}
                      </>
                    }
                  />
                );
              })}
              {picked.length < 3 && (
                <PanelRow
                  className="mt-auto"
                  leading={
                    <span className="v-hero-icon" style={{ width: 36, height: 36, borderRadius: 11 }}>
                      <Megaphone size={15} />
                    </span>
                  }
                  title={t('cdash.moreBriefsTitle')}
                  sub={t('cdash.moreBriefsDesc')}
                  trailing={
                    <Link to="/dashboard/campaigns?tab=browse">
                      <Button variant="tertiary" size="sm">
                        {t('cdash.browseAll')} <ArrowRight size={11} />
                      </Button>
                    </Link>
                  }
                />
              )}
            </PanelRows>
          )}
        </DashPanel>

        <DashPanel
          icon={<Users size={15} />}
          title={t('cdash.profile')}
          meta={
            <span className="v-text-signature font-medium" style={{ fontSize: 17 }}>
              {completeness.pct}%
            </span>
          }
        >
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-cool-gray)' }}>
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${completeness.pct}%`, background: 'var(--gradient-signature)' }} />
          </div>
          <p className="v-caption v-quiet mt-2 mb-3" style={{ fontSize: 12 }}>
            {completeness.pct >= 100 ? t('cdash.profileDone') : t('cdash.profileHint', { n: completeness.total - completeness.done, count: completeness.total - completeness.done })}
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-4">
            {completeness.items.map((it) => (
              <li key={it.key} className="flex items-center gap-1.5 min-w-0" style={{ fontSize: 12.5 }}>
                {it.done ? (
                  <CheckCircle2 size={14} className="shrink-0" style={{ color: 'var(--color-signal-green)' }} />
                ) : (
                  <Circle size={14} className="shrink-0 v-quiet" />
                )}
                <span className={`truncate ${it.done ? 'v-ink' : 'v-quiet'}`}>{t(`cdash.${it.key}`)}</span>
              </li>
            ))}
          </ul>
          {waitingPlatforms.length > 0 && (
            <p className="v-caption mb-3 inline-flex items-start gap-1.5" style={{ fontSize: 12, color: '#9a6700' }} data-testid="dash-waiting-verification">
              <Clock size={12} className="shrink-0 mt-0.5" /> {t('starter.waitingFor', { list: waitingPlatforms.join(', ') })}
            </p>
          )}
          <div className="mt-auto grid grid-cols-2 gap-2">
            <Button variant="tertiary" size="sm" fullWidth onPress={() => setAddingPlatforms(true)} data-testid="dash-add-platforms">
              <Share2 size={12} /> {t('social.addPlatforms')}
            </Button>
            <Link to="/dashboard/profile" className="block">
              <Button variant={completeness.pct >= 100 ? 'tertiary' : 'primary'} size="sm" fullWidth>
                <Pencil size={12} /> {t('cdash.editProfile')}
              </Button>
            </Link>
          </div>
        </DashPanel>

        {/* Row 2 — recent applications · pipeline */}
        <DashPanel
          className="lg:col-span-2"
          icon={<Briefcase size={15} />}
          title={t('cdash.recentApps')}
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
            <PanelEmpty icon={<Briefcase size={16} />} title={t('cdash.noAppsTitle')} desc={t('cdash.noAppsDesc')} />
          ) : (
            <PanelRows>
              {applications.slice(0, 4).map((a) => {
                const s = normalizeApplicationStatus(a.status);
                const bp = a.campaign?.brand?.brandProfile || {};
                const brand = bp.company_name || a.campaign?.brand?.email?.split('@')[0] || '';
                return (
                  <PanelRow
                    key={a.id}
                    leading={<StoryAvatar src={bp.logo_url} name={brand} seed={a.campaign?.brand?.id || brand} size={36} />}
                    title={a.campaign?.title || '—'}
                    sub={[brand, postedLabel(a.created_at)].filter(Boolean).join(' · ')}
                    trailing={
                      <>
                        {a.campaign?.budget != null && (
                          <span className="v-ink font-medium tabular-nums hidden sm:inline" style={{ fontSize: 13, color: '#0b6e3e' }}>
                            {formatBudget(a.campaign.budget, a.campaign.currency || 'USD')}
                          </span>
                        )}
                        <Chip color={APPLICATION_STATUS_COLOR[s]} variant="soft" size="sm">
                          <Chip.Label>{t(`appStatus.${s}`)}</Chip.Label>
                        </Chip>
                      </>
                    }
                  />
                );
              })}
            </PanelRows>
          )}
        </DashPanel>

        <DashPanel icon={<BarChart3 size={15} />} title={t('cdash.funnel')} meta={t('dash.pipelineTotal', { n: funnel.total })}>
          {funnel.total === 0 && !loading ? (
            <PanelEmpty icon={<BarChart3 size={16} />} title={t('cdash.noAppsTitle')} desc={t('cdash.noAppsDesc')} />
          ) : (
            <ul className="space-y-2.5">
              {(['pending', 'shortlisted', 'offered', 'accepted', 'rejected'] as const).map((k) => {
                const n = funnel[k];
                const max = Math.max(1, funnel.pending, funnel.shortlisted, funnel.offered, funnel.accepted, funnel.rejected);
                const color = k === 'pending' ? '#ffb547' : k === 'offered' ? '#00d4c7' : k === 'accepted' ? '#16c784' : k === 'rejected' ? '#c4cad8' : 'var(--gradient-signature)';
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
        </DashPanel>

        {/* Row 3 — contracts · payout account */}
        <DashPanel
          className="lg:col-span-2"
          icon={<FileText size={15} />}
          title={t('side.contracts')}
          action={
            <Link to="/dashboard/contracts">
              <Button variant="ghost" size="sm">
                {t('dash.seeAll')} <ArrowRight size={11} />
              </Button>
            </Link>
          }
        >
          {loading ? (
            <PanelRowsSkeleton n={2} avatar={false} />
          ) : contracts.length === 0 ? (
            <PanelEmpty icon={<FileText size={16} />} title={t('cdash.noContractsTitle')} desc={t('cdash.noContracts')} />
          ) : (
            <PanelRows>
              {contracts.slice(0, 3).map((c) => {
                const active = ['active', 'approved'].includes(String(c.status));
                const campaign = c.application?.campaign?.title;
                const partner = c.opponent_name || (c.opponent_email ? String(c.opponent_email).split('@')[0] : '');
                const freq = c.payment_frequency ? t(`apps.freq.${c.payment_frequency}`, { defaultValue: String(c.payment_frequency).replace('_', ' ') }) : '';
                return (
                  <PanelRow
                    key={c.id}
                    leading={
                      <StoryAvatar src={c.opponent_avatar} name={partner} seed={c.opponent_id || partner} size={36} />
                    }
                    title={campaign || c.title || '—'}
                    sub={[partner, freq, postedLabel(c.created_at)].filter(Boolean).join(' · ')}
                    trailing={
                      <>
                        {c.payment_amount != null && (
                          <span className="v-ink font-medium tabular-nums hidden sm:inline" style={{ fontSize: 13, color: '#0b6e3e' }}>
                            {formatBudget(c.payment_amount, c.currency || 'USD')}
                          </span>
                        )}
                        <Chip color={active ? 'success' : c.status === 'pending_signature' ? 'warning' : 'default'} variant="soft" size="sm">
                          <Chip.Label>{t(`contractStatus.${c.status}`, { defaultValue: String(c.status).replace('_', ' ') })}</Chip.Label>
                        </Chip>
                      </>
                    }
                  />
                );
              })}
            </PanelRows>
          )}
        </DashPanel>

        <DashPanel icon={<DollarSign size={15} />} title={t('cdash.payout')}>
          <PayoutSummary variant="bare" />
        </DashPanel>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { to: '/dashboard/workspace', icon: <ClipboardList size={16} />, title: t('side.workspace'), desc: t('cdash.qlWorkspace') },
          { to: '/dashboard/messages', icon: <MessageSquare size={16} />, title: t('side.messages'), desc: t('dash.qlMessagesDesc') },
          { to: '/dashboard/payments', icon: <DollarSign size={16} />, title: t('side.payments'), desc: t('cdash.qlPayments') },
          { to: '/dashboard/invitations', icon: <Mail size={16} />, title: t('side.invitations'), desc: t('cdash.qlInvites') },
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
      {addingPlatforms && (
        <AddPlatformsModal open onClose={() => setAddingPlatforms(false)} socialLinks={profile?.social_links} onSaved={load} />
      )}
    </PageShell>
  );
};

export default CreatorDashboard;
