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
import { Button, Chip, Modal, SearchField, Card } from '@heroui/react';
import { EmptyState, Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { formatBudget } from '../lib/campaignFormat';
import LandingNav from './landing/sections/LandingNav';
import Footer from './landing/sections/Footer';
import FacetPopover from '../components/common/FacetPopover';
import CampaignCard, { PLATFORM_META, type PlatformId } from '../components/common/CampaignCard';
import SearchSelect from '../components/common/SearchSelect';
import PlatformIcon from './landing/mocks/PlatformIcon';
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
};

/* Radio-style option rows used inside facet panels */
const OptionRows: React.FC<{
  options: { id: string; label: string; hint?: string }[];
  value: string;
  onSelect: (id: string) => void;
}> = ({ options, value, onSelect }) => (
  <div className="space-y-1">
    {options.map((o) => {
      const active = value === o.id;
      return (
        <button
          key={o.id}
          type="button"
          onClick={() => onSelect(o.id)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            active
              ? 'bg-accent-soft border-accent/40 text-foreground'
              : 'bg-surface border-border text-foreground hover:border-accent/40'
          }`}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <span className="truncate">{o.label}</span>
            {o.hint && <span className="text-muted text-xs shrink-0 tabular-nums">{o.hint}</span>}
          </span>
          <span
            className={`size-4 rounded-full border-2 transition-colors shrink-0 ${
              active ? 'border-accent bg-accent' : 'border-border bg-transparent'
            }`}
          />
        </button>
      );
    })}
  </div>
);

/* ── Skeleton card ─────────────────────────────────────────────── */
const SkeletonCard: React.FC = () => (
  <div className="v-talent-card p-4" aria-hidden>
    <div className="flex items-center gap-2.5">
      <div className="v-skel h-9 w-9 !rounded-lg shrink-0" />
      <div className="flex-1">
        <div className="v-skel h-3.5 w-2/5 mb-1.5" />
        <div className="v-skel h-2.5 w-1/4" />
      </div>
      <div className="v-skel h-[26px] w-20 !rounded-[9px]" />
    </div>
    <div className="v-skel h-4 w-11/12 mt-4 mb-1.5" />
    <div className="v-skel h-3 w-full mb-1" />
    <div className="v-skel h-3 w-3/4 mb-4" />
    <div className="flex items-center justify-between pt-3 border-t border-border">
      <div className="v-skel h-5 w-20" />
      <div className="v-skel h-8 w-16 !rounded-lg" />
    </div>
  </div>
);

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

  /* Facet values that actually exist among active campaigns */
  const [facets, setFacets] = useState<FacetData>({ sectors: [], objectives: [] });
  useEffect(() => {
    api
      .get('/campaigns/facets')
      .then((res) => setFacets({ sectors: res.data?.sectors || [], objectives: res.data?.objectives || [] }))
      .catch(() => {});
  }, []);

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
    [search, platformFilter, budgetId, sector, orientation, sort, i18n.language],
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
    <div className="landing-visitors min-h-screen flex flex-col">
      {!isDashboard && <LandingNav />}

      <main className="flex-1">
        {/* Header */}
        <section className={`px-6 lg:px-10 ${isDashboard ? 'pt-2 pb-4' : 'pt-10 pb-4'}`}>
          <div className="max-w-[1100px] mx-auto text-center">
            {!isDashboard && (
              <>
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
              </>
            )}
          </div>
        </section>

        {/* Toolbar + results */}
        <section className="px-6 lg:px-10 pb-16">
          <div className="max-w-[1100px] mx-auto">
            {/* Toolbar */}
            <div className="flex items-center gap-x-3 gap-y-2 mb-3 flex-wrap">
              <div className="w-full sm:w-[260px]">
                <SearchField aria-label="Search campaigns" value={search} onChange={setSearch}>
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={t('board.searchPh')} />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>

              <p className="hidden lg:block text-muted text-xs whitespace-nowrap" aria-live="polite">
                {loading
                  ? t('common.searching')
                  : t('board.count', { shown: visible.length, total })}
              </p>

              <div className="ml-auto flex items-center gap-2 flex-wrap">
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
              </div>
            </div>

            {/* Platform filter row */}
            <div className="flex items-center gap-1.5 mb-5 flex-wrap">
              <button
                type="button"
                onClick={() => setPlatformFilter('all')}
                className="v-niche-chip"
                data-active={platformFilter === 'all' || undefined}
                aria-pressed={platformFilter === 'all'}
              >
                {t('board.allPlatforms')}
              </button>
              {PLATFORM_META.filter((m) => m.id !== 'other').map((m) => {
                const active = platformFilter === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPlatformFilter(active ? 'all' : m.id)}
                    className="v-niche-chip"
                    data-active={active || undefined}
                    aria-pressed={active}
                  >
                    <span className="inline-flex" style={{ color: active ? '#fff' : m.color }}>
                      {m.glyph && <PlatformIcon platform={m.glyph} size={12} />}
                    </span>
                    {m.label}
                  </button>
                );
              })}

              {/* Facet dropdowns — budget band, brand sector, campaign orientation */}
              <div className="ml-auto flex items-center gap-2 flex-wrap">
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
              </div>
            </div>

            {/* Results */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-label="Loading campaigns">
                {Array.from({ length: 9 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : error ? (
              <Card>
                <Card.Content className="p-8">
                  <EmptyState>
                    <EmptyState.Media>
                      <AlertCircle className="size-7" />
                    </EmptyState.Media>
                    <EmptyState.Title>{t('board.errTitle')}</EmptyState.Title>
                    <EmptyState.Description>
                      {t('board.errDesc')}
                    </EmptyState.Description>
                    <EmptyState.Content>
                      <Button variant="primary" size="md" onPress={() => fetchPage(true)}>
                        {t('common.tryAgain')}
                      </Button>
                    </EmptyState.Content>
                  </EmptyState>
                </Card.Content>
              </Card>
            ) : visible.length === 0 ? (
              <Card>
                <Card.Content className="p-8">
                  <EmptyState>
                    <EmptyState.Media>
                      <SearchIcon className="size-7" />
                    </EmptyState.Media>
                    <EmptyState.Title>{t('board.emptyTitle')}</EmptyState.Title>
                    <EmptyState.Description>
                      {items.length === 0 ? t('board.emptyNone') : t('board.emptyStatus')}
                    </EmptyState.Description>
                    <EmptyState.Content>
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
                        }}
                      >
                        {t('board.resetFilters')}
                      </Button>
                    </EmptyState.Content>
                  </EmptyState>
                </Card.Content>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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

                {/* Infinite-scroll sentinel + fallback */}
                <div ref={sentinelRef} aria-hidden className="h-px" />
                {loadingMore && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-4" aria-label="Loading more">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                )}
                {hasMore && !loadingMore && (
                  <div className="flex justify-center mt-6">
                    <Button variant="outline" size="md" onPress={() => fetchPage(false)}>
                      {t('common.loadMore', { n: total - items.length })}
                    </Button>
                  </div>
                )}
                {!hasMore && items.length > PAGE_SIZE && (
                  <p className="text-center text-muted text-xs mt-6">
                    {t('board.seenAll', { total })}
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {!isDashboard && <Footer />}

      {/* ─── Application modal ───────────────────────────────────── */}
      <Modal isOpen={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
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
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
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
