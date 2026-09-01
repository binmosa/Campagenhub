/**
 * Markets — the single source of truth for where CampaignHub operates.
 *
 * Launching a new country = add a row here (+ translations if it brings a
 * new language). Everything downstream is data-driven: the /:market landing
 * pages, currency options, payment badges, and language defaults.
 */

export type MarketStatus = 'live' | 'coming_soon';

export interface Market {
  /** URL slug + ISO-3166-1 alpha-2, lowercase — campaignshub.com/{code} */
  code: string;
  name: string;
  flag: string;
  currency: string;
  currency_symbol: string;
  /** BCP-47 code of the market's default UI language */
  default_language: string;
  /** Languages commonly used in this market (UI offers these first) */
  languages: string[];
  /** Payment rails available in this market (display + validation) */
  payment_providers: string[];
  status: MarketStatus;
}

export const MARKETS: Market[] = [
  {
    code: 'et',
    name: 'Ethiopia',
    flag: '🇪🇹',
    currency: 'ETB',
    currency_symbol: 'Br',
    default_language: 'am',
    languages: ['am', 'en'],
    payment_providers: ['telebirr', 'paypal'],
    status: 'live',
  },
  {
    code: 'ng',
    name: 'Nigeria',
    flag: '🇳🇬',
    currency: 'NGN',
    currency_symbol: '₦',
    default_language: 'en',
    languages: ['en'],
    payment_providers: ['flutterwave', 'paypal'],
    status: 'coming_soon',
  },
  {
    code: 'ke',
    name: 'Kenya',
    flag: '🇰🇪',
    currency: 'KES',
    currency_symbol: 'KSh',
    default_language: 'en',
    languages: ['en', 'sw'],
    payment_providers: ['flutterwave', 'paypal'],
    status: 'coming_soon',
  },
  {
    code: 'gh',
    name: 'Ghana',
    flag: '🇬🇭',
    currency: 'GHS',
    currency_symbol: '₵',
    default_language: 'en',
    languages: ['en'],
    payment_providers: ['flutterwave', 'paypal'],
    status: 'coming_soon',
  },
  {
    code: 'sn',
    name: 'Senegal',
    flag: '🇸🇳',
    currency: 'XOF',
    currency_symbol: 'CFA',
    default_language: 'fr',
    languages: ['fr'],
    payment_providers: ['paypal'],
    status: 'coming_soon',
  },
];

export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  MARKETS.map((m) => [m.currency, m.currency_symbol]),
);
CURRENCY_SYMBOLS.USD = '$';
CURRENCY_SYMBOLS.EUR = '€';
CURRENCY_SYMBOLS.GBP = '£';
