import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Briefcase,
  Check,
  Clock,
  DollarSign,
  Eye,
  FileText,
  Layers,
  Lock,
  Search as SearchIcon,
  ShieldCheck,
  Star,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import { Button, Chip, Modal, SearchField, Card } from '@heroui/react';
import { EmptyState, Segment } from '@heroui-pro/react';
import api from '../lib/api';
import {
  brandInitials,
  brandName,
  deadlineLabel,
  formatBudget,
  postedLabel,
} from '../lib/campaignFormat';
import LandingNav from './landing/sections/LandingNav';
import Footer from './landing/sections/Footer';
import PlatformIcon, { type PlatformKey as GlyphKey } from './landing/mocks/PlatformIcon';
import { accentFor } from './talent/shared';
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

/* ── Platform metadata ─────────────────────────────────────────── */
type PlatformId = 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'twitch' | 'linkedin' | 'other';

const PLATFORM_META: { id: PlatformId; label: string; glyph?: GlyphKey; color: string }[] = [
  { id: 'tiktok', label: 'TikTok', glyph: 'tiktok', color: '#0b1736' },
  { id: 'instagram', label: 'Instagram', glyph: 'instagram', color: '#E1306C' },
  { id: 'youtube', label: 'YouTube', glyph: 'youtube', color: '#FF0000' },
  { id: 'twitter', label: 'X / Twitter', glyph: 'x', color: '#0b1736' },
  { id: 'twitch', label: 'Twitch', glyph: 'twitch', color: '#9146FF' },
  { id: 'linkedin', label: 'LinkedIn', glyph: 'linkedin', color: '#0A66C2' },
  { id: 'other', label: 'Other', color: '#6c63ff' },
];

const normalizePlatform = (p?: string): PlatformId => {
  if (!p) return 'other';
  const k = p.toLowerCase().trim();
  if (k === 'x' || k.includes('twitter')) return 'twitter';
  for (const m of PLATFORM_META) {
    if (m.id !== 'other' && k.includes(m.id)) return m.id;
  }
  return 'other';
};

type SortKey = 'newest' | 'budget' | 'deadline';

