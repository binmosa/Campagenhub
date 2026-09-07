import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  Circle,
  ClipboardList,
  DollarSign,
  FileText,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Pencil,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatBudget, postedLabel } from '../../lib/campaignFormat';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { DashPanel, PanelEmpty, PanelRow, PanelRows, PanelRowsSkeleton } from '../../components/common/DashPanel';
import { StoryAvatar } from '../../components/common/StoryAvatar';
import PayoutSummary from '../../components/PayoutSummary';
import type { Talent } from '../talent/shared';

/**
 * ManagerDashboard — a manager's book of business: brands who hired them
 * (accepted brand invitations), the creator roster they've built (accepted
 * invitations they sent), contracts, earnings, and what needs a reply.
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

const INV_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  declined: 'danger',
};

const brandName = (inv: any): string =>
  inv?.sender?.brandProfile?.company_name ||
  inv?.brand?.brandProfile?.company_name ||
  inv?.sender?.email?.split('@')[0] ||
  inv?.brand?.email?.split('@')[0] ||
  '';

const toTalent = (inv: any): Talent | null => {
  const u = inv?.receiver;
  const p = u?.creatorProfile;
  if (!u || !p) return null;
  return {
    id: u.id,
    _type: 'creator',
    full_name: p.full_name,
    username: p.username,
    bio: p.bio,
    category: p.category,
    location: p.location,
    avatar_url: p.avatar_url,
    social_links: p.social_links,
    follower_range: p.follower_range,
  } as Talent;
};

const ManagerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [me, setMe] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [received, setReceived] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [engagements, setEngagements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    Promise.all([
      api.get('/auth/me').catch(() => ({ data: null })),
      api.get('/managers/profile').catch(() => ({ data: null })),
      api.get('/invitations/received'),
      api.get('/invitations/sent').catch(() => ({ data: [] })),
      api.get('/contracts/mine').catch(() => ({ data: [] })),
      api.get('/tasks/mine').catch(() => ({ data: [] })),
      api.get('/payments/transactions').catch(() => ({ data: [] })),
      api.get('/manager-applications/engagements').catch(() => ({ data: [] })),
    ])
      .then(([meRes, prof, inv, snt, conts, tks, txs, eng]) => {
        setMe(meRes.data);
        setProfile(prof.data);
        setReceived(Array.isArray(inv.data) ? inv.data : []);
        setSent(Array.isArray(snt.data) ? snt.data : []);
        setContracts(Array.isArray(conts.data) ? conts.data : []);
        setTasks(Array.isArray(tks.data) ? tks.data : []);
        setTransactions(Array.isArray(txs.data) ? txs.data : []);
        setEngagements(Array.isArray(eng.data) ? eng.data : []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const myId = me?.userId || me?.id;
  const firstName = (profile?.first_name || profile?.full_name || '').split(' ')[0];

  const pendingBrand = useMemo(() => received.filter((i) => i.status === 'pending'), [received]);
  const clients = useMemo(() => received.filter((i) => i.status === 'accepted'), [received]);
  const roster = useMemo(() => sent.filter((i) => i.status === 'accepted').map(toTalent).filter(Boolean) as Talent[], [sent]);
  const rosterPending = useMemo(() => sent.filter((i) => i.status === 'pending'), [sent]);
  const activeContracts = useMemo(() => contracts.filter((c) => ['active', 'approved'].includes(String(c.status))), [contracts]);
  const awaitingSignature = useMemo(() => contracts.filter((c) => c.status === 'pending_signature'), [contracts]);
  const openTasks = useMemo(() => tasks.filter((x) => ['pending', 'in_progress'].includes(String(x.status))), [tasks]);

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
    return { label: top ? formatBudget(top[1], top[0]) : formatBudget(0, 'USD'), count };
  }, [transactions, myId]);

  const series = useMemo(
    () => ({
      clients: weekSeries(received, (i) => i.status === 'accepted'),
      roster: weekSeries(sent, (i) => i.status === 'accepted'),
      contracts: weekSeries(contracts),
    }),
    [received, sent, contracts],
  );

  const rating = Math.min(5, Math.max(0, Number(profile?.rating) || 5));
  const completeness = useMemo(() => {
    const p = profile || {};
    const items = [
      { key: 'cdash.chkName', done: !!(p.full_name || p.first_name) },
      { key: 'cdash.chkAvatar', done: !!p.avatar_url },
      { key: 'cdash.chkBio', done: !!p.bio },
      { key: 'mdash.chkSpecialty', done: !!p.specialty },
      { key: 'mdash.chkServices', done: Array.isArray(p.services) ? p.services.length > 0 : !!p.services },
      { key: 'cdash.chkLocation', done: !!(p.country || p.location) },
      { key: 'mdash.chkExperience', done: Number(p.experience_years) > 0 },
    ];
    const done = items.filter((i) => i.done).length;
    return { items, done, total: items.length, pct: Math.round((done / items.length) * 100) };
  }, [profile]);

  const attention = useMemo(() => {
    const items: { key: string; n: number; label: string; to: string; icon: React.ReactNode; tone: string }[] = [];
    if (pendingBrand.length) items.push({ key: 'brand', n: pendingBrand.length, label: t('mdash.attnBrandInvites'), to: '/dashboard/invitations', icon: <Mail size={15} />, tone: '#6c63ff' });
    if (awaitingSignature.length) items.push({ key: 'sig', n: awaitingSignature.length, label: t('cdash.attnContracts'), to: '/dashboard/contracts', icon: <FileText size={15} />, tone: '#ffb547' });
    if (openTasks.length) items.push({ key: 'tasks', n: openTasks.length, label: t('cdash.attnTasks'), to: '/dashboard/workspace', icon: <ClipboardList size={15} />, tone: '#ff7a45' });
    if (rosterPending.length) items.push({ key: 'roster', n: rosterPending.length, label: t('mdash.attnRosterPending'), to: '/dashboard/invitations', icon: <Users size={15} />, tone: '#00d4c7' });
    return items;
  }, [pendingBrand, awaitingSignature, openTasks, rosterPending, t]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('cdash.morning') : hour < 18 ? t('cdash.afternoon') : t('cdash.evening');

  const kpis = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        label={t('mdash.kpiClients')}
        value={engagements.length}
        hint={t('mdash.kpiClientsHint', { n: pendingBrand.length })}
        series={series.clients}
        icon={Building2}
        iconStatus={pendingBrand.length ? 'warning' : undefined}
      />
      <MetricCard
        label={t('mdash.kpiRoster')}
        value={roster.length}
        hint={t('mdash.kpiRosterHint', { n: rosterPending.length })}
        series={series.roster}
        chartColor="var(--chart-1, #00d4c7)"
        icon={Users}
      />
      <MetricCard
        label={t('cdash.kpiContracts')}
        value={activeContracts.length}
        hint={t('cdash.kpiContractsHint', { n: awaitingSignature.length })}
        series={series.contracts}
        chartColor="var(--color-signal-green, #16c784)"
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
      description={t('mdash.desc')}
      icon={<LayoutDashboard size={18} />}
      actions={
        <>
          <Link to="/dashboard/profile">
            <Button variant="tertiary" size="md">
              <Pencil size={13} /> {t('cdash.editProfile')}
            </Button>
          </Link>
          <Link to="/dashboard/talent">
            <Button variant="primary" size="md">
              <Star size={14} /> {t('dash.findTalent')}
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
        {/* Row 1 — brand clients · reputation */}
        <DashPanel
          className="lg:col-span-2"
          icon={<Building2 size={15} />}
          title={t('mdash.clients')}
          meta={engagements.length ? t('mdash.clientsCount', { count: engagements.length }) : undefined}
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
          ) : engagements.length === 0 ? (
            <PanelEmpty
              icon={<Building2 size={16} />}
              title={t('mdash.noClientsTitle')}
              desc={t('mdash.noClientsDesc')}
              action={
                <Link to="/dashboard/campaigns">
                  <Button variant="primary" size="sm">{t('mcamp.browse')}</Button>
                </Link>
              }
            />
          ) : (
            <PanelRows>
              {engagements.slice(0, 4).map((e: any) => {
                const name = e.brand?.brandProfile?.company_name || e.brand?.email?.split('@')[0] || t('side.roleBrand');
                const cap = e.grant?.budget_cap;
                const limit = e.grant?.campaign_limit;
                const terms = e.payment_amount
                  ? `${formatBudget(Number(e.payment_amount), e.currency || 'USD')}${e.payment_frequency && e.payment_frequency !== 'one_time' ? ` / ${t(`apps.freq.${e.payment_frequency}`, { defaultValue: e.payment_frequency })}` : ''}`
                  : '';
                const scope = [
                  limit == null ? t('mcamp.unlimitedCampaigns') : t('mcamp.campaignsUsed', { used: e.usage?.campaigns_created || 0, limit }),
                  cap == null ? t('mcamp.noCap') : t('mcamp.budgetUsed', { used: formatBudget(e.usage?.budget_used || 0, 'USD'), cap: formatBudget(cap, 'USD') }),
                ].join(' · ');
                return (
                  <PanelRow
                    key={e.id}
                    leading={<StoryAvatar src={e.brand?.brandProfile?.logo_url} name={name} seed={e.brand?.id || name} size={36} />}
                    title={name}
                    sub={[scope, terms].filter(Boolean).join(' · ')}
                    trailing={
                      <Chip color="success" variant="soft" size="sm">
                        <Chip.Label>{t('mcamp.campaignsManaged', { count: e.usage?.campaigns_managed || 0 })}</Chip.Label>
                      </Chip>
                    }
                  />
                );
              })}
            </PanelRows>
          )}
        </DashPanel>

        <DashPanel
          icon={<Award size={15} />}
          title={t('mdash.reputation')}
          meta={
            <span className="inline-flex items-center gap-1 v-ink font-medium" style={{ fontSize: 17 }}>
              <Star size={14} className="fill-warning text-warning" /> {rating.toFixed(1)}
            </span>
          }
        >
          <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('mdash.reputationHint')}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 v-caption" style={{ fontSize: 12 }}>
            <div className="rounded-lg p-2.5" style={{ background: 'var(--color-cool-gray)' }}>
              <dt className="v-quiet">{t('mprof.experience')}</dt>
              <dd className="v-ink font-medium">{Number(profile?.experience_years) > 0 ? t('talent.years', { n: Number(profile.experience_years) }) : '—'}</dd>
            </div>
            <div className="rounded-lg p-2.5" style={{ background: 'var(--color-cool-gray)' }}>
              <dt className="v-quiet">{t('mdash.brandsServed')}</dt>
              <dd className="v-ink font-medium tabular-nums">{clients.length}</dd>
            </div>
          </dl>
        </DashPanel>

        {/* Row 2 — creator roster · profile strength */}
        <DashPanel
          className="lg:col-span-2"
          icon={<Users size={15} />}
          title={t('mdash.roster')}
          meta={roster.length ? t('mdash.rosterCount', { count: roster.length }) : undefined}
          action={
            <Link to="/dashboard/talent">
              <Button variant="ghost" size="sm">
                {t('dash.findTalent')} <ArrowRight size={11} />
              </Button>
            </Link>
          }
        >
          {loading ? (
            <PanelRowsSkeleton n={3} />
          ) : roster.length === 0 ? (
            <PanelEmpty
              icon={<Users size={16} />}
              title={t('mdash.noRosterTitle')}
              desc={t('mdash.noRosterDesc')}
              action={
                <Link to="/dashboard/talent">
                  <Button variant="primary" size="sm">
                    <Star size={12} /> {t('dash.findTalent')}
                  </Button>
                </Link>
              }
            />
          ) : (
            <PanelRows>
              {roster.slice(0, 4).map((tal) => (
                <PanelRow
                  key={tal.id}
                  leading={<StoryAvatar src={tal.avatar_url} name={tal.full_name || tal.username || ''} seed={tal.id} size={36} />}
                  title={tal.full_name || tal.username || '—'}
                  sub={[tal.username ? `@${tal.username}` : '', tal.category, tal.location].filter(Boolean).join(' · ')}
                  trailing={
                    <Link to="/dashboard/messages">
                      <Button variant="tertiary" size="sm">
                        <MessageSquare size={11} /> {t('mdash.message')}
                      </Button>
                    </Link>
                  }
                />
              ))}
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
                <span className={`truncate ${it.done ? 'v-ink' : 'v-quiet'}`}>{t(it.key)}</span>
              </li>
            ))}
          </ul>
          <Link to="/dashboard/profile" className="block mt-auto">
            <Button variant={completeness.pct >= 100 ? 'tertiary' : 'primary'} size="sm" fullWidth>
              <Pencil size={12} /> {t('cdash.editProfile')}
            </Button>
          </Link>
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
            <PanelRowsSkeleton n={2} />
          ) : contracts.length === 0 ? (
            <PanelEmpty icon={<FileText size={16} />} title={t('cdash.noContractsTitle')} desc={t('cdash.noContracts')} />
          ) : (
            <PanelRows>
              {contracts.slice(0, 3).map((c) => {
                const active = ['active', 'approved'].includes(String(c.status));
                const campaign = c.application?.campaign?.title;
                const partner = c.opponent_name || brandName(c.invitation) || (c.opponent_email ? String(c.opponent_email).split('@')[0] : '');
                const freq = c.payment_frequency ? t(`apps.freq.${c.payment_frequency}`, { defaultValue: String(c.payment_frequency).replace('_', ' ') }) : '';
                return (
                  <PanelRow
                    key={c.id}
                    leading={<StoryAvatar src={c.opponent_avatar} name={partner} seed={c.opponent_id || partner} size={36} />}
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
          { to: '/dashboard/offers', icon: <ShoppingBag size={16} />, title: t('side.offers'), desc: t('mdash.qlOffers') },
          { to: '/dashboard/messages', icon: <MessageSquare size={16} />, title: t('side.messages'), desc: t('dash.qlMessagesDesc') },
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

export default ManagerDashboard;
