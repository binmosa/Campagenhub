import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Inbox,
  Layers,
  MessageSquare,
  RotateCcw,
  SearchX,
  Star,
  Users,
  Video,
  XCircle,
} from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api, { serverOrigin } from '../../lib/api';
import { formatBudget, postedLabel } from '../../lib/campaignFormat';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_COLOR,
  CURRENCIES,
  PAYMENT_FREQUENCIES,
  hasPaymentDay,
  normalizeApplicationStatus,
  type ApplicationStatus,
} from '../../lib/catalog';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { ContractManager } from '../../components/contracts/ContractManager';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { BriefDetails } from '../../components/common/BriefDetails';
import FacetPopover from '../../components/common/FacetPopover';
import { Notice } from '../../components/common/Notice';
import SearchSelect from '../../components/common/SearchSelect';
import { TalentCard, TalentCardSkeleton } from '../../components/common/TalentCard';
import { ActiveFilterChips, DirectoryToolbar, type ActiveChip } from '../../components/common/filters';
import { fieldClass, type Talent } from '../talent/shared';

/**
 * BrandApplications — the applicant inbox. Every applicant is rendered
 * with the same TalentCard as the directory (story ring, platform rail,
 * real follower counts) plus their pitch; review happens in one modal
 * with the pipeline actions: shortlist → accept (with payment terms) or
 * decline, and message / contract once accepted.
 */
type SortKey = 'newest' | 'name';
type StatusFilter = 'all' | ApplicationStatus;

const GRID = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4';

const toTalent = (app: any): Talent => {
  const cp = app.creator?.creatorProfile || {};
  return {
    id: app.creator?.id || app.id,
    _type: 'creator',
    full_name: cp.full_name || [cp.first_name, cp.last_name].filter(Boolean).join(' ') || app.creator?.email?.split('@')[0],
    username: cp.username,
    avatar_url: cp.avatar_url,
    category: cp.category,
    location: cp.location,
    bio: cp.bio,
    social_links: cp.social_links,
    follower_range: cp.follower_range,
    user: { id: app.creator?.id },
  };
};

const videoSrc = (url?: string | null): string | null => {
  if (!url) return null;
  return url.startsWith('/') ? `${serverOrigin}${url}` : url;
};

const creatorName = (app: any) => toTalent(app).full_name || app.creator?.email || 'Creator';

