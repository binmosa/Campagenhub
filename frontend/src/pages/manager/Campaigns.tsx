import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Briefcase, Building2, Check, Clock, DollarSign, Plus, Search as SearchIcon, Send, Users, X } from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import api from '../../lib/api';
import { formatBudget, postedLabel } from '../../lib/campaignFormat';
import { CURRENCIES, PAYMENT_FREQUENCIES, normalizeCampaignStatus, CAMPAIGN_STATUS_COLOR } from '../../lib/catalog';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { DashPanel, PanelEmpty } from '../../components/common/DashPanel';
import { DirectoryToolbar } from '../../components/common/filters';
import { StoryAvatar } from '../../components/common/StoryAvatar';
import { Notice } from '../../components/common/Notice';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { CampaignWizard } from '../../components/common/CampaignWizard';
import { toast } from '../../lib/toast';
import { fieldClass } from '../talent/shared';

/**
 * ManagerCampaigns — an account manager's way in and their day job.
 *
 * A manager is a service provider: until a brand engages them they can only
 * browse open campaigns and offer to run one. Once a brand accepts, the
 * engagement says exactly how many briefs they may create and how much
 * budget they may commit, and this page keeps that in view.
 */
type Engagement = {
  id: string;
  brand: any;
  permissions: Record<string, boolean>;
  grant: { campaign_limit: number | null; budget_cap: number | null; campaigns: string[] };
  usage: { campaigns_created: number; budget_used: number; campaigns_managed: number };
  payment_amount?: number | string | null;
  currency?: string;
  payment_frequency?: string;
};
type Offer = { id: string; status: string; pitch?: string; proposed_fee?: number | string | null; currency?: string; fee_frequency?: string; created_at: string; campaign: any; brand: any; decision_note?: string | null };

type Tab = 'managed' | 'open' | 'offers';

const brandName = (b: any) => b?.brandProfile?.company_name || b?.email?.split('@')[0] || '';

