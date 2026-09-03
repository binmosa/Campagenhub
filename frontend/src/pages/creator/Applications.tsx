import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Link2,
  MessageSquare,
  Search as SearchIcon,
  SearchX,
  Send,
  Sparkles,
  Star,
} from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { toast } from '../../lib/toast';
import { formatBudget } from '../../lib/campaignFormat';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_COLOR,
  normalizeApplicationStatus,
  type ApplicationStatus,
} from '../../lib/catalog';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { ContractManager } from '../../components/contracts/ContractManager';
import { MetricCard, PageShell } from '../../components/ui';
import CampaignCard, { CampaignCardSkeleton } from '../../components/common/CampaignCard';
import { BriefDetails } from '../../components/common/BriefDetails';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { Notice } from '../../components/common/Notice';
import { ActiveFilterChips, DirectoryToolbar, type ActiveChip } from '../../components/common/filters';
import { fieldClass } from '../talent/shared';
import PublicCampaigns from '../PublicCampaigns';

/**
 * Creator Campaigns — two tabs on one hero page:
 *   Browse            the public marketplace, embedded (same filters, cards)
 *   My applications   every brief applied to, as the same campaign card with
 *                     the pipeline status, message / contract / submit actions
 */
type Tab = 'browse' | 'applications';
type StatusFilter = 'all' | ApplicationStatus;
const GRID = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4';
const URL_RE = /^https?:\/\/\S+$/i;

const usdOf = (c: any): number => {
  if (!c) return 0;
  if (c.budget_usd != null) return Number(c.budget_usd) || 0;
  if ((c.currency || 'USD') === 'USD') return Number(c.budget) || 0;
  return 0;
};

