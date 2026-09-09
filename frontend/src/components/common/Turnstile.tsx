import React, { useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile widget.
 *
 * Renders nothing unless VITE_TURNSTILE_SITE_KEY is set, so local
 * development and the test suite run without a Cloudflare account — the
 * server guard is inert in exactly the same case, so the two stay in step.
 *
 * Most visitors never see a puzzle: Turnstile decides from browser signals
 * and only escalates when something looks off. It is also far lighter than
 * reCAPTCHA, which matters on the mobile connections most of our creators
 * are on.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** True when a challenge is configured, so forms know whether to require a token. */
export const turnstileEnabled = !!SITE_KEY;

let scriptPromise: Promise<void> | null = null;

const loadScript = (): Promise<void> => {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile failed to load'));
    document.head.appendChild(script);
  });
  return scriptPromise;
};

export const Turnstile: React.FC<{
  /** Called with the token to submit, or '' when it expires and must be redone. */
  onToken: (token: string) => void;
  className?: string;
}> = ({ onToken, className = '' }) => {
  const holder = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [challengeError, setChallengeError] = useState(false);
  // The callback changes identity on every render; the widget is created once.
  const latest = useRef(onToken);
  latest.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(holder.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => {
            setChallengeError(false);
            latest.current(token);
          },
          'expired-callback': () => latest.current(''),
          // Fires when the challenge itself is refused — most often because
          // this hostname is not on the widget's allowed list in Cloudflare.
          // Silence here would leave the submit button disabled with nothing
          // on screen explaining why.
          'error-callback': () => {
            setChallengeError(true);
            latest.current('');
          },
          theme: 'light',
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* already gone */
        }
      }
    };
  }, []);

  if (!SITE_KEY) return null;

  // If Cloudflare is unreachable the server lets the request through rather
  // than locking people out, so the form must not block here either.
  if (failed) {
    return (
      <p className={`v-caption v-quiet ${className}`} style={{ fontSize: 12 }}>
        The verification widget could not load. You can still continue.
      </p>
    );
  }

  return (
    <div className={className}>
      <div ref={holder} />
      {challengeError && (
        <p className="v-caption mt-1.5" style={{ fontSize: 12, color: 'var(--color-signal-red, #d33)' }}>
          Verification could not run on this page. Reload and try again — if it keeps happening, this
          site's address may be missing from the challenge settings.
        </p>
      )}
    </div>
  );
};

export default Turnstile;
