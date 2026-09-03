import React, { useEffect, useMemo, useState } from 'react';
import { Button, SearchField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import PlatformIcon from '../../pages/landing/mocks/PlatformIcon';
import { FOLLOWER_RANGES, NICHES, PLATFORMS } from '../../pages/talent/shared';
import SearchSelect from './SearchSelect';
import { CheckRows, FilterSection, OptionRows, PillChips } from './filters';

/**
 * Talent directory filters — the single definition used by the public
 * /talent page and every dashboard "find talent" surface.
 */

export type TalentTab = 'creator' | 'manager';
export type TalentSortKey = 'top' | 'name';

export type TalentFilterState = {
  search: string;
  country: string;
  city: string;
  niche: string;
  followerRangeId: string;
  platforms: Set<string>;
};

export const INITIAL_TALENT_FILTERS: TalentFilterState = {
  search: '',
  country: '',
  city: '',
  niche: '',
  followerRangeId: 'any',
  platforms: new Set<string>(),
};

/** One row of the location facets: a (country, city) pair that actually
 *  exists among active creators, with its creator count. */
export type LocationRow = { country: string; city: string | null; count: number };

/** Location facets — only places active creators actually are. */
export const useTalentLocations = (): LocationRow[] => {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  useEffect(() => {
    api
      .get('/creators/locations')
      .then((res) => setLocations(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);
  return locations;
};

type FieldProps = {
  filters: TalentFilterState;
  setFilters: React.Dispatch<React.SetStateAction<TalentFilterState>>;
};

/**
 * Location filter — dropdowns fed by `/creators/locations`, so the lists
 * only offer countries and cities where creators actually are (with
 * counts). No free text: an empty platform in Ethiopia can never be
 * "filtered" to Iceland by a typo.
 */
export const LocationFields: React.FC<FieldProps & { locations: LocationRow[] }> = ({
  filters,
  setFilters,
  locations,
}) => {
  const { t } = useTranslation();
  const countryOptions = useMemo(() => {
    const byCountry = new Map<string, number>();
    for (const l of locations) byCountry.set(l.country, (byCountry.get(l.country) || 0) + l.count);
    return [...byCountry.entries()].map(([name, count]) => ({
      value: name,
      label: name,
      hint: String(count),
    }));
  }, [locations]);

  const cityOptions = useMemo(() => {
    if (!filters.country) return [];
    return locations
      .filter((l) => l.country === filters.country && l.city)
      .map((l) => ({ value: l.city!, label: l.city!, hint: String(l.count) }));
  }, [locations, filters.country]);

  return (
    <div className="space-y-2.5">
      <SearchSelect
        aria-label="Country"
        placeholder={countryOptions.length ? t('talent.countryPh') : t('talent.noLocations')}
        disabled={countryOptions.length === 0}
        options={countryOptions}
        value={filters.country}
        onChange={(country) => setFilters((f) => ({ ...f, country, city: '' }))}
      />
      <SearchSelect
        aria-label="City"
        placeholder={filters.country ? t('talent.cityPh') : t('talent.pickCountry')}
        disabled={!filters.country || cityOptions.length === 0}
        options={cityOptions}
        value={filters.city}
        onChange={(city) => setFilters((f) => ({ ...f, city }))}
      />
    </div>
  );
};

export const PlatformRows: React.FC<FieldProps> = ({ filters, setFilters }) => (
  <CheckRows
    options={PLATFORMS.map((p) => ({
      id: p.id,
      label: p.label,
      color: p.color,
      icon: <PlatformIcon platform={p.iconKey} size={13} />,
    }))}
    selected={filters.platforms}
    onToggle={(id) =>
      setFilters((prev) => {
        const next = new Set(prev.platforms);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { ...prev, platforms: next };
      })
    }
  />
);

export const CategoryChips: React.FC<FieldProps> = ({ filters, setFilters }) => {
  const { t } = useTranslation();
  return (
    <PillChips
      anyLabel={t('common.any')}
      options={NICHES.map((n) => ({ id: n, label: t(`cats.${n}`, { defaultValue: n }) }))}
      value={filters.niche}
      onSelect={(niche) => setFilters((f) => ({ ...f, niche }))}
    />
  );
};

export const FollowerRows: React.FC<FieldProps> = ({ filters, setFilters }) => {
  const { t } = useTranslation();
  return (
    <OptionRows
      options={FOLLOWER_RANGES.map((r) => ({
        id: r.id,
        label: t(`talent.fr.${r.id}`, { defaultValue: r.label }),
      }))}
      value={filters.followerRangeId}
      onSelect={(followerRangeId) => setFilters((f) => ({ ...f, followerRangeId }))}
    />
  );
};

/** Full stacked panel — used in the mobile filter sheet. */
export const TalentFilterPanel: React.FC<{
  tab: TalentTab;
  filters: TalentFilterState;
  setFilters: React.Dispatch<React.SetStateAction<TalentFilterState>>;
  onReset: () => void;
  locations: LocationRow[];
}> = ({ tab, filters, setFilters, onReset, locations }) => {
  const { t } = useTranslation();
  return (
    <div>
      <FilterSection title={t('talent.fSearch')}>
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
      </FilterSection>

      {tab === 'creator' ? (
        <>
          <FilterSection title={t('talent.fLocation')}>
            <LocationFields filters={filters} setFilters={setFilters} locations={locations} />
          </FilterSection>

          <FilterSection
            title={t('talent.fPlatforms')}
            hint={filters.platforms.size > 0 ? t('common.selectedN', { n: filters.platforms.size }) : null}
          >
            <PlatformRows filters={filters} setFilters={setFilters} />
          </FilterSection>

          <FilterSection
            title={t('talent.fCategory')}
            hint={filters.niche ? t(`cats.${filters.niche}`, { defaultValue: filters.niche }) : null}
          >
            <CategoryChips filters={filters} setFilters={setFilters} />
          </FilterSection>

          <FilterSection title={t('talent.fFollowers')}>
            <FollowerRows filters={filters} setFilters={setFilters} />
          </FilterSection>
        </>
      ) : (
        <p className="text-muted text-xs leading-relaxed mb-4">{t('talent.managersHint')}</p>
      )}

      <Button variant="ghost" size="sm" fullWidth onPress={onReset}>
        {t('talent.resetAll')}
      </Button>
    </div>
  );
};