/* ── Offer to manage a campaign ─────────────────────────────────── */
const OfferModal: React.FC<{ campaign: any; onClose: () => void; onSent: () => void }> = ({ campaign, onClose, onSent }) => {
  const { t } = useTranslation();
  const [pitch, setPitch] = useState('');
  const [fee, setFee] = useState('');
  const [currency, setCurrency] = useState(campaign?.currency || 'USD');
  const [frequency, setFrequency] = useState('one_time');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (!pitch.trim()) return setError(t('mcamp.errPitch'));
    setSending(true);
    setError('');
    try {
      await api.post('/manager-applications', {
        campaignId: campaign.id,
        pitch: pitch.trim(),
        proposed_fee: fee ? Number(fee) : undefined,
        currency,
        fee_frequency: frequency,
      });
      toast.success(t('mcamp.offerSent', { title: campaign.title }));
      onSent();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || t('mcamp.errSend'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && !sending && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <span className="v-hero-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                  <Send size={15} />
                </span>
                {t('mcamp.offerTitle')}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <p className="v-body v-muted" style={{ fontSize: 13 }}>{t('mcamp.offerIntro', { title: campaign?.title, brand: brandName(campaign?.brand) })}</p>
                {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
                <div className="rounded-xl p-3 flex items-center gap-2 flex-wrap" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }}>
                  {campaign?.budget != null && (
                    <Chip color="success" variant="soft" size="sm">
                      <Chip.Label className="tabular-nums">{formatBudget(Number(campaign.budget), campaign.currency || 'USD')} · {t('card.budget')}</Chip.Label>
                    </Chip>
                  )}
                  {campaign?.platform && (
                    <Chip variant="soft" size="sm" color="default">
                      <Chip.Label>{campaign.platform}</Chip.Label>
                    </Chip>
                  )}
                  <Chip variant="soft" size="sm" color="default">
                    <Chip.Label>{t('mcamp.applicantsN', { count: Number(campaign?.applicants_count) || 0 })}</Chip.Label>
                  </Chip>
                </div>
                <div>
                  <label htmlFor="offer-pitch" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('mcamp.pitch')} *</label>
                  <textarea id="offer-pitch" rows={4} className={`${fieldClass} resize-y`} value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder={t('mcamp.pitchPh')} />
                </div>
                <div className="grid grid-cols-[100px_1fr_150px] gap-3">
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('wizard.currency')}</label>
                    <select className={fieldClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="offer-fee" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('mcamp.fee')}</label>
                    <input id="offer-fee" type="number" min={0} step="0.01" className={fieldClass} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="500" />
                  </div>
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.frequency')}</label>
                    <select className={fieldClass} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                      {PAYMENT_FREQUENCIES.map((f) => (
                        <option key={f} value={f}>{t(`apps.freq.${f}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('mcamp.offerNote')}</p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={sending}>{t('common.cancel')}</Button>
              <Button variant="primary" onPress={send} isPending={sending} isDisabled={!pitch.trim()}>
                <Send size={13} /> {t('mcamp.sendOffer')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Page ───────────────────────────────────────────────────────── */
const ManagerCampaigns: React.FC = () => {
  const { t } = useTranslation();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [managed, setManaged] = useState<any[]>([]);
  const [open, setOpen] = useState<any[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('managed');
  const [search, setSearch] = useState('');
  const [offering, setOffering] = useState<any | null>(null);
  const [withdrawing, setWithdrawing] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const [wizardBrand, setWizardBrand] = useState<Engagement | null>(null);

  const load = useCallback(async () => {
    try {
      const [eng, mine, myOffers] = await Promise.all([
        api.get('/manager-applications/engagements').catch(() => ({ data: [] })),
        api.get('/campaigns/mine').catch(() => ({ data: [] })),
        api.get('/manager-applications/mine').catch(() => ({ data: [] })),
      ]);
      setEngagements(Array.isArray(eng.data) ? eng.data : []);
      setManaged(Array.isArray(mine.data) ? mine.data : []);
      setOffers(Array.isArray(myOffers.data) ? myOffers.data : []);
      if ((eng.data || []).length === 0) setTab('open');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab !== 'open') return;
    api
      .get('/campaigns/public-list', { params: { limit: 24, sort: 'newest' } })
      .then((res) => setOpen(res.data?.items || []))
      .catch(() => setOpen([]));
  }, [tab]);

  const offeredIds = useMemo(() => new Set(offers.filter((o) => ['pending', 'accepted'].includes(o.status)).map((o) => o.campaign?.id)), [offers]);
  const managedIds = useMemo(() => new Set(managed.map((c) => c.id)), [managed]);
  const pendingOffers = offers.filter((o) => o.status === 'pending').length;

  const budgetLeft = engagements.reduce((sum, e) => (e.grant?.budget_cap == null ? sum : sum + Math.max(0, e.grant.budget_cap - (e.usage?.budget_used || 0))), 0);
  const anyUnlimited = engagements.some((e) => e.grant?.budget_cap == null);
  const canCreateFor = engagements.filter(
    (e) => e.permissions?.can_add_campaigns && (e.grant?.campaign_limit == null || (e.usage?.campaigns_created || 0) < e.grant.campaign_limit),
  );

  const visibleManaged = useMemo(() => {
    const q = search.trim().toLowerCase();
    return managed.filter((c) => !q || `${c.title} ${brandName(c.brand)}`.toLowerCase().includes(q));
  }, [managed, search]);
  const visibleOpen = useMemo(() => {
    const q = search.trim().toLowerCase();
    return open.filter((c) => !managedIds.has(c.id) && (!q || `${c.title} ${brandName(c.brand)}`.toLowerCase().includes(q)));
  }, [open, search, managedIds]);

  const withdraw = async () => {
    if (!withdrawing) return;
    setBusy(true);
    try {
      await api.patch(`/manager-applications/${withdrawing.id}/withdraw`);
      toast.success(t('mcamp.withdrawn'));
      setWithdrawing(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('mcamp.errSend'));
    } finally {
      setBusy(false);
    }
  };

  const kpis = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label={t('mcamp.kBrands')} value={engagements.length} hint={t('mcamp.kBrandsHint')} icon={Building2} iconStatus={engagements.length ? 'success' : undefined} />
      <MetricCard label={t('mcamp.kManaged')} value={managed.length} hint={t('mcamp.kManagedHint')} icon={Briefcase} />
      <MetricCard label={t('mcamp.kBudget')} value={anyUnlimited && engagements.length ? t('mcamp.unlimited') : formatBudget(budgetLeft, 'USD')} hint={t('mcamp.kBudgetHint')} icon={DollarSign} />
      <MetricCard label={t('mcamp.kOffers')} value={pendingOffers} hint={t('mcamp.kOffersHint')} icon={Clock} iconStatus={pendingOffers ? 'warning' : undefined} />
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('mcamp.title')}
      titleAccent={t('mcamp.accent')}
      description={t('mcamp.desc')}
      icon={<Briefcase size={18} />}
      stats={kpis}
      actions={
        canCreateFor.length > 0 ? (
          <Button variant="primary" size="md" onPress={() => setWizardBrand(canCreateFor[0])}>
            <Plus size={14} /> {t('mcamp.newFor', { brand: brandName(canCreateFor[0].brand) })}
          </Button>
        ) : (
          <Button variant="primary" size="md" onPress={() => setTab('open')}>
            <SearchIcon size={14} /> {t('mcamp.browse')}
          </Button>
        )
      }
    >
      {/* What each brand allows */}
      {engagements.length > 0 && (
        <DashPanel icon={<Building2 size={15} />} title={t('mcamp.engagements')} meta={t('mcamp.engagementsN', { count: engagements.length })}>
          <ul className="divide-y divide-border">
            {engagements.map((e) => {
              const cap = e.grant?.budget_cap;
              const used = e.usage?.budget_used || 0;
              const pct = cap ? Math.min(100, (used / cap) * 100) : 0;
              const limit = e.grant?.campaign_limit;
              return (
                <li key={e.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" data-testid="engagement-row">
                  <StoryAvatar src={e.brand?.brandProfile?.logo_url} name={brandName(e.brand)} seed={e.brand?.id || ''} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{brandName(e.brand)}</div>
                    <div className="v-caption v-quiet" style={{ fontSize: 11.5 }}>
                      {limit == null ? t('mcamp.unlimitedCampaigns') : t('mcamp.campaignsUsed', { used: e.usage?.campaigns_created || 0, limit })}
                      {' · '}
                      {cap == null ? t('mcamp.noCap') : t('mcamp.budgetUsed', { used: formatBudget(used, 'USD'), cap: formatBudget(cap, 'USD') })}
                    </div>
                    {cap != null && (
                      <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: 'var(--color-cool-gray)', maxWidth: 260 }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? '#ffb547' : 'var(--gradient-signature)' }} />
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {e.payment_amount != null && Number(e.payment_amount) > 0 && (
                      <Chip color="success" variant="soft" size="sm">
                        <Chip.Label className="tabular-nums">{formatBudget(Number(e.payment_amount), e.currency || 'USD')}</Chip.Label>
                      </Chip>
                    )}
                    {e.permissions?.can_add_campaigns && (e.grant?.campaign_limit == null || (e.usage?.campaigns_created || 0) < e.grant.campaign_limit) && (
                      <Button variant="tertiary" size="sm" onPress={() => setWizardBrand(e)}>
                        <Plus size={11} /> {t('mcamp.newCampaign')}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </DashPanel>
      )}

      <DirectoryToolbar
        search={{ value: search, onChange: setSearch, placeholder: t('mcamp.searchPh'), ariaLabel: t('mcamp.searchPh') }}
        leading={
          <Segment size="sm" selectedKey={tab} onSelectionChange={(k) => setTab(k as Tab)} aria-label={t('mcamp.tabsLabel')}>
            <Segment.Item id="managed">{t('mcamp.tabManaged')} · {managed.length}</Segment.Item>
            <Segment.Item id="open">{t('mcamp.tabOpen')}</Segment.Item>
            <Segment.Item id="offers">{t('mcamp.tabOffers')} · {offers.length}</Segment.Item>
          </Segment>
        }
      />

      {loading ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="v-talent-card p-4">
              <div className="v-skel h-4 w-1/3 mb-2" />
              <div className="v-skel h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : tab === 'managed' ? (
        visibleManaged.length === 0 ? (
          <EmptyPanel
            icon={<Briefcase size={22} />}
            title={engagements.length === 0 ? t('mcamp.emptyNoBrandTitle') : t('mcamp.emptyManagedTitle')}
            description={engagements.length === 0 ? t('mcamp.emptyNoBrandDesc') : t('mcamp.emptyManagedDesc')}
            actions={
              <Button variant="primary" onPress={() => setTab('open')}>
                <SearchIcon size={13} /> {t('mcamp.browse')}
              </Button>
            }
          />
        ) : (
          <ul className="v-talent-card v-static divide-y divide-border px-4">
            {visibleManaged.map((c) => {
              const st = normalizeCampaignStatus(c.status);
              return (
                <li key={c.id} className="flex items-center gap-3 py-3" data-testid="managed-campaign">
                  <StoryAvatar src={c.brand?.brandProfile?.logo_url} name={brandName(c.brand)} seed={c.brand?.id || ''} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{c.title}</div>
                    <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                      {[brandName(c.brand), c.platform, postedLabel(c.created_at), t('dash.applicantsN', { n: Number(c.applicants_count) || 0 })].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {c.budget != null && (
                      <span className="v-ink font-medium tabular-nums hidden sm:inline" style={{ fontSize: 13, color: '#0b6e3e' }}>
                        {formatBudget(Number(c.budget), c.currency || 'USD')}
                      </span>
                    )}
                    <Chip color={CAMPAIGN_STATUS_COLOR[st]} variant="soft" size="sm">
                      <Chip.Label>{t(`status.${st}`, { defaultValue: st })}</Chip.Label>
                    </Chip>
                    <Link to={`/dashboard/applications?campaign=${c.id}`}>
                      <Button variant={Number(c.pending_count) > 0 ? 'primary' : 'tertiary'} size="sm">
                        <Users size={11} /> {Number(c.pending_count) > 0 ? t('dash.reviewN', { n: Number(c.pending_count) }) : t('dash.viewApplicants')}
                      </Button>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : tab === 'open' ? (
        visibleOpen.length === 0 ? (
          <EmptyPanel size="sm" icon={<SearchIcon size={20} />} title={t('board.emptyTitle')} description={t('mcamp.emptyOpenDesc')} />
        ) : (
          <ul className="v-talent-card v-static divide-y divide-border px-4">
            {visibleOpen.map((c) => {
              const already = offeredIds.has(c.id);
              return (
                <li key={c.id} className="flex items-center gap-3 py-3" data-testid="open-campaign">
                  <StoryAvatar src={c.brand?.brandProfile?.logo_url} name={brandName(c.brand)} seed={c.brand?.id || ''} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{c.title}</div>
                    <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                      {[brandName(c.brand), c.platform, postedLabel(c.created_at), t('mcamp.applicantsN', { count: Number(c.applicants_count) || 0 })].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {c.budget != null && (
                      <span className="v-ink font-medium tabular-nums hidden sm:inline" style={{ fontSize: 13, color: '#0b6e3e' }}>
                        {formatBudget(Number(c.budget), c.currency || 'USD')}
                      </span>
                    )}
                    {already ? (
                      <Chip color="warning" variant="soft" size="sm">
                        <Clock size={10} />
                        <Chip.Label>{t('mcamp.offered')}</Chip.Label>
                      </Chip>
                    ) : (
                      <Button variant="primary" size="sm" onPress={() => setOffering(c)}>
                        <Send size={11} /> {t('mcamp.offerToManage')}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : offers.length === 0 ? (
        <EmptyPanel icon={<Send size={22} />} title={t('mcamp.emptyOffersTitle')} description={t('mcamp.emptyOffersDesc')} actions={<Button variant="primary" onPress={() => setTab('open')}>{t('mcamp.browse')}</Button>} />
      ) : (
        <ul className="v-talent-card v-static divide-y divide-border px-4">
          {offers.map((o) => (
            <li key={o.id} className="flex items-center gap-3 py-3" data-testid="offer-row">
              <StoryAvatar src={o.brand?.brandProfile?.logo_url} name={brandName(o.brand)} seed={o.brand?.id || ''} size={36} />
              <div className="min-w-0 flex-1">
                <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{o.campaign?.title}</div>
                <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                  {[brandName(o.brand), postedLabel(o.created_at), o.proposed_fee ? formatBudget(Number(o.proposed_fee), o.currency || 'USD') : ''].filter(Boolean).join(' · ')}
                </div>
                {o.decision_note && <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>“{o.decision_note}”</div>}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <Chip color={o.status === 'accepted' ? 'success' : o.status === 'pending' ? 'warning' : 'default'} variant="soft" size="sm">
                  {o.status === 'accepted' ? <Check size={10} /> : o.status === 'pending' ? <Clock size={10} /> : <X size={10} />}
                  <Chip.Label>{t(`mcamp.status.${o.status}`, { defaultValue: o.status })}</Chip.Label>
                </Chip>
                {o.status === 'pending' && (
                  <Button variant="ghost" size="sm" className="!text-danger" onPress={() => setWithdrawing(o)}>
                    {t('mcamp.withdraw')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {offering && <OfferModal campaign={offering} onClose={() => setOffering(null)} onSent={load} />}
      {wizardBrand && (
        <CampaignWizard
          isOpen
          onClose={() => setWizardBrand(null)}
          editing={null}
          brandId={wizardBrand.brand?.id}
          brandName={brandName(wizardBrand.brand)}
          onSaved={(saved) => {
            toast.success(t('mcamp.created', { title: saved?.title || '', brand: brandName(wizardBrand.brand) }));
            setWizardBrand(null);
            load();
          }}
        />
      )}
      <ConfirmModal
        open={!!withdrawing}
        tone="danger"
        pending={busy}
        title={t('mcamp.withdrawTitle')}
        body={t('mcamp.withdrawBody', { title: withdrawing?.campaign?.title || '' })}
        confirmLabel={t('mcamp.withdraw')}
        cancelLabel={t('common.cancel')}
        onConfirm={withdraw}
        onClose={() => !busy && setWithdrawing(null)}
      />
      {engagements.length === 0 && !loading && (
        <Notice tone="info">
          <span className="inline-flex items-start gap-1.5">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {t('mcamp.noBrandNote')}
          </span>
        </Notice>
      )}
    </PageShell>
  );
};

export default ManagerCampaigns;
