import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Filter,
  Link2,
  Lock,
  MapPin,
  Search as SearchIcon,
  Send,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import {
  Button,
  Card,
  Chip,
  Label,
  SearchField,
  Separator,
} from '@heroui/react';
import { EmptyState, Segment, Sheet } from '@heroui-pro/react';
import api from '../lib/api';
import { formatCompact, socialEntries } from '../lib/socialLinks';
import LandingNav from './landing/sections/LandingNav';
import Footer from './landing/sections/Footer';
import PlatformIcon from './landing/mocks/PlatformIcon';
import InvitationModal from './talent/InvitationModal';
import {
  FOLLOWER_RANGES,
  NICHES,
  PLATFORMS,
  PLATFORM_ICON_KEY,
  accentFor,
  fieldClass,
  formatFollowers,
  type Talent,
} from './talent/shared';

/**
 * TalentNetwork — public directory of creators and managers.
 *
 * Built for scale: the backend filters, sorts, and paginates in SQL
 * (`/creators/public-list` returns { items, total, hasMore }), and this page
 * appends pages via an IntersectionObserver sentinel (infinite scroll) with
 * skeleton loading, request cancellation, and an explicit error/retry state.
 */

const PAGE_SIZE = 24;

type Tab = 'creator' | 'manager';
type SortKey = 'top' | 'name';

type FilterState = {
  search: string;
  location: string;
  niche: string;
  followerRangeId: string;
  platforms: Set<string>;
};

const INITIAL_FILTERS: FilterState = {
  search: '',
  location: '',
  niche: '',
  followerRangeId: 'any',
  platforms: new Set<string>(),
};

/* ── Filter section wrapper ──────────────────────────────────────── */
const FilterSection: React.FC<{
  title: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}> = ({ title, children, hint }) => (
  <div className="pb-4 mb-4 border-b border-border last:border-0 last:mb-0 last:pb-0">
    <div className="flex items-center justify-between mb-2.5">
      <Label className="text-foreground text-xs font-semibold">{title}</Label>
      {hint && <span className="text-muted text-[10px] font-medium">{hint}</span>}
    </div>
    {children}
  </div>
);

