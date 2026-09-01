/**
 * Vercel Edge Middleware — market auto-routing at the CDN.
 *
 * Runs only on `/` (see `config.matcher`). Redirects first-time visitors
 * from a live-market country to /{market} using the country Vercel stamps
 * on every request (x-vercel-ip-country) — no geo API call, no JS needed.
 *
 * Policy (kept in sync with src/components/common/GeoGate.tsx, which
 * applies the same rules client-side for dev and non-Vercel hosts):
 *  - bots always get the global English site (SEO: no IP cloaking);
 *  - same-origin referer = the user navigated here on purpose → no redirect;
 *  - `?global=1` pins the global site via the market_home cookie;
 *  - a stored market_home cookie routes returning visitors on fresh loads.
 */

// Live market codes — MUST mirror `status: 'live'` rows in
// backend/src/markets/markets.config.ts (the edge can't read the API cheaply).
const LIVE_MARKETS = ['et'];

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|duckduck|baidu|yandex|facebookexternalhit|whatsapp|telegrambot|linkedinbot|twitterbot/i;

const COOKIE = 'market_home';
const YEAR = 60 * 60 * 24 * 365;

const redirect = (url: URL, market: string, setCookie = false): Response => {
  const headers = new Headers({ Location: new URL(`/${market}`, url).toString() });
  if (setCookie) {
    headers.append('Set-Cookie', `${COOKIE}=${market}; Max-Age=${YEAR}; Path=/; SameSite=Lax`);
  }
  return new Response(null, { status: 307, headers });
};

export default function middleware(request: Request): Response | undefined {
  const url = new URL(request.url);

  if (BOT_RE.test(request.headers.get('user-agent') || '')) return undefined;

  // Explicit global-site choice: remember it and fall through to `/`.
  if (url.searchParams.get('global') === '1') {
    return new Response(null, {
      status: 307,
      headers: {
        Location: new URL('/', url).toString(),
        'Set-Cookie': `${COOKIE}=root; Max-Age=${YEAR}; Path=/; SameSite=Lax`,
      },
    });
  }

  // The user clicked their way here (logo, "other markets") — respect it.
  const referer = request.headers.get('referer') || '';
  if (referer.startsWith(url.origin)) return undefined;

  const cookie = request.headers.get('cookie') || '';
  const stored = cookie.match(/(?:^|;\s*)market_home=([a-z]{2}|root)/)?.[1];
  if (stored === 'root') return undefined;
  if (stored && LIVE_MARKETS.includes(stored)) return redirect(url, stored);

  const country = (request.headers.get('x-vercel-ip-country') || '').toLowerCase();
  if (LIVE_MARKETS.includes(country)) return redirect(url, country, true);

  return undefined; // global site
}

export const config = { matcher: '/' };
