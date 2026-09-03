import React from 'react';
import { Label, SearchField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import PlatformIcon from '../../pages/landing/mocks/PlatformIcon';
import { PLATFORM_META, type PlatformId } from './CampaignCard';

/**
 * Directory filter primitives — shared by the public talent + campaign
 * directories AND the dashboard pages (brand / creator / manager), so
 * every list in the product filters the same way and looks the same.
 *
 *   <DirectoryToolbar search={{…}} count={…}>{segments}</DirectoryToolbar>
 *   <PlatformChipRow value={…} onChange={…} trailing={<FacetPopover…/>} />
 *   <ActiveFilterChips chips={…} onClearAll={…} />
 *   <FilterSection title="…"><OptionRows …/></FilterSection>
 */

/* ── Section wrapper used inside facet panels + mobile sheets ────── */
export const FilterSection: React.FC<{
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

/* ── Radio-style option rows (single select) ─────────────────────── */
export type OptionRow = { id: string; label: React.ReactNode; hint?: string };

export const OptionRows: React.FC<{
  options: OptionRow[];
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

/* ── Checkbox-style rows (multi select) ──────────────────────────── */
export const CheckRows: React.FC<{
  options: (OptionRow & { icon?: React.ReactNode; color?: string })[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}> = ({ options, selected, onToggle }) => (
  <div className="space-y-1">
    {options.map((o) => {
      const active = selected.has(o.id);
      return (
        <button
          key={o.id}
          type="button"
          onClick={() => onToggle(o.id)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            active
              ? 'bg-accent-soft border-accent/40 text-foreground'
              : 'bg-surface border-border text-foreground hover:border-accent/40'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 min-w-0">
            {o.icon && (
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-md shrink-0"
                style={{ background: active && o.color ? `${o.color}18` : 'transparent', color: o.color }}
              >
                {o.icon}
              </span>
            )}
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

/* ── Pill chips (single select, e.g. categories) ─────────────────── */
export const PillChips: React.FC<{
  options: { id: string; label: React.ReactNode }[];
  value: string;
  onSelect: (id: string) => void;
  /** Rendered first; selecting it clears the value. */
  anyLabel?: React.ReactNode;
}> = ({ options, value, onSelect, anyLabel }) => {
  const cls = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
      active
        ? 'bg-accent border-accent text-accent-foreground'
        : 'bg-surface border-border text-foreground hover:border-accent/40'
    }`;
  return (
    <div className="flex flex-wrap gap-1.5">
      {anyLabel !== undefined && (
        <button type="button" onClick={() => onSelect('')} className={cls(value === '')}>
          {anyLabel}
        </button>
      )}
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(active ? '' : o.id)}
            className={cls(active)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

/* ── Active filter chips row ─────────────────────────────────────── */
export type ActiveChip = { key: string; label: React.ReactNode; onClear: () => void };

export const ActiveFilterChips: React.FC<{
  chips: ActiveChip[];
  onClearAll: () => void;
  className?: string;
}> = ({ chips, onClearAll, className = 'mb-4' }) => {
  const { t } = useTranslation();
  if (chips.length === 0) return null;
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {chips.map((c) => (
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
        onClick={onClearAll}
        className="text-muted text-xs font-medium hover:text-foreground underline"
      >
        {t('common.clearAll')}
      </button>
    </div>
  );
};

/* ── Toolbar: [leading] [search] [count] ……… [children] ──────────── */
export const DirectoryToolbar: React.FC<{
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    ariaLabel?: string;
    /** Tailwind width classes for the field wrapper. */
    widthClass?: string;
  };
  /** Live result count (rendered muted, desktop only). */
  count?: React.ReactNode;
  /** Rendered before the search (e.g. a Segment for tabs). */
  leading?: React.ReactNode;
  /** Right-aligned controls (Segments, buttons). */
  children?: React.ReactNode;
  className?: string;
}> = ({ search, count, leading, children, className = 'mb-3' }) => (
  <div className={`flex items-center gap-x-3 gap-y-2 flex-wrap ${className}`}>
    {leading}
    {search && (
      <div className={search.widthClass ?? 'w-full sm:w-[260px]'}>
        <SearchField aria-label={search.ariaLabel ?? search.placeholder} value={search.value} onChange={search.onChange}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={search.placeholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>
    )}
    {count !== undefined && (
      <p className="hidden lg:block text-muted text-xs whitespace-nowrap" aria-live="polite">
        {count}
      </p>
    )}
    {children && <div className="ml-auto flex items-center gap-2 flex-wrap">{children}</div>}
  </div>
);

/* ── Platform chip row (campaign directories) ────────────────────── */
export const PlatformChipRow: React.FC<{
  value: 'all' | PlatformId;
  onChange: (v: 'all' | PlatformId) => void;
  /** Facet popovers etc. rendered at the row's right edge. */
  trailing?: React.ReactNode;
  className?: string;
}> = ({ value, onChange, trailing, className = 'mb-5' }) => {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      <button
        type="button"
        onClick={() => onChange('all')}
        className="v-niche-chip"
        data-active={value === 'all' || undefined}
        aria-pressed={value === 'all'}
      >
        {t('board.allPlatforms')}
      </button>
      {PLATFORM_META.filter((m) => m.id !== 'other').map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(active ? 'all' : m.id)}
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
      {trailing && <div className="ml-auto flex items-center gap-2 flex-wrap">{trailing}</div>}
    </div>
  );
};

/* ── Infinite-scroll footer: sentinel + load-more + "seen all" ───── */
export const LoadMoreFooter: React.FC<{
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  hasMore: boolean;
  loadingMore: boolean;
  remaining: number;
  onLoadMore: () => void;
  /** Rendered when everything is loaded (only shown for longer lists). */
  seenAll?: React.ReactNode;
  showSeenAll?: boolean;
  skeleton: React.ReactNode;
  gridClass: string;
}> = ({ sentinelRef, hasMore, loadingMore, remaining, onLoadMore, seenAll, showSeenAll, skeleton, gridClass }) => {
  const { t } = useTranslation();
  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {loadingMore && (
        <div className={`${gridClass} mt-4`} aria-label="Loading more">
          {Array.from({ length: 3 }).map((_, i) => (
            <React.Fragment key={i}>{skeleton}</React.Fragment>
          ))}
        </div>
      )}
      {hasMore && !loadingMore && (
        <div className="flex justify-center mt-6">
          <button type="button" onClick={onLoadMore} className="v-facet-btn !px-4 !py-2.5">
            {t('common.loadMore', { n: remaining })}
          </button>
        </div>
      )}
      {!hasMore && showSeenAll && seenAll && (
        <p className="text-center text-muted text-xs mt-6">{seenAll}</p>
      )}
    </>
  );
};
