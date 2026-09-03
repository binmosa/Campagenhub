import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Briefcase,
  Check,
  DollarSign,
  FileText,
  Layers,
  Search as SearchIcon,
  Star,
  Video,
  Zap,
} from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { formatBudget } from '../lib/campaignFormat';
import LandingNav from './landing/sections/LandingNav';
import Footer from './landing/sections/Footer';
import FacetPopover from '../components/common/FacetPopover';
import CampaignCard, { CampaignCardSkeleton, type PlatformId } from '../components/common/CampaignCard';
import SearchSelect from '../components/common/SearchSelect';
import { EmptyPanel } from '../components/common/EmptyPanel';
import { BriefDetails } from '../components/common/BriefDetails';
import {
  DirectoryToolbar,
  LoadMoreFooter,
  OptionRows,
  PlatformChipRow,
} from '../components/common/filters';
import { VideoPitchRecorder } from '../components/common/VideoPitchRecorder';
import { PitchModal } from '../components/common/PitchModal';

/**
 * PublicCampaigns — the open-briefs marketplace, built for creators.
 *
 * Server-driven and paginated (`/campaigns/public-list` returns
 * { items, total, hasMore }): search, platform filter, and sort run in SQL;
 * pages append via an IntersectionObserver sentinel with skeleton loading,
 * request cancellation, and an explicit error/retry state.
 *
 * Also rendered inside the creator dashboard as <PublicCampaigns isDashboard />.
 */

interface PublicCampaignsProps {
  isDashboard?: boolean;
}

const PAGE_SIZE = 18;

type SortKey = 'newest' | 'budget' | 'deadline';

/* Budget bands for the facet filter (applied in SQL via min/maxBudget) */
const BUDGET_RANGES = [
  { id: 'any', label: 'Any budget', min: 0, max: 0 },
  { id: 'starter', label: 'Under $1K', min: 0, max: 999 },
  { id: 'small', label: '$1K – $5K', min: 1000, max: 5000 },
  { id: 'growth', label: '$5K – $20K', min: 5000, max: 20000 },
  { id: 'scale', label: '$20K+', min: 20000, max: 0 },
];

type FacetData = {
  sectors: { value: string; count: number }[];
  objectives: { value: string; count: number }[];
  countries: { value: string; label: string; count: number }[];
};

const SkeletonCard = CampaignCardSkeleton;
const GRID = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4';

