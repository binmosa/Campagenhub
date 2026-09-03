import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Filter, Search as SearchIcon, SearchX } from 'lucide-react';
import { Button, Chip, Label, SearchField } from '@heroui/react';
import { Segment, Sheet } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import InvitationModal from '../../pages/talent/InvitationModal';
import { FOLLOWER_RANGES, PLATFORMS, type Talent } from '../../pages/talent/shared';
import FacetPopover from './FacetPopover';
import { EmptyPanel } from './EmptyPanel';
import { ActiveFilterChips, DirectoryToolbar, LoadMoreFooter, type ActiveChip } from './filters';
import { TalentCard, TalentCardSkeleton } from './TalentCard';
import {
  CategoryChips,
  FollowerRows,
  INITIAL_TALENT_FILTERS,
  LocationFields,
  PlatformRows,
  TalentFilterPanel,
  useTalentLocations,
  type TalentFilterState,
  type TalentSortKey,
  type TalentTab,
} from './TalentFilters';

/**
 * TalentDirectory — the creators + managers directory body, shared by
 * the public /talent page and the dashboard "find talent" page for every
 * role. The caller supplies the page chrome (hero, padding); this owns
 * the toolbar, facets, grid, infinite scroll, mobile sheet and the
 * invitation flow.
 *
 * Built for scale: the backend filters, sorts, and paginates in SQL
 * (`/creators/public-list` returns { items, total, hasMore }) and pages
 * append via an IntersectionObserver sentinel with skeleton loading,
 * request cancellation, and an explicit error/retry state.
 */
const PAGE_SIZE = 24;
const GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

export interface TalentDirectoryProps {
  /** Deep-link: pre-select a country facet (e.g. from a market page). */
  initialCountry?: string;
  initialTab?: TalentTab;
  /** Show only one talent type and hide the tab switcher. */
  only?: TalentTab;
  /** Override the invite action (default opens the InvitationModal). */
  onInvite?: (talent: Talent) => void;
  /** Custom footer actions per card (e.g. "Add to campaign"). */
  renderActions?: (talent: Talent) => React.ReactNode;
}