const CreatorApplications: React.FC = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (params.get('tab') === 'browse' ? 'browse' : params.get('tab') === 'applications' ? 'applications' : 'browse'));
  const [status, setStatus] = useState<StatusFilter>(() => {
    const s = params.get('status');
    return s && (APPLICATION_STATUSES as readonly string[]).includes(s) ? (s as ApplicationStatus) : 'all';
  });
  const [query, setQuery] = useState('');

  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');

  const [detailApp, setDetailApp] = useState<any | null>(null);
  const [submittingApp, setSubmittingApp] = useState<any | null>(null);
  const [contentLink, setContentLink] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitPending, setSubmitPending] = useState(false);
  const [chatApp, setChatApp] = useState<any | null>(null);
  const [contractApp, setContractApp] = useState<any | null>(null);

  const load = () => {
    setError(false);
    api
      .get('/applications')
      .then((res) => setApplications(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    api.get('/auth/me').then((res) => setCurrentUserId(res.data?.userId || res.data?.id || '')).catch(() => {});
  }, []);

  /* Keep tab + status in the URL for deep links from the dashboard */
  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set('tab', tab);
    if (status !== 'all') next.set('status', status);
    else next.delete('status');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, status]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: applications.length, pending: 0, shortlisted: 0, accepted: 0, rejected: 0, refunded: 0 };
    for (const a of applications) c[normalizeApplicationStatus(a.status)]++;
    return c;
  }, [applications]);

  const wonUsd = useMemo(
    () => applications.filter((a) => normalizeApplicationStatus(a.status) === 'accepted').reduce((s, a) => s + usdOf(a.campaign), 0),
    [applications],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications.filter((a) => {
      if (status !== 'all' && normalizeApplicationStatus(a.status) !== status) return false;
      if (q) {
        const hay = `${a.campaign?.title || ''} ${a.campaign?.brand?.brandProfile?.company_name || ''} ${a.pitch || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [applications, status, query]);

  const activeChips = useMemo(() => {
    const chips: ActiveChip[] = [];
    if (query) chips.push({ key: 'q', label: t('talent.searchChip', { q: query }), onClear: () => setQuery('') });
    if (status !== 'all') chips.push({ key: 'status', label: t(`appStatus.${status}`), onClear: () => setStatus('all') });
    return chips;
  }, [query, status, t]);

  const submitContent = async () => {
    const url = contentLink.trim();
    if (!URL_RE.test(url)) return setSubmitError(t('wizard.errMediaUrl'));
    setSubmitPending(true);
    setSubmitError('');
    try {
      await api.post(`/tracking/application/${submittingApp.id}/link`, { url });
      toast.success(t('capps.submitted'));
      setSubmittingApp(null);
      setContentLink('');
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || t('capps.submitFailed'));
    } finally {
      setSubmitPending(false);
    }
  };

  const kpis = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label={t('cdash.kpiApplications')} value={counts.all} hint={t('capps.kpiAllHint')} icon={Briefcase} />
      <MetricCard label={t('appStatus.pending')} value={counts.pending + counts.shortlisted} hint={t('capps.kpiPendingHint', { n: counts.shortlisted })} icon={Clock} iconStatus={counts.pending ? 'warning' : undefined} />
      <MetricCard label={t('appStatus.accepted')} value={counts.accepted} hint={t('cdash.kpiRate', { pct: counts.all ? Math.round((counts.accepted / counts.all) * 100) : 0 })} icon={CheckCircle2} iconStatus="success" />
      <MetricCard label={t('capps.kpiWon')} value={formatBudget(wonUsd, 'USD')} hint={t('capps.kpiWonHint')} icon={DollarSign} />
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={tab === 'browse' ? t('capps.browseTitle') : t('capps.appsTitle')}
      titleAccent={tab === 'browse' ? t('capps.browseAccent') : t('capps.appsAccent')}
      description={tab === 'browse' ? t('capps.browseDesc') : t('capps.appsDesc')}
      icon={<Briefcase size={18} />}
      actions={
        <Segment size="md" selectedKey={tab} onSelectionChange={(k) => setTab(k as Tab)} aria-label="View">
          <Segment.Item id="browse">
            <SearchIcon className="size-3.5" /> {t('capps.tabBrowse')}
          </Segment.Item>
          <Segment.Item id="applications">
            <Briefcase className="size-3.5" /> {t('capps.tabApps')} · {counts.all}
          </Segment.Item>
        </Segment>
      }
      stats={tab === 'applications' ? kpis : undefined}
    >
      {tab === 'browse' ? (
        <PublicCampaigns isDashboard />
      ) : (
        <>
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
              search={{ value: query, onChange: setQuery, placeholder: t('capps.searchPh'), widthClass: 'w-full sm:w-[240px]' }}
              count={loading ? t('common.searching') : t('board.count', { shown: visible.length, total: applications.length })}
            />
            <ActiveFilterChips chips={activeChips} onClearAll={() => { setQuery(''); setStatus('all'); }} />
          </div>

          {loading ? (
            <div className={GRID}>
              {Array.from({ length: 3 }).map((_, i) => (
                <CampaignCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <EmptyPanel tone="error" icon={<AlertTriangle size={22} />} title={t('board.errTitle')} description={t('board.errDesc')} actions={<Button variant="primary" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>} />
          ) : applications.length === 0 ? (
            <EmptyPanel
              icon={<Briefcase size={22} />}
              title={t('cdash.noAppsTitle')}
              description={t('capps.emptyDesc')}
              actions={
                <Button variant="primary" onPress={() => setTab('browse')}>
                  <Sparkles size={13} /> {t('cdash.browse')}
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyPanel size="sm" icon={<SearchX size={20} />} title={t('board.emptyTitle')} description={t('board.emptyStatus')} actions={<Button variant="primary" size="sm" onPress={() => { setQuery(''); setStatus('all'); }}>{t('board.resetFilters')}</Button>} />
          ) : (
            <div className={GRID}>
              {visible.map((app, i) => {
                const s = normalizeApplicationStatus(app.status);
                const accepted = s === 'accepted';
                return (
                  <CampaignCard
                    key={app.id}
                    camp={app.campaign || {}}
                    index={i}
                    applied
                    loggedIn
                    isCreator
                    onApply={() => {}}
                    onOpen={() => setDetailApp(app)}
                    corner={
                      <Chip color={APPLICATION_STATUS_COLOR[s]} variant="soft" size="sm" className="shrink-0">
                        {s === 'shortlisted' && <Star size={10} />}
                        <Chip.Label>{t(`appStatus.${s}`)}</Chip.Label>
                      </Chip>
                    }
                    actions={
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" isIconOnly aria-label={t('apps.message')} onPress={() => setChatApp(app)}>
                          <MessageSquare size={13} />
                        </Button>
                        {accepted && (
                          <Button variant="ghost" size="sm" isIconOnly aria-label={t('apps.contract')} onPress={() => setContractApp(app)}>
                            <FileText size={13} />
                          </Button>
                        )}
                        {accepted ? (
                          <Button variant="primary" size="sm" onPress={() => { setSubmittingApp(app); setContentLink(''); setSubmitError(''); }}>
                            <Link2 size={11} /> {t('capps.submit')}
                          </Button>
                        ) : (
                          <Button variant="tertiary" size="sm" onPress={() => setDetailApp(app)}>
                            {t('apps.open')}
                          </Button>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Application detail ────────────────────────────────────── */}
      <Modal isOpen={!!detailApp} onOpenChange={(open) => !open && setDetailApp(null)}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <Modal.Container>
            <Modal.Dialog className="!max-w-2xl">
              <Modal.CloseTrigger />
              {detailApp && (
                <>
                  <Modal.Header>
                    <Modal.Heading className="flex items-center gap-2 flex-wrap">
                      {detailApp.campaign?.title}
                      <Chip color={APPLICATION_STATUS_COLOR[normalizeApplicationStatus(detailApp.status)]} variant="soft" size="sm">
                        <Chip.Label>{t(`appStatus.${normalizeApplicationStatus(detailApp.status)}`)}</Chip.Label>
                      </Chip>
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-3 flex-wrap v-caption" style={{ fontSize: 12.5 }}>
                        <span className="v-muted">{detailApp.campaign?.brand?.brandProfile?.company_name || ''}</span>
                        {detailApp.campaign?.budget != null && (
                          <span className="v-ink font-medium tabular-nums" style={{ color: '#0b6e3e' }}>
                            {formatBudget(detailApp.campaign.budget, detailApp.campaign.currency || 'USD')} · {t('card.budget')}
                          </span>
                        )}
                      </div>
                      {detailApp.campaign?.description && (
                        <p className="v-body v-ink" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{detailApp.campaign.description}</p>
                      )}
                      <BriefDetails campaign={detailApp.campaign} />
                      <div>
                        <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2" style={{ fontSize: 10.5 }}>{t('capps.yourPitch')}</div>
                        <div className="rounded-xl p-4 v-body v-ink whitespace-pre-wrap" style={{ background: 'rgba(244,242,255,0.5)', border: '1px solid var(--color-cool-gray)', fontSize: 13.5, lineHeight: 1.6 }}>
                          {detailApp.pitch || t('apps.noPitch')}
                        </div>
                      </div>
                      {normalizeApplicationStatus(detailApp.status) === 'accepted' && detailApp.payment_amount && (
                        <div className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'linear-gradient(135deg, rgba(22,199,132,0.10) 0%, rgba(0,212,199,0.12) 100%)', border: '1px solid rgba(22,199,132,0.20)' }}>
                          <span className="v-caption font-medium" style={{ color: '#0b6e3e', fontSize: 11.5 }}>{t('apps.termsTitle')}</span>
                          <span className="font-semibold tabular-nums" style={{ color: '#0b6e3e', fontSize: 18 }}>
                            {formatBudget(detailApp.payment_amount, detailApp.currency || 'USD')}
                            {detailApp.payment_frequency && <span className="v-caption font-normal" style={{ fontSize: 12, opacity: 0.8 }}> / {t(`apps.freq.${detailApp.payment_frequency}`, { defaultValue: detailApp.payment_frequency })}</span>}
                          </span>
                        </div>
                      )}
                    </div>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="ghost" onPress={() => setDetailApp(null)}>{t('common.close')}</Button>
                    <Button variant="tertiary" onPress={() => { setChatApp(detailApp); setDetailApp(null); }}>
                      <MessageSquare size={13} /> {t('apps.message')}
                    </Button>
                    {normalizeApplicationStatus(detailApp.status) === 'accepted' && (
                      <Button variant="primary" onPress={() => { setContractApp(detailApp); setDetailApp(null); }}>
                        <FileText size={13} /> {t('apps.contract')}
                      </Button>
                    )}
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Submit content link ───────────────────────────────────── */}
      <Modal isOpen={!!submittingApp} onOpenChange={(open) => !open && !submitPending && setSubmittingApp(null)}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="flex items-center gap-2">
                  <Send size={16} style={{ color: 'var(--color-campaign-purple)' }} /> {t('capps.submitTitle')}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-4">
                  <p className="v-body v-muted" style={{ fontSize: 13 }}>{t('capps.submitDesc', { title: submittingApp?.campaign?.title || '' })}</p>
                  {submitError && <Notice tone="error" onDismiss={() => setSubmitError('')}>{submitError}</Notice>}
                  <label className="block">
                    <span className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('capps.linkLabel')}</span>
                    <div className="relative">
                      <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet pointer-events-none" />
                      <input
                        type="url"
                        className={`${fieldClass} !pl-9`}
                        placeholder="https://instagram.com/p/…"
                        value={contentLink}
                        onChange={(e) => setContentLink(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitContent()}
                        autoFocus
                      />
                    </div>
                  </label>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setSubmittingApp(null)} isDisabled={submitPending}>{t('common.cancel')}</Button>
                <Button variant="primary" isDisabled={!contentLink.trim()} isPending={submitPending} onPress={submitContent}>
                  <Send size={13} /> {t('capps.submit')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {chatApp && (
        <ChatWindow
          applicationId={chatApp.id}
          currentUserId={currentUserId}
          onClose={() => setChatApp(null)}
          brandName={chatApp.campaign?.brand?.brandProfile?.company_name || chatApp.campaign?.brand?.email}
          avatarUrl={chatApp.campaign?.brand?.brandProfile?.logo_url}
          subtitle={chatApp.campaign?.title}
        />
      )}
      {contractApp && (
        <ContractManager applicationId={contractApp.id} isBrand={false} application={contractApp} onClose={() => setContractApp(null)} />
      )}
    </PageShell>
  );
};

export default CreatorApplications;