/* ── Page ──────────────────────────────────────────────────────── */
const PublicCampaigns: React.FC<PublicCampaignsProps> = ({ isDashboard = false }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const loggedIn = !!localStorage.getItem('token');
  const role = localStorage.getItem('role') || '';
  const isCreator = role === 'creator';

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformId>('all');
  const [budgetId, setBudgetId] = useState('any');
  const [sector, setSector] = useState('');
  const [orientation, setOrientation] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'applied'>('all');
  /* Geo: ISO-2 code or a country name (market pages deep-link ?country=Ethiopia);
     the API accepts both and also returns briefs open to anywhere. */
  const [country, setCountry] = useState(() => new URLSearchParams(window.location.search).get('country') || '');

  /* Facet values that actually exist among active campaigns */
  const [facets, setFacets] = useState<FacetData>({ sectors: [], objectives: [], countries: [] });
  useEffect(() => {
    api
      .get('/campaigns/facets')
      .then((res) =>
        setFacets({
          sectors: res.data?.sectors || [],
          objectives: res.data?.objectives || [],
          countries: res.data?.countries || [],
        }),
      )
      .catch(() => {});
  }, []);
  const countryLabel = (v: string) =>
    facets.countries.find((c) => c.value.toLowerCase() === v.toLowerCase() || c.label.toLowerCase() === v.toLowerCase())?.label || v;

  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [pitch, setPitch] = useState('');
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [applyError, setApplyError] = useState('');
  const [appliedCampaignIds, setAppliedCampaignIds] = useState<string[]>([]);
  const [viewingContract, setViewingContract] = useState<string | null>(null);
  const [showPitchGenerator, setShowPitchGenerator] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const offsetRef = useRef(0);

  /* ── Paged fetch (server-side search/platform/sort) ──────────── */
  const fetchPage = useCallback(
    async (reset: boolean) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      if (reset) {
        offsetRef.current = 0;
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(false);

      try {
        const params: Record<string, string> = {
          limit: String(PAGE_SIZE),
          offset: String(offsetRef.current),
          sort,
          lang: i18n.language,
        };
        if (search) params.search = search;
        if (platformFilter !== 'all') params.platform = platformFilter;
        const range = BUDGET_RANGES.find((r) => r.id === budgetId);
        if (range?.min) params.minBudget = String(range.min);
        if (range?.max) params.maxBudget = String(range.max);
        if (sector) params.industry = sector;
        if (orientation) params.objective = orientation;
        if (country) params.country = country;

        const res = await api.get('/campaigns/public-list', { params, signal: ctrl.signal });
        const data = res.data || {};
        const list: any[] = data.items || [];

        setItems((prev) => (reset ? list : [...prev, ...list]));
        offsetRef.current = (reset ? 0 : offsetRef.current) + list.length;
        setTotal(Number(data.total) || list.length);
        setHasMore(!!data.hasMore);
        setLoading(false);
        setLoadingMore(false);
      } catch (e: any) {
        if (ctrl.signal.aborted || e?.code === 'ERR_CANCELED') return;
        setError(true);
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, platformFilter, budgetId, sector, orientation, country, sort, i18n.language],
  );

  useEffect(() => {
    const t = setTimeout(() => fetchPage(true), 300);
    return () => clearTimeout(t);
  }, [fetchPage]);

  /* Applied campaigns (creators only) */
  useEffect(() => {
    if (loggedIn && isCreator) {
      api
        .get('/applications')
        .then((res) => {
          if (Array.isArray(res.data)) {
            setAppliedCampaignIds(res.data.map((app: any) => app.campaign?.id).filter(Boolean));
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Infinite scroll sentinel */
  const loadMoreRef = useRef<() => void>(() => {});
  loadMoreRef.current = () => {
    if (hasMore && !loading && !loadingMore && !error) fetchPage(false);
  };
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* Applied-state filter is client knowledge, applied to loaded items */
  const visible = useMemo(() => {
    if (statusFilter === 'all') return items;
    return items.filter((c) => {
      const isApplied = appliedCampaignIds.includes(c.id);
      return statusFilter === 'applied' ? isApplied : !isApplied;
    });
  }, [items, statusFilter, appliedCampaignIds]);

  /* ── Apply flow (creator-only — matches the backend guard) ───── */
  const handleApplyClick = useCallback(
    (camp: any) => {
      if (!localStorage.getItem('token')) {
        navigate('/login');
        return;
      }
      setSelectedCampaign(camp);
      setPitch('');
      setVideoBase64(null);
      setApplyStatus('idle');
      setApplyError('');
    },
    [navigate],
  );

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign) return;
    setApplyStatus('loading');
    setApplyError('');

    try {
      let videoUrl = '';
      if (videoBase64) {
        try {
          const uploadRes = await api.post('/uploads', {
            file: videoBase64,
            filename: `pitch-${Date.now()}.webm`,
          });
          if (uploadRes.data.error) throw new Error(uploadRes.data.error);
          videoUrl = uploadRes.data.url;
        } catch (uploadErr: any) {
          setApplyError(
            t('board.videoUploadFailed', { reason: uploadErr.message || t('board.fileTooLarge') }),
          );
          setApplyStatus('error');
          return;
        }
      }

      await api.post('/applications', {
        campaignId: selectedCampaign.id,
        pitch,
        videoPitchUrl: videoUrl,
      });
      setApplyStatus('success');
      setPitch('');
      setVideoBase64(null);
      setAppliedCampaignIds((prev) => [...prev, selectedCampaign.id]);
      setTimeout(() => {
        setSelectedCampaign(null);
        setApplyStatus('idle');
      }, 2000);
    } catch (err: any) {
      setApplyError(err.response?.data?.message || t('board.applyFailed'));
      setApplyStatus('error');
    }
  };

  const onViewContract = useCallback((c: string) => setViewingContract(c), []);

  const fieldClass = 'w-full px-3.5 py-2.5 rounded-lg v-body v-ink';
  const fieldStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--color-cool-gray)',
    outline: 'none',
  };

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className={isDashboard ? '' : 'landing-visitors min-h-screen flex flex-col'}>
      {!isDashboard && <LandingNav />}

      <main className={isDashboard ? '' : 'flex-1'}>
        {/* Header — the dashboard embeds this under its own hero */}
        {!isDashboard && (
          <section className="px-6 lg:px-10 pt-10 pb-4">
            <div className="max-w-[1100px] mx-auto text-center">
              <Chip color="accent" variant="soft" size="md" className="!mb-4">
                <Zap size={12} />
                <Chip.Label>{t('board.pill')}</Chip.Label>
              </Chip>
              <h1 className="v-heading-xl mb-2">
                {t('board.titleA')} <span className="v-text-signature">{t('board.titleB')}</span>
              </h1>
              <p className="v-body-lg v-muted max-w-2xl mx-auto">
                {t('board.desc')}
              </p>
            </div>
          </section>
        )}

        {/* Toolbar + results */}
        <section className={isDashboard ? '' : 'px-6 lg:px-10 pb-16'}>
          <div className={isDashboard ? '' : 'max-w-[1100px] mx-auto'}>
            {/* Toolbar */}
            <DirectoryToolbar
              search={{ value: search, onChange: setSearch, placeholder: t('board.searchPh'), ariaLabel: 'Search campaigns' }}
              count={loading ? t('common.searching') : t('board.count', { shown: visible.length, total })}
            >
              {loggedIn && isCreator && (
                <Segment
                  size="sm"
                  selectedKey={statusFilter}
                  onSelectionChange={(k) => setStatusFilter(k as typeof statusFilter)}
                  aria-label="Application status"
                >
                  <Segment.Item id="all">{t('board.statusAll')}</Segment.Item>
                  <Segment.Item id="open">{t('board.statusOpen')}</Segment.Item>
                  <Segment.Item id="applied">{t('board.statusApplied')}</Segment.Item>
                </Segment>
              )}
              <Segment
                size="sm"
                selectedKey={sort}
                onSelectionChange={(k) => setSort(k as SortKey)}
                aria-label="Sort briefs"
              >
                <Segment.Item id="newest">{t('board.sortNewest')}</Segment.Item>
                <Segment.Item id="budget">{t('board.sortBudget')}</Segment.Item>
                <Segment.Item id="deadline">{t('board.sortDeadline')}</Segment.Item>
              </Segment>
            </DirectoryToolbar>

            {/* Platform filter row + facet dropdowns — budget band, brand sector, campaign orientation */}
            <PlatformChipRow
              value={platformFilter}
              onChange={setPlatformFilter}
              trailing={
                <>
                <FacetPopover
                  label={t('board.fBudget')}
                  width={230}
                  badge={budgetId !== 'any' ? t(`board.br.${budgetId}`) : undefined}
                >
                  <OptionRows
                    options={BUDGET_RANGES.map((r) => ({ id: r.id, label: t(`board.br.${r.id}`, { defaultValue: r.label }) }))}
                    value={budgetId}
                    onSelect={setBudgetId}
                  />
                </FacetPopover>
                <FacetPopover label={t('board.fSector')} width={260} badge={sector || undefined}>
                  <SearchSelect
                    aria-label="Brand sector"
                    placeholder={facets.sectors.length ? t('board.sectorPh') : t('board.noSectors')}
                    disabled={facets.sectors.length === 0}
                    options={facets.sectors.map((s) => ({
                      value: s.value,
                      label: s.value,
                      hint: String(s.count),
                    }))}
                    value={sector}
                    onChange={setSector}
                  />
                </FacetPopover>
                <FacetPopover
                  label={t('board.fOrientation')}
                  width={240}
                  badge={orientation ? t(`objectives.${orientation}`, { defaultValue: orientation }) : undefined}
                >
                  <OptionRows
                    options={[
                      { id: '', label: t('common.any') },
                      ...facets.objectives.map((o) => ({
                        id: o.value,
                        label: t(`objectives.${o.value}`, { defaultValue: o.value }),
                        hint: String(o.count),
                      })),
                    ]}
                    value={orientation}
                    onSelect={setOrientation}
                  />
                </FacetPopover>
                <FacetPopover label={t('board.fLocation')} width={260} badge={country ? countryLabel(country) : undefined}>
                  <OptionRows
                    options={[
                      { id: '', label: t('board.anyLocation') },
                      ...facets.countries.map((c) => ({ id: c.value, label: c.label, hint: String(c.count) })),
                    ]}
                    value={facets.countries.find((c) => c.value.toLowerCase() === country.toLowerCase() || c.label.toLowerCase() === country.toLowerCase())?.value || ''}
                    onSelect={setCountry}
                  />
                </FacetPopover>
                </>
              }
            />

            {/* Results */}
            {loading ? (
              <div className={GRID} aria-label="Loading campaigns">
                {Array.from({ length: 9 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : error ? (
              <EmptyPanel
                tone="error"
                icon={<AlertCircle size={22} />}
                title={t('board.errTitle')}
                description={t('board.errDesc')}
                actions={
                  <Button variant="primary" size="md" onPress={() => fetchPage(true)}>
                    {t('common.tryAgain')}
                  </Button>
                }
              />
            ) : visible.length === 0 ? (
              <EmptyPanel
                icon={<SearchIcon size={22} />}
                title={t('board.emptyTitle')}
                description={items.length === 0 ? t('board.emptyNone') : t('board.emptyStatus')}
                actions={
                  <Button
                    variant="primary"
                    size="md"
                    onPress={() => {
                      setSearch('');
                      setPlatformFilter('all');
                      setStatusFilter('all');
                      setBudgetId('any');
                      setSector('');
                      setOrientation('');
                      setCountry('');
                    }}
                  >
                    {t('board.resetFilters')}
                  </Button>
                }
              />
            ) : (
              <>
                <div className={GRID}>
                  {visible.map((camp, i) => (
                    <CampaignCard
                      key={camp.id}
                      camp={camp}
                      index={i}
                      applied={appliedCampaignIds.includes(camp.id)}
                      loggedIn={loggedIn}
                      isCreator={isCreator}
                      onApply={handleApplyClick}
                      onViewContract={onViewContract}
                    />
                  ))}
                </div>

                <LoadMoreFooter
                  sentinelRef={sentinelRef}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                  remaining={total - items.length}
                  onLoadMore={() => fetchPage(false)}
                  skeleton={<SkeletonCard />}
                  gridClass={GRID}
                  showSeenAll={items.length > PAGE_SIZE}
                  seenAll={t('board.seenAll', { total })}
                />
              </>
            )}
          </div>
        </section>
      </main>

      {!isDashboard && <Footer />}

      {/* ─── Application modal ───────────────────────────────────── */}
      <Modal isOpen={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t('board.applyTitle')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {selectedCampaign && (
                  <div className="space-y-5">
                    <p className="v-body v-muted">
                      {t('board.applyTo', { title: selectedCampaign.title })}
                    </p>

                    {/* Payout pill */}
                    <div
                      className="flex items-center justify-between rounded-xl p-4"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(22,199,132,0.10) 0%, rgba(0,212,199,0.12) 100%)',
                        border: '1px solid rgba(22,199,132,0.20)',
                      }}
                    >
                      <span
                        className="v-body font-medium flex items-center gap-2"
                        style={{ color: '#0b6e3e' }}
                      >
                        <DollarSign size={16} /> {t('board.basePayout')}
                      </span>
                      <span className="text-right">
                        <span
                          className="font-semibold tabular-nums block"
                          style={{ color: '#0b6e3e', fontSize: 22, letterSpacing: '-0.018em' }}
                        >
                          {formatBudget(selectedCampaign.budget, selectedCampaign.currency)}
                        </span>
                        {selectedCampaign.currency !== 'USD' && selectedCampaign.budget_usd ? (
                          <span className="v-caption block" style={{ color: '#0b6e3e', opacity: 0.7, fontSize: 11.5 }}>
                            ≈ {formatBudget(selectedCampaign.budget_usd, 'USD')}
                          </span>
                        ) : null}
                      </span>
                    </div>

                    <BriefDetails campaign={selectedCampaign} />

                    {selectedCampaign.contract_template && (
                      <div
                        className="rounded-xl p-4 max-h-40 overflow-y-auto"
                        style={{
                          background: 'rgba(244,242,255,0.5)',
                          border: '1px solid var(--color-cool-gray)',
                        }}
                      >
                        <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Briefcase size={11} /> {t('board.contractTerms')}
                        </div>
                        <div className="v-body v-ink whitespace-pre-wrap" style={{ fontSize: 13, lineHeight: 1.55 }}>
                          {selectedCampaign.contract_template}
                        </div>
                      </div>
                    )}

                    <form id="campaign-apply-form" onSubmit={submitApplication} className="space-y-5">
                      <div>
                        <label className="v-caption v-quiet font-medium uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <Video size={12} style={{ color: 'var(--color-campaign-purple)' }} />
                          {t('board.videoPitch')}
                        </label>
                        <VideoPitchRecorder
                          onRecordingComplete={(b64) => setVideoBase64(b64)}
                          maxDuration={60}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="v-caption v-quiet font-medium uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={12} /> {t('board.writtenPitch')}
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowPitchGenerator(true)}
                            className="v-caption font-medium flex items-center gap-1"
                            style={{ color: 'var(--color-campaign-purple)' }}
                          >
                            <Star size={11} fill="currentColor" /> {t('board.aiPitchGen')}
                          </button>
                        </div>
                        <textarea
                          value={pitch}
                          onChange={(e) => setPitch(e.target.value)}
                          placeholder={t('board.pitchPh')}
                          className={`${fieldClass} resize-none h-24`}
                          style={fieldStyle}
                        />
                      </div>

                      {applyError && (
                        <div
                          className="flex items-start gap-2 rounded-lg p-3 v-body"
                          style={{
                            background: 'rgba(255,90,95,0.08)',
                            border: '1px solid rgba(255,90,95,0.25)',
                            color: '#b3261e',
                            fontSize: 12.5,
                          }}
                          role="alert"
                        >
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          {applyError}
                        </div>
                      )}
                    </form>
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setSelectedCampaign(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  form="campaign-apply-form"
                  isPending={applyStatus === 'loading'}
                  isDisabled={applyStatus === 'success'}
                >
                  {applyStatus === 'success' ? (
                    <>
                      <Check size={14} /> {t('board.sentBtn')}
                    </>
                  ) : (
                    t('board.confirmSend')
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {showPitchGenerator && selectedCampaign && (
        <PitchModal
          onClose={() => setShowPitchGenerator(false)}
          defaultCampaignName={selectedCampaign.title}
        />
      )}

      {/* ─── Contract modal ──────────────────────────────────────── */}
      <Modal isOpen={!!viewingContract} onOpenChange={(open) => !open && setViewingContract(null)}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="flex items-center gap-2">
                  <FileText size={18} style={{ color: 'var(--color-campaign-purple)' }} />
                  {t('board.contractTerms')}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div
                  className="v-body v-ink whitespace-pre-wrap rounded-xl p-5"
                  style={{
                    background: 'rgba(244,242,255,0.5)',
                    border: '1px solid var(--color-cool-gray)',
                    fontSize: 13,
                    lineHeight: 1.6,
                    maxHeight: '60vh',
                    overflow: 'auto',
                  }}
                >
                  {viewingContract}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="primary" onPress={() => setViewingContract(null)}>
                  {t('common.close')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
};

export default PublicCampaigns;
