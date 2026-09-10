/**
 * analytics — the app's only door to Google Tag Manager.
 *
 * The GTM container is loaded in index.html; everything here just pushes to
 * `window.dataLayer`, so it is safe to call whether or not the container
 * loaded (localhost skips it). Configure the tags in GTM:
 *
 *   page_view            fired on every route change (SPA) — in the GA4 Google
 *                        tag, untick "Send a page view event when this
 *                        configuration loads" and add a GA4 event tag on the
 *                        custom event `page_view` instead, or GA4 counts the
 *                        first page twice.
 *   sign_up              { method: 'email', role }
 *   login                { method: 'email', role }
 *   onboarding_complete  { role: 'creator' }
 *
 * Never push personal data (email, phone, names) — only ids, roles, paths.
 */
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export const track = (event: string, params: Record<string, unknown> = {}): void => {
  try {
    (window.dataLayer = window.dataLayer || []).push({ event, ...params });
  } catch {
    /* analytics must never break the app */
  }
};

let lastPath = '';
/** One page_view per distinct location; the router calls this on change. */
export const trackPageView = (path: string, title?: string): void => {
  if (path === lastPath) return;
  lastPath = path;
  track('page_view', { page_path: path, page_title: title || document.title, page_location: window.location.href });
};
