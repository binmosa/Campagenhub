import type { ComponentType } from 'react';
import type { Market } from './MarketContext';

/**
 * Market page overrides.
 *
 * By default every market URL (/et, /ng, …) renders THE shared landing
 * page, localized and market-flavored via MarketContext. If a specific
 * country ever needs a fully custom page (a local launch event, a
 * regulator-mandated layout, a partnership co-brand), register a
 * component here and that market renders it instead:
 *
 *   import EthiopiaLaunch from './custom/EthiopiaLaunch';
 *   export const MARKET_OVERRIDES = { et: EthiopiaLaunch };
 */
export const MARKET_OVERRIDES: Record<string, ComponentType<{ market: Market }>> = {};
