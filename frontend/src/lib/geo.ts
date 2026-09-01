import api from './api';

/**
 * geo — country / state / city reference data from `/api/geo/*`
 * (ISO dataset served by the backend), with in-memory caching so
 * dropdowns never refetch the same list twice in a session.
 */

export type GeoCountry = { iso2: string; name: string };
export type GeoState = { iso2: string; name: string };

let countriesCache: GeoCountry[] | null = null;
const statesCache = new Map<string, GeoState[]>();
const citiesCache = new Map<string, string[]>();

export const getCountries = async (): Promise<GeoCountry[]> => {
  if (countriesCache) return countriesCache;
  const res = await api.get('/geo/countries');
  countriesCache = Array.isArray(res.data) ? res.data : [];
  return countriesCache!;
};

export const getStates = async (countryIso: string): Promise<GeoState[]> => {
  if (!countryIso) return [];
  const hit = statesCache.get(countryIso);
  if (hit) return hit;
  const res = await api.get('/geo/states', { params: { country: countryIso } });
  const list = Array.isArray(res.data) ? res.data : [];
  statesCache.set(countryIso, list);
  return list;
};

export const getCities = async (countryIso: string, stateIso?: string): Promise<string[]> => {
  if (!countryIso) return [];
  const key = `${countryIso}:${stateIso || ''}`;
  const hit = citiesCache.get(key);
  if (hit) return hit;
  const res = await api.get('/geo/cities', {
    params: { country: countryIso, ...(stateIso ? { state: stateIso } : {}) },
  });
  const list = Array.isArray(res.data) ? res.data : [];
  citiesCache.set(key, list);
  return list;
};