export const TalentDirectory: React.FC<TalentDirectoryProps> = ({
  initialCountry = '',
  initialTab = 'creator',
  only,
  onInvite: onInviteOverride,
  renderActions,
}) => {
  const { t } = useTranslation();
  const loggedIn = !!localStorage.getItem('token');
  const userRole = localStorage.getItem('role') || '';
  const canInvite = loggedIn && (userRole === 'brand' || userRole === 'manager');

  const [tab, setTab] = useState<TalentTab>(only ?? initialTab);
  const [filters, setFilters] = useState<TalentFilterState>(() => ({
    ...INITIAL_TALENT_FILTERS,
    country: initialCountry,
  }));
  const [sort, setSort] = useState<TalentSortKey>('top');

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
  const locations = useTalentLocations();

  const resetAll = () => setFilters(INITIAL_TALENT_FILTERS);

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
          if (filters.country) params.country = filters.country;
          if (filters.city) params.city = filters.city;
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
        const list: Talent[] = (data.items || []).map((row: any) => ({ ...row, _type: tab }));

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
    const timer = setTimeout(() => fetchPage(true), 300);
    return () => clearTimeout(timer);
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

  const onInvite = useCallback(
    (talent: Talent) => {
      if (onInviteOverride) {
        onInviteOverride(talent);
        return;
      }
      setInvModal({
        talent,
        type: talent._type === 'creator' ? 'creator_collab' : 'manager_assign',
      });
    },
    [onInviteOverride],
  );

  /* Active-filter chips */
  const activeChips = useMemo(() => {
    const chips: ActiveChip[] = [];
    if (filters.search)
      chips.push({
        key: 'search',
        label: t('talent.searchChip', { q: filters.search }),
        onClear: () => setFilters((f) => ({ ...f, search: '' })),
      });
    if (tab === 'creator') {
      if (filters.country)
        chips.push({
          key: 'country',
          label: filters.country,
          onClear: () => setFilters((f) => ({ ...f, country: '', city: '' })),
        });
      if (filters.city)
        chips.push({ key: 'city', label: filters.city, onClear: () => setFilters((f) => ({ ...f, city: '' })) });
      if (filters.niche)
        chips.push({
          key: 'niche',
          label: t(`cats.${filters.niche}`, { defaultValue: filters.niche }),
          onClear: () => setFilters((f) => ({ ...f, niche: '' })),
        });
      if (filters.followerRangeId !== 'any')
        chips.push({
          key: 'followers',
          label: t(`talent.fr.${filters.followerRangeId}`, { defaultValue: t('talent.fFollowers') }),
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
  }, [filters, tab, t]);

  const sortSegment = (className?: string, size: 'sm' | 'md' = 'sm') => (
    <Segment
      size={size}
      className={className}
      selectedKey={sort}
      onSelectionChange={(k) => setSort(k as TalentSortKey)}
      aria-label="Sort results"
    >
      <Segment.Item id="top">{t('talent.sortTop')}</Segment.Item>
      <Segment.Item id="name">{t('talent.sortAZ')}</Segment.Item>
    </Segment>
  );

  return (
    <div>
      {/* Toolbar */}
      <DirectoryToolbar
        leading={
          !only && (
            <Segment
              size="sm"
              selectedKey={tab}
              onSelectionChange={(k) => setTab(k as TalentTab)}
              aria-label="Talent type"
            >
              <Segment.Item id="creator">{t('talent.tabCreators')}</Segment.Item>
              <Segment.Item id="manager">{t('talent.tabManagers')}</Segment.Item>
            </Segment>
          )
        }
        count={
          loading
            ? t('common.searching')
            : t(tab === 'creator' ? 'talent.countCreators' : 'talent.countManagers', {
                shown: items.length,
                total,
              })
        }
      >
        <Button variant="tertiary" size="sm" className="lg:!hidden" onPress={() => setSheetOpen(true)}>
          <Filter size={13} /> {t('common.filters')}
          {activeChips.length > 0 && (
            <Chip color="accent" variant="soft" size="sm">
              <Chip.Label>{activeChips.length}</Chip.Label>
            </Chip>
          )}
        </Button>
        {sortSegment('hidden lg:flex')}
      </DirectoryToolbar>

      {/* Desktop facet toolbar — filters live above the results, as
          compact popover buttons with selection badges */}
      <div className="hidden lg:flex items-center gap-2 mb-3 flex-wrap">
        <div className="w-[240px]">
          <SearchField
            aria-label="Search talent"
            value={filters.search}
            onChange={(v) => setFilters((f) => ({ ...f, search: v }))}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={t('talent.searchPh')} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>
        {tab === 'creator' && (
          <>
            <FacetPopover
              label={t('talent.fPlatform')}
              width={240}
              badge={filters.platforms.size > 0 ? String(filters.platforms.size) : undefined}
            >
              <PlatformRows filters={filters} setFilters={setFilters} />
            </FacetPopover>
            <FacetPopover
              label={t('talent.fCategory')}
              width={320}
              badge={filters.niche ? t(`cats.${filters.niche}`, { defaultValue: filters.niche }) : undefined}
            >
              <CategoryChips filters={filters} setFilters={setFilters} />
            </FacetPopover>
            <FacetPopover
              label={t('talent.fFollowers')}
              width={240}
              badge={
                filters.followerRangeId !== 'any'
                  ? t(`talent.fr.${filters.followerRangeId}`).split('·').pop()?.trim()
                  : undefined
              }
            >
              <FollowerRows filters={filters} setFilters={setFilters} />
            </FacetPopover>
            <FacetPopover
              label={t('talent.fLocation')}
              width={280}
              badge={filters.city || filters.country || undefined}
            >
              <LocationFields filters={filters} setFilters={setFilters} locations={locations} />
            </FacetPopover>
          </>
        )}
      </div>

      <ActiveFilterChips chips={activeChips} onClearAll={resetAll} />

      {/* Results grid */}
      {loading ? (
        <div className={GRID} aria-label="Loading talent">
          {Array.from({ length: 9 }).map((_, i) => (
            <TalentCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyPanel
          tone="error"
          icon={<AlertCircle size={22} />}
          title={t('talent.errTitle')}
          description={t('talent.errDesc')}
          actions={
            <Button variant="primary" size="md" onPress={() => fetchPage(true)}>
              {t('common.tryAgain')}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyPanel
          icon={activeChips.length > 0 ? <SearchX size={22} /> : <SearchIcon size={22} />}
          title={t('talent.emptyTitle')}
          description={t('talent.emptyDesc')}
          actions={
            activeChips.length > 0 && (
              <Button variant="primary" size="md" onPress={resetAll}>
                {t('talent.resetAll')}
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className={GRID}>
            {items.map((talent, i) => (
              <TalentCard
                key={`${talent._type}-${talent.id}`}
                talent={talent}
                index={i}
                canInvite={canInvite}
                loggedIn={loggedIn}
                viewerIsCreator={userRole === 'creator'}
                onInvite={onInvite}
                actions={renderActions ? renderActions(talent) : undefined}
              />
            ))}
          </div>

          <LoadMoreFooter
            sentinelRef={sentinelRef}
            hasMore={hasMore}
            loadingMore={loadingMore}
            remaining={total - items.length}
            onLoadMore={() => fetchPage(false)}
            skeleton={<TalentCardSkeleton />}
            gridClass={GRID}
            showSeenAll={items.length > PAGE_SIZE}
            seenAll={t(tab === 'creator' ? 'talent.seenAllCreators' : 'talent.seenAllManagers', { total })}
          />
        </>
      )}

      {/* Mobile filter sheet */}
      <Sheet isOpen={sheetOpen} onOpenChange={(open) => !open && setSheetOpen(false)} placement="left">
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog>
              <Sheet.Header>
                <Sheet.Heading className="inline-flex items-center gap-2">
                  <Filter size={15} className="text-accent" /> {t('common.filters')}
                </Sheet.Heading>
              </Sheet.Header>
              <Sheet.Body className="!p-4">
                <div className="pb-4 mb-4 border-b border-border">
                  <Label className="text-foreground text-xs font-semibold block mb-2.5">
                    {t('common.sortBy')}
                  </Label>
                  {sortSegment(undefined, 'md')}
                </div>
                <TalentFilterPanel
                  tab={tab}
                  filters={filters}
                  setFilters={setFilters}
                  onReset={resetAll}
                  locations={locations}
                />
              </Sheet.Body>
              <Sheet.Footer>
                <Button variant="primary" fullWidth onPress={() => setSheetOpen(false)}>
                  {t('talent.showResults', { total })}
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

export default TalentDirectory;
