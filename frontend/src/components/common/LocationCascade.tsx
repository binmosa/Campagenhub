import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCities, getCountries, getStates, type GeoCountry, type GeoState } from '../../lib/geo';
import SearchSelect from './SearchSelect';

/**
 * LocationCascade — Country → State → City dropdowns backed by the ISO
 * dataset (`/api/geo/*`). No free text: every value comes from the list.
 *
 * Emits BOTH display names and ISO codes (country ISO-3166-1 alpha-2,
 * state ISO-3166-2). Codes are the stable keys profiles persist for SQL
 * grouping/joins; cities have no ISO standard, so the canonical city name
 * is the key within (countryCode, stateCode). If a legacy value arrives
 * with names but no codes, the cascade back-fills the codes once the
 * reference lists load.
 */

export type LocationValue = {
  country: string;
  countryCode: string;
  state: string;
  stateCode: string;
  city: string;
};

export const EMPTY_LOCATION: LocationValue = {
  country: '',
  countryCode: '',
  state: '',
  stateCode: '',
  city: '',
};

export const LocationCascade: React.FC<{
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  layout?: 'row' | 'stack';
}> = ({ value, onChange, layout = 'row' }) => {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [states, setStates] = useState<GeoState[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    getCountries()
      .then(setCountries)
      .catch(() => {})
      .finally(() => setLoadingCountries(false));
  }, []);

  const countryIso =
    value.countryCode || countries.find((c) => c.name === value.country)?.iso2 || '';

  /* Back-fill missing codes on legacy values once reference data loads */
  useEffect(() => {
    if (value.country && !value.countryCode && countryIso) {
      onChange({ ...value, countryCode: countryIso });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryIso]);

  useEffect(() => {
    if (!countryIso) {
      setStates([]);
      setCities([]);
      return;
    }
    setLoadingStates(true);
    getStates(countryIso)
      .then(setStates)
      .catch(() => setStates([]))
      .finally(() => setLoadingStates(false));
  }, [countryIso]);

  const stateIso =
    value.stateCode || states.find((s) => s.name === value.state)?.iso2 || '';

  useEffect(() => {
    if (value.state && !value.stateCode && stateIso) {
      onChange({ ...value, stateCode: stateIso });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateIso]);

  useEffect(() => {
    if (!countryIso) return;
    setLoadingCities(true);
    getCities(countryIso, stateIso || undefined)
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [countryIso, stateIso]);

  const hasStates = states.length > 0;
  const wrapClass =
    layout === 'row'
      ? `grid grid-cols-1 ${hasStates ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3`
      : 'space-y-2.5';

  return (
    <div className={wrapClass}>
      <SearchSelect
        aria-label={t('talent.countryPh')}
        placeholder={t('talent.countryPh')}
        loading={loadingCountries}
        options={countries.map((c) => ({ value: c.iso2, label: c.name }))}
        value={countryIso}
        onChange={(iso) => {
          const c = countries.find((x) => x.iso2 === iso);
          onChange({
            country: c?.name || '',
            countryCode: c?.iso2 || '',
            state: '',
            stateCode: '',
            city: '',
          });
        }}
      />
      {hasStates && (
        <SearchSelect
          aria-label={t('talent.statePh')}
          placeholder={t('talent.statePh')}
          disabled={!countryIso}
          loading={loadingStates}
          options={states.map((s) => ({ value: s.iso2, label: s.name }))}
          value={stateIso}
          onChange={(iso) => {
            const s = states.find((x) => x.iso2 === iso);
            onChange({
              ...value,
              countryCode: countryIso,
              state: s?.name || '',
              stateCode: s?.iso2 || '',
              city: '',
            });
          }}
        />
      )}
      <SearchSelect
        aria-label={t('talent.cityPh')}
        placeholder={countryIso ? t('talent.cityPh') : t('talent.pickCountry')}
        disabled={!countryIso}
        loading={loadingCities}
        options={cities.map((n) => ({ value: n, label: n }))}
        value={value.city}
        onChange={(city) => onChange({ ...value, countryCode: countryIso, city })}
      />
    </div>
  );
};

export default LocationCascade;
