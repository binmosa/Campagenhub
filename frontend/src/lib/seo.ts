import { useEffect } from 'react';

/**
 * seo — per-route <head> management for a single-page app.
 *
 * index.html carries the site-wide defaults (title, description, Open Graph
 * card). Public routes call `usePageMeta` to override them while mounted and
 * restore the defaults on unmount, so a shared link or a search result for
 * /campaigns describes campaigns, not the home page. Google renders SPA
 * JavaScript, so runtime-injected tags are honored; social scrapers mostly
 * do not, which is why the defaults in index.html must be good on their own.
 */

/** Canonical public origin — used for canonical links, og:url and the sitemap. */
export const SITE_URL = 'https://campaignhubz.com';
export const SITE_NAME = 'Campaign Hubz';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

type MetaSpec = {
  title: string;
  description: string;
  /** Route path for the canonical URL, e.g. "/campaigns". Defaults to the current path. */
  path?: string;
  image?: string;
  /** "website" (default) or "article". */
  type?: string;
  noindex?: boolean;
};

const MANAGED = 'data-managed-meta';

const upsert = (selector: string, create: () => HTMLElement, set: (el: HTMLElement) => void) => {
  let el = document.head.querySelector<HTMLElement>(selector);
  const created = !el;
  if (!el) {
    el = create();
    el.setAttribute(MANAGED, '1');
    document.head.appendChild(el);
  }
  const prev = created ? null : { content: el.getAttribute('content'), href: el.getAttribute('href') };
  set(el);
  return () => {
    if (created) el!.remove();
    else {
      if (prev?.content != null) el!.setAttribute('content', prev.content);
      if (prev?.href != null) el!.setAttribute('href', prev.href);
    }
  };
};

const meta = (attr: 'name' | 'property', key: string, content: string) =>
  upsert(
    `meta[${attr}="${key}"]`,
    () => {
      const m = document.createElement('meta');
      m.setAttribute(attr, key);
      return m;
    },
    (el) => el.setAttribute('content', content),
  );

/** Set title, description, canonical and social card for the current route. */
export const usePageMeta = (spec: MetaSpec) => {
  const { title, description, path, image, type, noindex } = spec;
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
    const url = `${SITE_URL}${path ?? window.location.pathname}`;
    const img = image || DEFAULT_OG_IMAGE;
    const prevTitle = document.title;
    document.title = fullTitle;
    const undo = [
      meta('name', 'description', description),
      meta('property', 'og:title', fullTitle),
      meta('property', 'og:description', description),
      meta('property', 'og:url', url),
      meta('property', 'og:image', img),
      meta('property', 'og:type', type || 'website'),
      meta('name', 'twitter:title', fullTitle),
      meta('name', 'twitter:description', description),
      meta('name', 'twitter:image', img),
      upsert(
        'link[rel="canonical"]',
        () => {
          const l = document.createElement('link');
          l.setAttribute('rel', 'canonical');
          return l;
        },
        (el) => el.setAttribute('href', url),
      ),
      ...(noindex ? [meta('name', 'robots', 'noindex')] : []),
    ];
    return () => {
      document.title = prevTitle;
      undo.forEach((fn) => fn());
    };
  }, [title, description, path, image, type, noindex]);
};

/**
 * useNoIndex — mark a route as excluded from search indexing.
 *
 * Auth and other transactional pages have no SEO value; keeping them out
 * of the index avoids duplicate/thin-content noise.
 */
export const useNoIndex = () => {
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex';
    document.head.appendChild(m);
    return () => {
      document.head.removeChild(m);
    };
  }, []);
};
