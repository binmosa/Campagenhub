import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Building2,
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
import { TalentCard, TalentCardSkeleton } from '../../components/common/TalentCard';
import { accentFor, type Talent } from '../talent/shared';

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
    ])
      .then(([meRes, prof, inv, snt, conts, tks, txs]) => {
        setMe(meRes.data);
        setProfile(prof.data);
        setReceived(Array.isArray(inv.data) ? inv.data : []);
        setSent(Array.isArray(snt.data) ? snt.data : []);
        setContracts(Array.isArray(conts.data) ? conts.data : []);
        setTasks(Array.isArray(tks.data) ? tks.data : []);
        setTransactions(Array.isArray(txs.data) ? txs.data : []);
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
    const checks = [p.full_name || p.first_name, p.avatar_url, p.bio, p.specialty, p.services, p.country || p.location, Number(p.experience_years) > 0];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
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
        value={clients.length}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 space-y-5">
          {/* Brand clients */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
                <Building2 size={15} style={{ color: 'var(--color-campaign-purple)' }} /> {t('mdash.clients')}
              </h2>
              <Link to="/dashboard/invitations">
                <Button variant="ghost" size="sm">
                  {t('dash.seeAll')} <ArrowRight size={11} />
                </Button>
              </Link>
            </div>
            {loading ? (
              <div className="v-talent-card p-4" aria-hidden>
                <div className="v-skel h-4 w-1/3 mb-2" />
                <div className="v-skel h-3 w-2/3" />
              </div>
            ) : clients.length === 0 ? (
              <EmptyPanel
                icon={<Building2 size={22} />}
                title={t('mdash.noClientsTitle')}
                description={t('mdash.noClientsDesc')}
                actions={
                  <Link to="/dashboard/profile">
                    <Button variant="primary"><Pencil size={13} /> {t('cdash.editProfile')}</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="v-talent-card divide-y divide-border">
                {clients.slice(0, 5).map((inv) => {
                  const name = brandName(inv) || t('side.roleBrand');
                  const logo = inv?.sender?.brandProfile?.logo_url || inv?.brand?.brandProfile?.logo_url;
                  const accent = accentFor(name);
                  return (
                    <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="v-story-ring" style={{ padding: 2 }}>
                        {logo ? (
                          <img src={logo} alt="" className="h-9 w-9 object-cover" />
                        ) : (
                          <span className="inline-flex h-9 w-9 items-center justify-center text-sm font-medium text-white" style={{ background: accent.from }}>{name[0]?.toUpperCase()}</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{name}</div>
                        <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                          {t('mdash.since', { when: postedLabel(inv.created_at) })}
                          {inv.payment_amount ? ` · ${formatBudget(inv.payment_amount, inv.currency || 'USD')}${inv.payment_frequency ? ` / ${t(`apps.freq.${inv.payment_frequency}`, { defaultValue: inv.payment_frequency })}` : ''}` : ''}
                        </div>
                      </div>
                      <Chip color={INV_COLOR[inv.status] || 'default'} variant="soft" size="sm">
                        <Chip.Label>{t(`appStatus.${inv.status}`, { defaultValue: inv.status })}</Chip.Label>
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Creator roster */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
                <Users size={15} style={{ color: 'var(--color-campaign-purple)' }} /> {t('mdash.roster')}
              </h2>
              <Link to="/dashboard/talent">
                <Button variant="ghost" size="sm">
                  {t('dash.findTalent')} <ArrowRight size={11} />
                </Button>
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[0, 1].map((i) => <TalentCardSkeleton key={i} />)}
              </div>
            ) : roster.length === 0 ? (
              <EmptyPanel
                icon={<Users size={22} />}
                title={t('mdash.noRosterTitle')}
                description={t('mdash.noRosterDesc')}
                actions={
                  <Link to="/dashboard/talent">
                    <Button variant="primary"><Star size={13} /> {t('dash.findTalent')}</Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {roster.slice(0, 4).map((tal, i) => (
                  <TalentCard
                    key={tal.id}
                    talent={tal}
                    index={i}
                    canInvite={false}
                    loggedIn
                    viewerIsCreator={false}
                    onInvite={() => {}}
                    actions={
                      <Link to="/dashboard/messages">
                        <Button variant="ghost" size="sm" className="!px-2.5">
                          <MessageSquare size={11} /> {t('side.messages')}
                        </Button>
                      </Link>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          {/* Reputation */}
          <div className="v-talent-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 15 }}>
                <Award size={14} style={{ color: 'var(--color-campaign-purple)' }} /> {t('mdash.reputation')}
              </h2>
              <span className="inline-flex items-center gap-1 v-ink font-medium tabular-nums" style={{ fontSize: 18 }}>
                <Star size={14} className="fill-warning text-warning" /> {rating.toFixed(1)}
              </span>
            </div>
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
                        <div className="v-ink font-medium truncate" style={{ fontSize: 13 }}>{c.title || c.application?.campaign?.title || brandName(c.invitation) || '—'}</div>
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