/* ── Payment terms (accept + schedule) ───────────────────────────── */
const PaymentScheduleModal: React.FC<{
  app: any | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ app, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [day, setDay] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!app) return;
    setAmount(app.payment_amount != null ? String(Number(app.payment_amount)) : app.campaign?.budget != null ? String(Number(app.campaign.budget)) : '');
    setCurrency(app.currency || app.campaign?.currency || 'USD');
    setFrequency(app.payment_frequency || 'monthly');
    setDay(String(app.payment_day || 1));
    setNotes(app.notes || '');
    setError('');
  }, [app]);

  const save = async () => {
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) {
      setError(t('apps.errAmount'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (normalizeApplicationStatus(app.status) !== 'accepted') {
        await api.patch(`/applications/${app.id}/status`, { status: 'accepted' });
      }
      await api.patch(`/applications/${app.id}/payment-schedule`, {
        payment_amount: n,
        currency,
        payment_frequency: frequency,
        payment_day: hasPaymentDay(frequency) ? Number(day) : 1,
        notes,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || t('apps.errSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!app} onOpenChange={(open) => !open && !saving && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <DollarSign size={17} style={{ color: 'var(--color-campaign-purple)' }} />
                {normalizeApplicationStatus(app?.status) === 'accepted' ? t('apps.editTerms') : t('apps.acceptTitle')}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <p className="v-body v-muted">
                  {t('apps.acceptIntro', { name: app ? creatorName(app) : '', title: app?.campaign?.title || '' })}
                </p>
                {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
                <div className="grid grid-cols-[120px_1fr] gap-3">
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('wizard.currency')}</label>
                    <select className={fieldClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.amount')}</label>
                    <input type="number" min={0} step="0.01" className={fieldClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.frequency')}</label>
                    <select className={fieldClass} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                      {PAYMENT_FREQUENCIES.map((f) => (
                        <option key={f} value={f}>{t(`apps.freq.${f}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={hasPaymentDay(frequency) ? undefined : { opacity: 0.45, pointerEvents: 'none' }}>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.paymentDay')}</label>
                    <select className={fieldClass} value={day} onChange={(e) => setDay(e.target.value)} disabled={!hasPaymentDay(frequency)}>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.notes')}</label>
                  <textarea className={`${fieldClass} resize-none`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('apps.notesPh')} />
                </div>
                <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('apps.termsNote')}</p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={saving}>{t('common.cancel')}</Button>
              <Button variant="primary" onPress={save} isPending={saving}>
                <Check size={13} /> {normalizeApplicationStatus(app?.status) === 'accepted' ? t('apps.saveTerms') : t('apps.acceptBtn')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Page ────────────────────────────────────────────────────────── */
const BrandApplications: React.FC = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const [apps, setApps] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>(() => {
    const s = params.get('status');
    return s && (APPLICATION_STATUSES as readonly string[]).includes(s) ? (s as ApplicationStatus) : 'all';
  });
  const [campaignId, setCampaignId] = useState(params.get('campaign') || '');
  const [sort, setSort] = useState<SortKey>('newest');

  const [reviewing, setReviewing] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [paymentApp, setPaymentApp] = useState<any | null>(null);
  const [chatApp, setChatApp] = useState<any | null>(null);
  const [contractApp, setContractApp] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [a, c] = await Promise.all([
        api.get('/applications'),
        api.get('/campaigns/mine').catch(() => ({ data: [] })),
      ]);
      setApps(Array.isArray(a.data) ? a.data : []);
      setCampaigns(Array.isArray(c.data) ? c.data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get('/auth/me').then((r) => setCurrentUserId(r.data?.userId || r.data?.id || '')).catch(() => {});
  }, [load]);

  /* Keep the URL in sync so campaign cards can deep-link here */
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (campaignId) next.set('campaign', campaignId);
    else next.delete('campaign');
    if (status !== 'all') next.set('status', status);
    else next.delete('status');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, status]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: apps.length, pending: 0, shortlisted: 0, accepted: 0, rejected: 0, refunded: 0 };
    for (const a of apps) c[normalizeApplicationStatus(a.status)]++;
    return c;
  }, [apps]);

  const campaignOptions = useMemo(() => {
    const perCampaign = new Map<string, number>();
    for (const a of apps) if (a.campaign?.id) perCampaign.set(a.campaign.id, (perCampaign.get(a.campaign.id) || 0) + 1);
    const seen = new Set<string>();
    const opts = campaigns.map((c) => {
      seen.add(c.id);
      return { value: c.id, label: c.title, hint: String(perCampaign.get(c.id) || 0) };
    });
    for (const a of apps) {
      if (a.campaign?.id && !seen.has(a.campaign.id)) {
        seen.add(a.campaign.id);
        opts.push({ value: a.campaign.id, label: a.campaign.title, hint: String(perCampaign.get(a.campaign.id) || 0) });
      }
    }
    return opts;
  }, [apps, campaigns]);
  const campaignTitle = (id: string) => campaignOptions.find((o) => o.value === id)?.label || '';

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = apps.filter((a) => {
      if (status !== 'all' && normalizeApplicationStatus(a.status) !== status) return false;
      if (campaignId && a.campaign?.id !== campaignId) return false;
      if (q) {
        const talent = toTalent(a);
        const hay = `${talent.full_name || ''} ${talent.username || ''} ${a.creator?.email || ''} ${a.pitch || ''} ${a.campaign?.title || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) =>
      sort === 'name'
        ? (toTalent(a).full_name || '').localeCompare(toTalent(b).full_name || '')
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return list;
  }, [apps, search, status, campaignId, sort]);

  const activeChips = useMemo(() => {
    const chips: ActiveChip[] = [];
    if (search) chips.push({ key: 'search', label: t('talent.searchChip', { q: search }), onClear: () => setSearch('') });
    if (status !== 'all') chips.push({ key: 'status', label: t(`appStatus.${status}`), onClear: () => setStatus('all') });
    if (campaignId) chips.push({ key: 'campaign', label: campaignTitle(campaignId) || t('dash.campaign'), onClear: () => setCampaignId('') });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, campaignId, campaignOptions, t]);
  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setCampaignId('');
  };

  /* ── Actions ───────────────────────────────────────────────────── */
  const openReview = (app: any) => {
    setReviewing(app);
    setSubmissions([]);
    api
      .get(`/tracking/application/${app.id}/submissions`)
      .then((r) => setSubmissions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSubmissions([]));
  };

  const setStatusOf = async (app: any, next: ApplicationStatus) => {
    setBusy(true);
    try {
      await api.patch(`/applications/${app.id}/status`, { status: next });
      setNotice({ tone: 'success', text: t(`apps.statusChanged.${next}`, { name: creatorName(app) }) });
      setReviewing(null);
      await load();
    } catch (e: any) {
      setNotice({ tone: 'error', text: e?.response?.data?.message || t('apps.errSave') });
    } finally {
      setBusy(false);
    }
  };

  /* ── Render ────────────────────────────────────────────────────── */
  const kpis = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label={t('appStatus.pending')} value={counts.pending} hint={t('apps.kpiPendingHint')} icon={Clock} iconStatus={counts.pending ? 'warning' : undefined} />
      <MetricCard label={t('appStatus.shortlisted')} value={counts.shortlisted} hint={t('apps.kpiShortHint')} icon={Star} />
      <MetricCard label={t('appStatus.accepted')} value={counts.accepted} hint={t('apps.kpiAcceptedHint')} icon={CheckCircle2} iconStatus="success" />
      <MetricCard label={t('appStatus.rejected')} value={counts.rejected + counts.refunded} hint={t('apps.kpiRejectedHint')} icon={XCircle} />
    </div>
  );

  const reviewStatus = reviewing ? normalizeApplicationStatus(reviewing.status) : 'pending';
  const reviewVideo = videoSrc(reviewing?.video_pitch_url);

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('apps.title')}
      titleAccent={t('apps.titleAccent')}
      description={t('apps.desc')}
      icon={<Users size={18} />}
      stats={kpis}
    >
      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice>
      )}

      <div>
        <DirectoryToolbar
          leading={
            <Segment size="sm" selectedKey={status} onSelectionChange={(k) => setStatus(k as StatusFilter)} aria-label="Status">
              <Segment.Item id="all">{t('dash.all')} · {counts.all}</Segment.Item>
              <Segment.Item id="pending">{t('appStatus.pending')} · {counts.pending}</Segment.Item>
              <Segment.Item id="shortlisted">{t('appStatus.shortlisted')} · {counts.shortlisted}</Segment.Item>
              <Segment.Item id="accepted">{t('appStatus.accepted')} · {counts.accepted}</Segment.Item>
              <Segment.Item id="rejected">{t('appStatus.rejected')} · {counts.rejected}</Segment.Item>
            </Segment>
          }
          search={{ value: search, onChange: setSearch, placeholder: t('apps.searchPh'), widthClass: 'w-full sm:w-[240px]' }}
          count={loading ? t('common.searching') : t('board.count', { shown: visible.length, total: apps.length })}
        >
          <FacetPopover label={t('dash.campaign')} width={300} badge={campaignId ? campaignTitle(campaignId) : undefined}>
            <SearchSelect
              aria-label="Campaign"
              placeholder={campaignOptions.length ? t('apps.pickCampaign') : t('dash.noCampaignsTitle')}
              disabled={campaignOptions.length === 0}
              options={campaignOptions}
              value={campaignId}
              onChange={setCampaignId}
            />
          </FacetPopover>
          <Segment size="sm" selectedKey={sort} onSelectionChange={(k) => setSort(k as SortKey)} aria-label="Sort">
            <Segment.Item id="newest">{t('board.sortNewest')}</Segment.Item>
            <Segment.Item id="name">{t('talent.sortAZ')}</Segment.Item>
          </Segment>
        </DirectoryToolbar>
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
      </div>

      {loading ? (
        <div className={GRID} aria-label="Loading applicants">
          {Array.from({ length: 6 }).map((_, i) => (
            <TalentCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyPanel
          tone="error"
          icon={<AlertTriangle size={22} />}
          title={t('board.errTitle')}
          description={t('board.errDesc')}
          actions={<Button variant="primary" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>}
        />
      ) : apps.length === 0 ? (
        <EmptyPanel
          icon={<Inbox size={22} />}
          title={t('apps.emptyTitle')}
          description={t('apps.emptyDesc')}
          actions={
            <>
              <Link to="/dashboard/campaigns?new=1">
                <Button variant="primary">
                  <Briefcase size={13} /> {t('dash.newCampaign')}
                </Button>
              </Link>
              <Link to="/dashboard/talent">
                <Button variant="tertiary">{t('dash.browseTalent')}</Button>
              </Link>
            </>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyPanel
          size="sm"
          icon={<SearchX size={20} />}
          title={t('board.emptyTitle')}
          description={t('board.emptyStatus')}
          actions={<Button variant="primary" size="sm" onPress={resetFilters}>{t('board.resetFilters')}</Button>}
        />
      ) : (
        <div className={GRID}>
          {visible.map((app, i) => {
            const s = normalizeApplicationStatus(app.status);
            const when = postedLabel(app.created_at);
            return (
              <TalentCard
                key={app.id}
                talent={toTalent(app)}
                index={i}
                canInvite={false}
                loggedIn
                viewerIsCreator={false}
                onInvite={() => {}}
                badge={
                  <Chip color={APPLICATION_STATUS_COLOR[s]} variant="soft" size="sm" className="shrink-0">
                    <Chip.Label>{t(`appStatus.${s}`)}</Chip.Label>
                  </Chip>
                }
                extra={
                  <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="v-caption v-quiet font-medium uppercase tracking-wider inline-flex items-center gap-1" style={{ fontSize: 10 }}>
                        <Layers size={10} /> {t('apps.pitch')}
                      </span>
                      <span className="v-caption v-quiet inline-flex items-center gap-2" style={{ fontSize: 10.5 }}>
                        {app.video_pitch_url && (
                          <span className="inline-flex items-center gap-0.5" style={{ color: 'var(--color-campaign-purple)' }}>
                            <Video size={10} /> {t('apps.video')}
                          </span>
                        )}
                        {when}
                      </span>
                    </div>
                    <p className="v-body v-ink line-clamp-3" style={{ fontSize: 12.5, minHeight: 54 }}>
                      {app.pitch || t('apps.noPitch')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCampaignId(app.campaign?.id || '')}
                      className="mt-2 v-caption inline-flex items-center gap-1 hover:underline truncate max-w-full"
                      style={{ fontSize: 11, color: 'var(--color-campaign-purple)' }}
                      title={app.campaign?.title}
                    >
                      <Briefcase size={10} className="shrink-0" /> <span className="truncate">{app.campaign?.title}</span>
                    </button>
                  </div>
                }
                actions={
                  <Button variant={s === 'pending' ? 'primary' : 'tertiary'} size="sm" onPress={() => openReview(app)}>
                    {s === 'pending' ? t('apps.review') : t('apps.open')}
                  </Button>
                }
              />
            );
          })}
        </div>
      )}

      {/* ── Review modal ───────────────────────────────────────────── */}
      <Modal isOpen={!!reviewing} onOpenChange={(open) => !open && !busy && setReviewing(null)}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <Modal.Container>
            <Modal.Dialog className="!max-w-2xl">
              <Modal.CloseTrigger />
              {reviewing && (
                <>
                  <Modal.Header>
                    <Modal.Heading className="flex items-center gap-2 flex-wrap">
                      {creatorName(reviewing)}
                      <Chip color={APPLICATION_STATUS_COLOR[reviewStatus]} variant="soft" size="sm">
                        <Chip.Label>{t(`appStatus.${reviewStatus}`)}</Chip.Label>
                      </Chip>
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-3 flex-wrap v-caption" style={{ fontSize: 12.5 }}>
                        <span className="inline-flex items-center gap-1.5 v-muted">
                          <Briefcase size={12} /> {reviewing.campaign?.title}
                        </span>
                        {reviewing.campaign?.budget != null && (
                          <span className="v-ink font-medium tabular-nums inline-flex items-center gap-1">
                            <DollarSign size={12} style={{ color: '#0b6e3e' }} />
                            {formatBudget(reviewing.campaign.budget, reviewing.campaign.currency || 'USD')} · {t('card.budget')}
                          </span>
                        )}
                      </div>

                      <BriefDetails campaign={reviewing.campaign} compact />

                      {reviewVideo && (
                        <div>
                          <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2 inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}>
                            <Video size={11} style={{ color: 'var(--color-campaign-purple)' }} /> {t('board.videoPitch')}
                          </div>
                          <video src={reviewVideo} controls preload="metadata" className="w-full rounded-xl v-hairline" style={{ maxHeight: 320, background: '#0b1736' }} />
                        </div>
                      )}

                      <div>
                        <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2 inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}>
                          <Layers size={11} /> {t('board.writtenPitch')}
                        </div>
                        <div className="rounded-xl p-4 v-body v-ink whitespace-pre-wrap" style={{ background: 'rgba(244,242,255,0.5)', border: '1px solid var(--color-cool-gray)', fontSize: 13.5, lineHeight: 1.6 }}>
                          {reviewing.pitch || t('apps.noPitch')}
                        </div>
                      </div>

                      {reviewStatus === 'accepted' && (
                        <div className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'linear-gradient(135deg, rgba(22,199,132,0.10) 0%, rgba(0,212,199,0.12) 100%)', border: '1px solid rgba(22,199,132,0.20)' }}>
                          <div>
                            <div className="v-caption font-medium" style={{ color: '#0b6e3e', fontSize: 11.5 }}>{t('apps.termsTitle')}</div>
                            <div className="font-semibold tabular-nums" style={{ color: '#0b6e3e', fontSize: 20 }}>
                              {reviewing.payment_amount ? formatBudget(reviewing.payment_amount, reviewing.currency || 'USD') : '—'}
                              {reviewing.payment_frequency && (
                                <span className="v-caption font-normal" style={{ fontSize: 12, opacity: 0.8 }}> / {t(`apps.freq.${reviewing.payment_frequency}`, { defaultValue: reviewing.payment_frequency })}</span>
                              )}
                            </div>
                          </div>
                          {hasPaymentDay(reviewing.payment_frequency) && (
                            <span className="v-caption" style={{ color: '#0b6e3e', fontSize: 11.5 }}>
                              {t('apps.dayN', { n: reviewing.payment_day || 1 })}
                            </span>
                          )}
                        </div>
                      )}

                      <div>
                        <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2 inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}>
                          <FileText size={11} /> {t('apps.deliverables')}
                        </div>
                        {submissions.length === 0 ? (
                          <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('apps.noDeliverables')}</p>
                        ) : (
                          <ul className="space-y-2 max-h-56 overflow-y-auto">
                            {submissions.map((sub: any) => (
                              <li key={sub.id} className="rounded-lg p-3 v-hairline flex items-center justify-between gap-3">
                                <a href={sub.url} target="_blank" rel="noopener noreferrer" className="v-body truncate hover:underline" style={{ color: 'var(--color-campaign-purple)', fontSize: 12.5 }}>
                                  {sub.url}
                                </a>
                                <Chip color={sub.ai_verification_status === 'verified' ? 'success' : 'warning'} variant="soft" size="sm">
                                  <Chip.Label>{sub.ai_verification_status || 'pending'}</Chip.Label>
                                </Chip>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </Modal.Body>
                  <Modal.Footer>
                    <div className="flex items-center justify-between w-full gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {(reviewStatus === 'pending' || reviewStatus === 'shortlisted') && (
                          <Button variant="ghost" className="!text-danger" onPress={() => setStatusOf(reviewing, 'rejected')} isDisabled={busy}>
                            <XCircle size={13} /> {t('apps.decline')}
                          </Button>
                        )}
                        {(reviewStatus === 'rejected' || reviewStatus === 'refunded') && (
                          <Button variant="ghost" onPress={() => setStatusOf(reviewing, 'pending')} isDisabled={busy}>
                            <RotateCcw size={13} /> {t('apps.reconsider')}
                          </Button>
                        )}
                        {reviewStatus === 'accepted' && (
                          <>
                            <Button variant="tertiary" onPress={() => setChatApp(reviewing)}>
                              <MessageSquare size={13} /> {t('apps.message')}
                            </Button>
                            <Button variant="tertiary" onPress={() => setContractApp(reviewing)}>
                              <FileText size={13} /> {t('apps.contract')}
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {reviewStatus === 'pending' && (
                          <Button variant="tertiary" onPress={() => setStatusOf(reviewing, 'shortlisted')} isDisabled={busy}>
                            <Star size={13} /> {t('apps.shortlist')}
                          </Button>
                        )}
                        {(reviewStatus === 'pending' || reviewStatus === 'shortlisted') && (
                          <Button variant="primary" onPress={() => setPaymentApp(reviewing)} isDisabled={busy}>
                            <Check size={13} /> {t('apps.accept')}
                          </Button>
                        )}
                        {reviewStatus === 'accepted' && (
                          <Button variant="primary" onPress={() => setPaymentApp(reviewing)}>
                            <DollarSign size={13} /> {t('apps.editTerms')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <PaymentScheduleModal
        app={paymentApp}
        onClose={() => setPaymentApp(null)}
        onSaved={() => {
          setNotice({ tone: 'success', text: t('apps.statusChanged.accepted', { name: paymentApp ? creatorName(paymentApp) : '' }) });
          setReviewing(null);
          load();
        }}
      />

      {chatApp && (
        <ChatWindow
          applicationId={chatApp.id}
          currentUserId={currentUserId}
          onClose={() => setChatApp(null)}
          creatorName={creatorName(chatApp)}
          avatarUrl={toTalent(chatApp).avatar_url}
          subtitle={chatApp.campaign?.title}
        />
      )}
      {contractApp && (
        <ContractManager applicationId={contractApp.id} isBrand application={contractApp} onClose={() => setContractApp(null)} />
      )}
    </PageShell>
  );
};

export default BrandApplications;
