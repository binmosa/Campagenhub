import { createContext, useContext } from 'react';

/**
 * MarketContext — which country page the visitor is on (null = global /).
 *
 * The SAME landing page renders for every market; sections read this
 * context to add market flavor (hero pill, local creators strip, payment
 * badges) without forking the design.
 */

export type Market = {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currency_symbol: string;
  default_language: string;
  languages: string[];
  payment_providers: string[];
  status: 'live' | 'coming_soon';
};

const MarketContext = createContext<Market | null>(null);

export const MarketProvider = MarketContext.Provider;

/** The current market, or null on the global landing page. */
export const useMarket = (): Market | null => useContext(MarketContext);

export default MarketContext;
