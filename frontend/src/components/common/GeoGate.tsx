import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

/**
 * GeoGate — market auto-routing for the root landing page.
 *
 * The contract:
 *  - `/` is the GLOBAL site (English) — the default whenever the visitor
 *    matches no live market, or detection fails.
 *  - A first-time visitor from a live-market country is routed once to
 *    /{market}, and that home is remembered (localStorage `market_home`).
 *  - A returning visitor with a stored market goes straight to it — but
 *    only on a fresh page load. In-app navigation back to `/` (logo click,
 *    "other markets") is an explicit choice and is never hijacked.
 *  - `/?global=1` pins the global site (`market_home=root`) — the escape
 *    hatch out of auto-routing.
 *  - `/?geomock=ET` simulates a country in dev (backend ignores the mock
 *    in production).
 *
 * In production the Vercel edge middleware (frontend/middleware.ts) usually
 * performs the first redirect from the CDN before any JS loads; this gate
 * is the same policy for dev, other hosts, and anything the edge skipped.
 */
let ranThisLoad = false; // module scope → once per full page load, not per mount

export const GeoGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (ranThisLoad) return;
    ranThisLoad = true;

    const params = new URLSearchParams(window.location.search);
    const store = (v: string) => {
      try { localStorage.setItem('market_home', v); } catch { /* private mode */ }
    };

    if (params.get('global') === '1') {
      store('root');
      return;
    }

    let home: string | null = null;
    try { home = localStorage.getItem('market_home'); } catch { /* private mode */ }

    if (home === 'root') return; // explicit global preference
    if (home) {
      navigate(`/${home}`, { replace: true });
      return;
    }

    // First visit: detect country; only LIVE markets route. Unknown or
    // coming-soon countries stay on the global page and re-detect next
    // visit, so newly launched markets pick their people up automatically.
    const mock = params.get('geomock');
    api
      .get('/geo/detect', { params: mock ? { mock } : {} })
      .then((res) => {
        const market = res.data?.market;
        if (market?.status === 'live') {
          store(market.code);
          navigate(`/${market.code}`, { replace: true });
        }
      })
      .catch(() => { /* detection down → global page, by design */ });
  }, [navigate]);

  return <>{children}</>;
};

export default GeoGate;
