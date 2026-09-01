import { useEffect } from 'react';

/**
 * useNoIndex — mark a route as excluded from search indexing.
 *
 * Auth and other transactional pages have no SEO value; keeping them out
 * of the index avoids duplicate/thin-content noise. Google renders SPA
 * JavaScript, so a runtime-injected robots meta is honored.
 */
export const useNoIndex = () => {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);
};
