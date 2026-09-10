import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';

/**
 * CookieBanner — concept-level consent notice.
 *
 * Shown once per browser until the visitor answers; the answer is kept in
 * localStorage under `cookie_consent` ("accepted" | "declined") and exposed
 * through `getCookieConsent()`. It does NOT yet gate Google Tag Manager or
 * drive GA4 Consent Mode — that wiring is a follow-up once the legal
 * position on EU/UK traffic is decided. Until then this is the visible
 * half: honest wording, a link to the Privacy Policy, accept or decline.
 */
const KEY = 'cookie_consent';
export type CookieConsent = 'accepted' | 'declined' | null;

export const getCookieConsent = (): CookieConsent => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
};

export const CookieBanner: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Give the page a beat to paint before the banner slides in.
    const id = setTimeout(() => setOpen(getCookieConsent() === null), 600);
    return () => clearTimeout(id);
  }, []);

  const answer = (v: Exclude<CookieConsent, null>) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* private mode — the banner simply returns next visit */
    }
    setOpen(false);
  };

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('cookie.title')}
      className="landing-visitors fixed inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-md z-[9000] rounded-2xl p-4 sm:p-5 v-fade-in"
      style={{ background: 'var(--color-paper, #fff)', border: '1px solid var(--color-cool-gray)', boxShadow: 'rgba(11,23,54,0.18) 0 18px 40px -12px' }}
      data-testid="cookie-banner"
    >
      <div className="flex items-start gap-3">
        <span className="v-hero-icon shrink-0" style={{ width: 36, height: 36, borderRadius: 11 }}>
          <Cookie size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="v-ink font-medium" style={{ fontSize: 14 }}>
            {t('cookie.title')}
          </div>
          <p className="v-caption v-muted mt-1" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            {t('cookie.body')}{' '}
            <Link to="/legal/privacy" className="font-medium" style={{ color: 'var(--color-campaign-purple)' }}>
              {t('cookie.learnMore')}
            </Link>
          </p>
          <div className="mt-3 flex items-center gap-2 justify-end">
            <Button variant="ghost" size="sm" onPress={() => answer('declined')} data-testid="cookie-decline">
              {t('cookie.decline')}
            </Button>
            <Button variant="primary" size="sm" onPress={() => answer('accepted')} data-testid="cookie-accept">
              {t('cookie.accept')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