/* ── Filter panel (desktop sidebar + mobile sheet) ───────────────── */
const FilterPanel: React.FC<{
  tab: Tab;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onReset: () => void;
}> = ({ tab, filters, setFilters, onReset }) => {
  const togglePlatform = (id: string) => {
    setFilters((prev) => {
      const next = new Set(prev.platforms);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, platforms: next };
    });
  };

  return (
    <div>
      <FilterSection title="Search">
        <SearchField
          aria-label="Search talent"
          value={filters.search}
          onChange={(v) => setFilters((f) => ({ ...f, search: v }))}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Name, @handle, keyword…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </FilterSection>

      {tab === 'creator' ? (
        <>
          <FilterSection title="Location">
            <div className="relative">
              <MapPin
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                type="text"
                value={filters.location}
                onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
                placeholder="City or country"
                className={`${fieldClass} pl-9`}
              />
            </div>
          </FilterSection>

          <FilterSection
            title="Platforms"
            hint={filters.platforms.size > 0 ? `${filters.platforms.size} selected` : null}
          >
            <div className="space-y-1">
              {PLATFORMS.map((p) => {
                const active = filters.platforms.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      active
                        ? 'bg-accent-soft border-accent/40 text-foreground'
                        : 'bg-surface border-border text-foreground hover:border-accent/40'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md"
                        style={{
                          background: active ? `${p.color}18` : 'transparent',
                          color: p.color,
                        }}
                      >
                        <PlatformIcon platform={p.iconKey} size={13} />
                      </span>
                      {p.label}
                    </span>
                    <span
                      className={`size-4 rounded-full border-2 transition-colors ${
                        active ? 'border-accent bg-accent' : 'border-border bg-transparent'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </FilterSection>

          <FilterSection title="Category" hint={filters.niche || null}>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, niche: '' }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filters.niche === ''
                    ? 'bg-accent border-accent text-accent-foreground'
                    : 'bg-surface border-border text-foreground hover:border-accent/40'
                }`}
              >
                Any
              </button>
              {NICHES.map((n) => {
                const active = filters.niche === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, niche: active ? '' : n }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-accent border-accent text-accent-foreground'
                        : 'bg-surface border-border text-foreground hover:border-accent/40'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          <FilterSection title="Followers">
            <div className="space-y-1">
              {FOLLOWER_RANGES.map((r) => {
                const active = filters.followerRangeId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, followerRangeId: r.id }))}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      active
                        ? 'bg-accent-soft border-accent/40 text-foreground'
                        : 'bg-surface border-border text-foreground hover:border-accent/40'
                    }`}
                  >
                    {r.label}
                    <span
                      className={`size-4 rounded-full border-2 transition-colors ${
                        active ? 'border-accent bg-accent' : 'border-border bg-transparent'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </FilterSection>
        </>
      ) : (
        <p className="text-muted text-xs leading-relaxed mb-4">
          Managers are searchable by name and bio, ranked by their brand rating.
        </p>
      )}

      <Button variant="ghost" size="sm" fullWidth onPress={onReset}>
        Reset all filters
      </Button>
    </div>
  );
};

/* ── Talent card ─────────────────────────────────────────────────── */
const TalentCard = React.memo<{
  talent: Talent;
  index: number;
  canInvite: boolean;
  loggedIn: boolean;
  viewerIsCreator: boolean;
  onInvite: (t: Talent) => void;
}>(({ talent, index, canInvite, loggedIn, viewerIsCreator, onInvite }) => {
  const isCreator = talent._type === 'creator';
  const name = talent.full_name || talent.username || (isCreator ? 'Creator' : 'Manager');
  const initial = name[0]?.toUpperCase() || 'T';
  const accent = accentFor(String(talent.id || name));
  const links = socialEntries(talent.social_links);
  const shown = links.slice(0, 4);
  const overflow = links.length - shown.length;
  const focus = talent.category || talent.specialty;
  /** Sum of per-platform follower counts — the number brands decide on. */
  const platformTotal = links.reduce((s, l) => s + (l.followers || 0), 0);

  return (
    <article
      className="v-talent-card v-card-in p-4"
      style={{ animationDelay: `${(index % PAGE_SIZE) * 28}ms` }}
    >
      {/* identity row */}
      <div className="flex items-start gap-3">
        {talent.avatar_url ? (
          <img
            src={talent.avatar_url}
            alt=""
            loading="lazy"
            className="h-12 w-12 rounded-full object-cover shrink-0"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(11,23,54,0.08)' }}
          />
        ) : (
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-full text-base font-medium text-white shrink-0"
            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
          >
            {initial}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="v-ink font-medium truncate" style={{ fontSize: 15, letterSpacing: '-0.015em' }}>
            {name}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5 v-caption v-quiet" style={{ fontSize: 11.5 }}>
            {talent.username && <span className="truncate">@{talent.username}</span>}
            {talent.username && talent.location && <span aria-hidden>·</span>}
            {talent.location && (
              <span className="inline-flex items-center gap-0.5 truncate">
                <MapPin size={10} className="shrink-0" />
                {talent.location}
              </span>
            )}
          </div>
        </div>

        {isCreator ? (
          focus && (
            <Chip color="accent" variant="soft" size="sm" className="shrink-0 max-w-[110px]">
              <Chip.Label className="truncate">{focus}</Chip.Label>
            </Chip>
          )
        ) : (
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
            style={{ background: 'rgba(255,181,71,0.14)', color: '#8a5a00' }}
          >
            <Star size={10} className="fill-warning text-warning" />
            {Number(talent.rating || 5).toFixed(1)}
          </span>
        )}
      </div>

      {/* bio — fixed 2-line slot so rows stay level */}
      <p className="mt-3 v-body v-muted line-clamp-2" style={{ fontSize: 12.5, minHeight: 38 }}>
        {talent.bio || (isCreator
          ? `${focus || 'Content'} creator open to brand collaborations.`
          : `${focus || 'Campaign'} manager representing a roster of creators.`)}
      </p>

      {/* platform rail — where they publish, and how big they are there */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap" aria-label="Platforms and follower counts">
        {shown.length > 0 ? (
          <>
            {shown.map((l) => (
              <a
                key={l.id}
                className="v-social-chip"
                href={l.url || undefined}
                target="_blank"
                rel="noreferrer"
                title={`${name} on ${l.label}${l.followers ? ` · ${formatCompact(l.followers)} followers` : ''}`}
                aria-label={`${name} on ${l.label}${l.followers ? `, ${formatCompact(l.followers)} followers` : ''}`}
              >
                <span className="inline-flex" style={{ color: l.color }}>
                  <PlatformIcon platform={PLATFORM_ICON_KEY[l.id]} size={13} />
                </span>
                {l.followers ? (
                  <span className="v-ink font-medium tabular-nums" style={{ fontSize: 11 }}>
                    {formatCompact(l.followers)}
                  </span>
                ) : null}
              </a>
            ))}
            {overflow > 0 && (
              <span
                className="v-social-tile v-quiet"
                style={{ fontSize: 10.5 }}
                title={links.slice(4).map((l) => `${l.label}${l.followers ? ` ${formatCompact(l.followers)}` : ''}`).join(' · ')}
              >
                +{overflow}
              </span>
            )}
            {!isCreator && focus && (
              <span className="v-caption v-quiet ml-1 truncate" style={{ fontSize: 11 }}>
                {focus}
              </span>
            )}
          </>
        ) : (
          <span className="v-social-empty">
            <Link2 size={11} /> Socials not linked yet
          </span>
        )}
      </div>

      {/* footer: the decision number + a compact CTA */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
        <div className="inline-flex items-baseline gap-1.5 min-w-0">
          {isCreator ? (
            platformTotal > 0 ? (
              <>
                <span className="v-ink font-medium tabular-nums" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
                  {formatCompact(platformTotal)}
                </span>
                <span className="v-caption v-quiet" style={{ fontSize: 11 }}>
                  total followers
                </span>
              </>
            ) : (
              <>
                <Users size={12} className="self-center" style={{ color: 'var(--color-campaign-purple)' }} />
                <span className="v-ink font-medium tabular-nums truncate" style={{ fontSize: 13 }}>
                  {talent.follower_range || formatFollowers(talent.follower_count || 0)}
                </span>
                <span className="v-caption v-quiet" style={{ fontSize: 11 }}>followers</span>
              </>
            )
          ) : (
            <>
              <Award size={12} className="self-center" style={{ color: 'var(--color-campaign-purple)' }} />
              <span className="v-ink font-medium" style={{ fontSize: 13 }}>
                {talent.experience_years ? `${talent.experience_years}yr` : '5yr+'}
              </span>
              <span className="v-caption v-quiet" style={{ fontSize: 11 }}>experience</span>
            </>
          )}
        </div>

        {!loggedIn ? (
          <Link to="/login" title={`Sign in to ${isCreator ? 'collaborate' : 'hire'}`}>
            <Button variant="ghost" size="sm" className="!px-2.5">
              <Lock size={11} /> Sign in
            </Button>
          </Link>
        ) : canInvite ? (
          <Button variant="primary" size="sm" onPress={() => onInvite(talent)}>
            <Send size={11} /> Invite
          </Button>
        ) : viewerIsCreator ? (
          <span className="v-caption v-quiet" style={{ fontSize: 11 }}>
            Creator view
          </span>
        ) : null}
      </div>
    </article>
  );
});
TalentCard.displayName = 'TalentCard';

/* ── Skeleton card ───────────────────────────────────────────────── */
const SkeletonCard: React.FC = () => (
  <div className="v-talent-card p-4" aria-hidden>
    <div className="flex items-start gap-3">
      <div className="v-skel h-12 w-12 !rounded-full shrink-0" />
      <div className="flex-1 pt-1">
        <div className="v-skel h-4 w-1/2 mb-2" />
        <div className="v-skel h-3 w-3/4" />
      </div>
    </div>
    <div className="v-skel h-3 w-full mt-4 mb-1.5" />
    <div className="v-skel h-3 w-4/5 mb-4" />
    <div className="flex gap-1.5 mb-4">
      <div className="v-skel h-[30px] w-[30px] !rounded-[9px]" />
      <div className="v-skel h-[30px] w-[30px] !rounded-[9px]" />
      <div className="v-skel h-[30px] w-[30px] !rounded-[9px]" />
    </div>
    <div className="flex items-center justify-between pt-3 border-t border-border">
      <div className="v-skel h-4 w-24" />
      <div className="v-skel h-8 w-20 !rounded-lg" />
    </div>
  </div>
);

/* ── Main page ───────────────────────────────────────────────────── */
const TalentNetwork: React.FC = () => {
  const loggedIn = !!localStorage.getItem('token');
  const userRole = localStorage.getItem('role') || '';
  const canInvite = loggedIn && (userRole === 'brand' || userRole === 'manager');

  const [tab, setTab] = useState<Tab>('creator');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [sort, setSort] = useState<SortKey>('top');

  const [items, setItems] = useState<Talent[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [invModal, setInvModal] = useState<{
    talent: Talent;
    type: 'creator_collab' | 'manager_assign';
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const offsetRef = useRef(0);

  const resetAll = () => setFilters(INITIAL_FILTERS);

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
        let url: string;
        const params: Record<string, string> = {
          limit: String(PAGE_SIZE),
          offset: String(offsetRef.current),
        };

        if (tab === 'creator') {
          url = '/creators/public-list';
          params.sort = sort === 'name' ? 'name' : 'followers_desc';
          if (filters.search) params.search = filters.search;
          if (filters.niche) params.category = filters.niche;
          if (filters.location.trim()) params.location = filters.location.trim();
          const range = FOLLOWER_RANGES.find((r) => r.id === filters.followerRangeId);
          if (range?.min) params.minFollowers = String(range.min);
          if (range?.max) params.maxFollowers = String(range.max);
          if (filters.platforms.size > 0) params.platforms = [...filters.platforms].join(',');
        } else {
          url = '/managers/public';
          params.sort = sort === 'name' ? 'name' : 'rating_desc';
          if (filters.search) params.search = filters.search;
        }

        const res = await api.get(url, { params, signal: ctrl.signal });
        const data = res.data || {};
        const list: Talent[] = (data.items || []).map((row: any) => ({
          ...row,
          _type: tab,
        }));

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
    [tab, filters, sort],
  );

  /* Debounced refetch whenever tab / filters / sort change */
  useEffect(() => {
    const t = setTimeout(() => fetchPage(true), 300);
    return () => {
      clearTimeout(t);
    };
  }, [fetchPage]);

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

  const onInvite = useCallback((t: Talent) => {
    setInvModal({
      talent: t,
      type: t._type === 'creator' ? 'creator_collab' : 'manager_assign',
    });
  }, []);

  /* Active-filter chips */
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (filters.search)
      chips.push({ key: 'search', label: `Search: ${filters.search}`, onClear: () => setFilters((f) => ({ ...f, search: '' })) });
    if (tab === 'creator') {
      if (filters.location)
        chips.push({ key: 'location', label: filters.location, onClear: () => setFilters((f) => ({ ...f, location: '' })) });
      if (filters.niche)
        chips.push({ key: 'niche', label: filters.niche, onClear: () => setFilters((f) => ({ ...f, niche: '' })) });
      if (filters.followerRangeId !== 'any')
        chips.push({
          key: 'followers',
          label: FOLLOWER_RANGES.find((r) => r.id === filters.followerRangeId)?.label || 'Followers',
          onClear: () => setFilters((f) => ({ ...f, followerRangeId: 'any' })),
        });
      filters.platforms.forEach((id) => {
        const p = PLATFORMS.find((x) => x.id === id);
        if (p)
          chips.push({
            key: `platform-${id}`,
            label: p.label,
            onClear: () =>
              setFilters((f) => {
                const next = new Set(f.platforms);
                next.delete(id);
                return { ...f, platforms: next };
              }),
          });
      });
    }
    return chips;
  }, [filters, tab]);

  return (
    <div className="landing-visitors min-h-screen flex flex-col">
      <LandingNav />

      <main className="flex-1">
        {/* Hero (compact) */}
        <section className="px-6 lg:px-10 pt-10 pb-6">
          <div className="max-w-[1100px] mx-auto text-center">
            <Chip color="accent" variant="soft" size="md" className="!mb-4">
              <Zap size={12} />
              <Chip.Label>The talent network</Chip.Label>
            </Chip>
            <h1 className="v-heading-xl mb-2">
              Find the right creator for your{' '}
              <span className="v-text-signature">next drop.</span>
            </h1>
            <p className="v-body-lg v-muted max-w-2xl mx-auto">
              Browse creators and managers by platform, niche, audience size, and
              location — then invite them with a contract in one flow.
            </p>
          </div>
        </section>

        {/* Body: sidebar + results */}
        <section className="px-6 lg:px-10 pb-16">
          <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-[290px_1fr] gap-6">
            {/* Sidebar (desktop) */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <Card>
                  <Card.Header className="flex-row items-center justify-between !py-3">
                    <Card.Title className="inline-flex items-center gap-2 text-sm">
                      <Filter size={14} className="text-accent" /> Filters
                    </Card.Title>
                    {activeChips.length > 0 && (
                      <Chip color="accent" variant="soft" size="sm">
                        <Chip.Label>{activeChips.length}</Chip.Label>
                      </Chip>
                    )}
                  </Card.Header>
                  <Separator />
                  <Card.Content className="p-4 max-h-[calc(100vh-140px)] overflow-y-auto">
                    <FilterPanel tab={tab} filters={filters} setFilters={setFilters} onReset={resetAll} />
                  </Card.Content>
                </Card>
              </div>
            </aside>

            {/* Results */}
            <div>
              {/* Toolbar */}
              <div className="flex items-center gap-x-3 gap-y-2 mb-3 flex-wrap">
                <Segment
                  size="sm"
                  selectedKey={tab}
                  onSelectionChange={(k) => setTab(k as Tab)}
                  aria-label="Talent type"
                >
                  <Segment.Item id="creator">Creators</Segment.Item>
                  <Segment.Item id="manager">Managers</Segment.Item>
                </Segment>

                <p className="hidden lg:block text-muted text-xs whitespace-nowrap" aria-live="polite">
                  {loading ? (
                    'Searching…'
                  ) : (
                    <>
                      <span className="text-foreground font-semibold tabular-nums">{items.length}</span>
                      {' of '}
                      <span className="tabular-nums">{total}</span>
                      {tab === 'creator' ? ' creators' : ' managers'}
                    </>
                  )}
                </p>

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="lg:!hidden"
                    onPress={() => setSheetOpen(true)}
                  >
                    <Filter size={13} /> Filters
                    {activeChips.length > 0 && (
                      <Chip color="accent" variant="soft" size="sm">
                        <Chip.Label>{activeChips.length}</Chip.Label>
                      </Chip>
                    )}
                  </Button>
                  <Segment
                    size="sm"
                    className="hidden lg:flex"
                    selectedKey={sort}
                    onSelectionChange={(k) => setSort(k as SortKey)}
                    aria-label="Sort results"
                  >
                    <Segment.Item id="top">Top</Segment.Item>
                    <Segment.Item id="name">A–Z</Segment.Item>
                  </Segment>
                </div>
              </div>

              {/* Active filter chips */}
              {activeChips.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {activeChips.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={c.onClear}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-soft border border-accent/40 text-accent-soft-foreground text-xs font-medium hover:bg-accent-soft/70 transition-colors"
                    >
                      {c.label}
                      <span className="opacity-60">×</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={resetAll}
                    className="text-muted text-xs font-medium hover:text-foreground underline"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Results grid */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-label="Loading talent">
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
                      <EmptyState.Title>Couldn&apos;t load talent</EmptyState.Title>
                      <EmptyState.Description>
                        Something went wrong while fetching profiles. Check your connection and try again.
                      </EmptyState.Description>
                      <EmptyState.Content>
                        <Button variant="primary" size="md" onPress={() => fetchPage(true)}>
                          Try again
                        </Button>
                      </EmptyState.Content>
                    </EmptyState>
                  </Card.Content>
                </Card>
              ) : items.length === 0 ? (
                <Card>
                  <Card.Content className="p-8">
                    <EmptyState>
                      <EmptyState.Media>
                        <SearchIcon className="size-7" />
                      </EmptyState.Media>
                      <EmptyState.Title>No talent found</EmptyState.Title>
                      <EmptyState.Description>
                        Try broadening your search or removing some filters.
                      </EmptyState.Description>
                      <EmptyState.Content>
                        <Button variant="primary" size="md" onPress={resetAll}>
                          Reset all filters
                        </Button>
                      </EmptyState.Content>
                    </EmptyState>
                  </Card.Content>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {items.map((t, i) => (
                      <TalentCard
                        key={`${t._type}-${t.id}`}
                        talent={t}
                        index={i}
                        canInvite={canInvite}
                        loggedIn={loggedIn}
                        viewerIsCreator={userRole === 'creator'}
                        onInvite={onInvite}
                      />
                    ))}
                  </div>

                  {/* Infinite-scroll sentinel + fallback button */}
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
                      You&apos;ve seen all {total} {tab === 'creator' ? 'creators' : 'managers'}.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Mobile filter sheet */}
      <Sheet
        isOpen={sheetOpen}
        onOpenChange={(open) => !open && setSheetOpen(false)}
        placement="left"
      >
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog>
              <Sheet.Header>
                <Sheet.Heading className="inline-flex items-center gap-2">
                  <Filter size={15} className="text-accent" /> Filters
                </Sheet.Heading>
              </Sheet.Header>
              <Sheet.Body className="!p-4">
                <div className="pb-4 mb-4 border-b border-border">
                  <Label className="text-foreground text-xs font-semibold block mb-2.5">
                    Sort by
                  </Label>
                  <Segment selectedKey={sort} onSelectionChange={(k) => setSort(k as SortKey)}>
                    <Segment.Item id="top">Top</Segment.Item>
                    <Segment.Item id="name">A–Z</Segment.Item>
                  </Segment>
                </div>
                <FilterPanel tab={tab} filters={filters} setFilters={setFilters} onReset={resetAll} />
              </Sheet.Body>
              <Sheet.Footer>
                <Button variant="primary" fullWidth onPress={() => setSheetOpen(false)}>
                  Show {total} results
                </Button>
              </Sheet.Footer>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>

      {/* Invitation modal */}
      {invModal && (
        <InvitationModal
          talent={invModal.talent}
          type={invModal.type}
          isOpen={!!invModal}
          onClose={() => setInvModal(null)}
        />
      )}
    </div>
  );
};

export default TalentNetwork;
