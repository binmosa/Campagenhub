import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { setLanguage, SUPPORTED_LANGUAGES } from '../../i18n';
import Landing from '../landing';
import { MarketProvider, type Market } from './MarketContext';
import { MARKET_OVERRIDES } from './overrides';

/**
 * MarketPage — campaignshub.com/{code} (/et, /ng, …).
 *
 * Renders THE shared landing page inside MarketContext, so every country
 * gets the same proven design — localized, with market flavor injected by
 * the sections themselves (hero pill, creators strip). A country can opt
 * into a fully custom page via MARKET_OVERRIDES.
 *
 * Language rule: the market's default language applies only when the
 * visitor has no saved preference — an explicit choice always wins.
 */
export const MarketPage: React.FC = () => {
  const { marketCode } = useParams();
  const [market, setMarket] = useState<Market | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!marketCode) return;
    setMarket(null);
    setNotFound(false);
    api
      .get(`/markets/${marketCode.toLowerCase()}`)
      .then((res) => setMarket(res.data))
      .catch(() => setNotFound(true));
  }, [marketCode]);

  useEffect(() => {
    if (!market) return;
    document.title = `CampaignHub ${market.name}`;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('lang');
    } catch {
      /* private mode */
    }
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang && SUPPORTED_LANGUAGES.some((l) => l.code === urlLang)) {
      setLanguage(urlLang); // explicit share-link language wins
    } else if (!saved && SUPPORTED_LANGUAGES.some((l) => l.code === market.default_language)) {
      setLanguage(market.default_language);
    }
    return () => {
      document.title = 'CampaignHub';
    };
  }, [market]);

  if (notFound) return <Navigate to="/" replace />;
  if (!market) return <div className="landing-visitors min-h-screen" />;

  const Override = MARKET_OVERRIDES[market.code];

  return (
    <MarketProvider value={market}>
      {Override ? <Override market={market} /> : <Landing />}
    </MarketProvider>
  );
};

export default MarketPage;