/* ── Campaign card ─────────────────────────────────────────────── */
const CampaignCard = React.memo<{
  camp: any;
  index: number;
  applied: boolean;
  loggedIn: boolean;
  isCreator: boolean;
  onApply: (camp: any) => void;
  onViewContract: (contract: string) => void;
}>(({ camp, index, applied, loggedIn, isCreator, onApply, onViewContract }) => {
  const name = brandName(camp);
  const verified = camp.brand?.account_status === 'active';
  const accent = accentFor(String(camp.brand?.id || name));
  const platform = PLATFORM_META.find((m) => m.id === normalizePlatform(camp.platform))!;
  const due = deadlineLabel(camp.deadline);
  const posted = postedLabel(camp.created_at);
  const applicants = Number(camp.applicants_count) || 0;
  const logo = camp.brand?.brandProfile?.logo_url;

  return (
    <article
      className="v-talent-card v-card-in p-4 flex flex-col"
      style={{ animationDelay: `${(index % PAGE_SIZE) * 28}ms` }}
    >
      {/* brand row */}
      <div className="flex items-center gap-2.5">
        {logo ? (
          <img
            src={logo}
            alt=""
            loading="lazy"
            className="h-9 w-9 rounded-lg object-cover shrink-0"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(11,23,54,0.08)' }}
          />
        ) : (
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-medium text-white shrink-0"
            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
          >
            {brandInitials(name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="v-ink font-medium truncate" style={{ fontSize: 13 }}>
              {name}
            </span>
            {verified && (
              <ShieldCheck size={12} className="shrink-0" style={{ color: 'var(--color-campaign-purple)' }} />
            )}
          </div>
          {posted && (
            <div className="v-caption v-quiet" style={{ fontSize: 10.5 }}>
              posted {posted}
            </div>
          )}
        </div>
        <span
          className="v-social-chip shrink-0"
          title={platform.label}
          style={{ color: platform.color }}
        >
          {platform.glyph ? <PlatformIcon platform={platform.glyph} size={13} /> : <Briefcase size={12} />}
          <span className="v-ink font-medium" style={{ fontSize: 11 }}>
            {platform.label}
          </span>
        </span>
      </div>

      {/* brief */}
      <h3
        className="mt-3 v-ink font-medium line-clamp-2"
        style={{ fontSize: 15, lineHeight: 1.3, letterSpacing: '-0.015em', minHeight: 39 }}
      >
        {camp.title}
      </h3>
      <p className="mt-1.5 v-body v-muted line-clamp-2" style={{ fontSize: 12.5, minHeight: 38 }}>
        {camp.description || 'No brief details provided yet.'}
      </p>

      {/* signals */}
      <div className="mt-2.5 flex items-center gap-3 flex-wrap v-caption v-quiet" style={{ fontSize: 11 }}>
        {due && (
          <span className="inline-flex items-center gap-1" style={{ color: '#b45309' }}>
            <Clock size={10.5} /> {due}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users size={10.5} /> {applicants === 0 ? 'Be the first to apply' : `${applicants} applied`}
        </span>
        {camp.contract_template && (
          <button
            type="button"
            onClick={() => onViewContract(camp.contract_template)}
            className="inline-flex items-center gap-1 hover:underline"
            style={{ color: 'var(--color-campaign-purple)' }}
          >
            <Eye size={10.5} /> Contract
          </button>
        )}
      </div>

      {/* footer: the money + the action */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 mt-auto">
        <div className="inline-flex items-baseline gap-1.5 min-w-0">
          <span
            className="font-medium tabular-nums"
            style={{ fontSize: 17, letterSpacing: '-0.018em', color: '#0b6e3e' }}
          >
            {formatBudget(camp.budget)}
          </span>
          <span className="v-caption v-quiet" style={{ fontSize: 11 }}>
            budget
          </span>
        </div>

        {applied ? (
          <Chip color="success" variant="soft" size="sm">
            <Check size={11} />
            <Chip.Label>Applied</Chip.Label>
          </Chip>
        ) : !loggedIn ? (
          <Link to="/login" title="Sign in to apply">
            <Button variant="ghost" size="sm" className="!px-2.5">
              <Lock size={11} /> Sign in
            </Button>
          </Link>
        ) : isCreator ? (
          <Button variant="primary" size="sm" onPress={() => onApply(camp)}>
            Apply
          </Button>
        ) : (
          <span className="v-caption v-quiet" style={{ fontSize: 11 }}>
            Creators only
          </span>
        )}
      </div>
    </article>
  );
});
CampaignCard.displayName = 'CampaignCard';

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
  const [sort, setSort] = useState<SortKey>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'applied'>('all');

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
        };
        if (search) params.search = search;
        if (platformFilter !== 'all') params.platform = platformFilter;

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
    [search, platformFilter, sort],
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
            `Video upload failed: ${uploadErr.message || 'the file might be too large'}. Try applying without a video or record a shorter one.`,
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
      setApplyError(err.response?.data?.message || 'Failed to submit application. Please try again.');
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
                  <Chip.Label>Live opportunities</Chip.Label>
                </Chip>
                <h1 className="v-heading-xl mb-2">
                  Briefs open <span className="v-text-signature">right now.</span>
                </h1>
                <p className="v-body-lg v-muted max-w-2xl mx-auto">
                  Real budgets from real brands. Pick a brief in your lane, apply
                  in a tap — the payout escrows before you film.
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
                    <SearchField.Input placeholder="Search briefs or brands…" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>

              <p className="hidden lg:block text-muted text-xs whitespace-nowrap" aria-live="polite">
                {loading ? (
                  'Searching…'
                ) : (
                  <>
                    <span className="text-foreground font-semibold tabular-nums">{visible.length}</span>
                    {' of '}
                    <span className="tabular-nums">{total}</span> briefs
                  </>
                )}
              </p>

              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {loggedIn && isCreator && (
                  <Segment
                    size="sm"
                    selectedKey={statusFilter}
                    onSelectionChange={(k) => setStatusFilter(k as typeof statusFilter)}
                    aria-label="Application status"
                  >
                    <Segment.Item id="all">All</Segment.Item>
                    <Segment.Item id="open">Open</Segment.Item>
                    <Segment.Item id="applied">Applied</Segment.Item>
                  </Segment>
                )}
                <Segment
                  size="sm"
                  selectedKey={sort}
                  onSelectionChange={(k) => setSort(k as SortKey)}
                  aria-label="Sort briefs"
                >
                  <Segment.Item id="newest">Newest</Segment.Item>
                  <Segment.Item id="budget">Top budget</Segment.Item>
                  <Segment.Item id="deadline">Deadline</Segment.Item>
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
                All platforms
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
                    <EmptyState.Title>Couldn&apos;t load campaigns</EmptyState.Title>
                    <EmptyState.Description>
                      Something went wrong while fetching briefs. Check your connection and try again.
                    </EmptyState.Description>
                    <EmptyState.Content>
                      <Button variant="primary" size="md" onPress={() => fetchPage(true)}>
                        Try again
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
                    <EmptyState.Title>No briefs found</EmptyState.Title>
                    <EmptyState.Description>
                      {items.length === 0
                        ? 'No campaigns match your filters right now — new briefs land daily.'
                        : 'Nothing matches this view. Try a different status filter.'}
                    </EmptyState.Description>
                    <EmptyState.Content>
                      <Button
                        variant="primary"
                        size="md"
                        onPress={() => {
                          setSearch('');
                          setPlatformFilter('all');
                          setStatusFilter('all');
                        }}
                      >
                        Reset filters
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
                      Load more ({total - items.length} remaining)
                    </Button>
                  </div>
                )}
                {!hasMore && items.length > PAGE_SIZE && (
                  <p className="text-center text-muted text-xs mt-6">
                    You&apos;ve seen all {total} open briefs.
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
                <Modal.Heading>Apply for Campaign</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {selectedCampaign && (
                  <div className="space-y-5">
                    <p className="v-body v-muted">
                      Submit your application to{' '}
                      <span className="v-ink font-medium">{selectedCampaign.title}</span>.
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
                        <DollarSign size={16} /> Base Payout
                      </span>
                      <span
                        className="font-semibold tabular-nums"
                        style={{ color: '#0b6e3e', fontSize: 22, letterSpacing: '-0.018em' }}
                      >
                        {formatBudget(selectedCampaign.budget)}
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
                          <Briefcase size={11} /> Contract Terms
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
                          Video pitch (recommended)
                        </label>
                        <VideoPitchRecorder
                          onRecordingComplete={(b64) => setVideoBase64(b64)}
                          maxDuration={60}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="v-caption v-quiet font-medium uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={12} /> Written pitch (optional)
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowPitchGenerator(true)}
                            className="v-caption font-medium flex items-center gap-1"
                            style={{ color: 'var(--color-campaign-purple)' }}
                          >
                            <Star size={11} fill="currentColor" /> AI pitch gen
                          </button>
                        </div>
                        <textarea
                          value={pitch}
                          onChange={(e) => setPitch(e.target.value)}
                          placeholder="Tell the brand why they should choose you…"
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
                  Cancel
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
                      <Check size={14} /> Sent
                    </>
                  ) : (
                    'Confirm & send'
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
                  Contract Terms
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
                  Close
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
