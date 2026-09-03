import React from 'react';

/**
 * BrandLogo — the real Campgains Hub mark (`/public/logo.png`) + wordmark.
 *
 * One component for every surface (portal sidebar, loading screen, auth
 * screens, legacy shells) so the brand never drifts: the same PNG the
 * public site's nav and footer use, and the same medium-weight wordmark
 * with "Hub" in creator teal. No bold, no custom SVG.
 *
 * Sizes:
 *   sm  → 24px mark   (icon-only rail / mobile menu)
 *   md  → 32px mark   (default — sidebar header)
 *   lg  → 40px mark   (auth screens, large headers)
 */
type LogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  size?: LogoSize;
  showWordmark?: boolean;
  /** Wordmark colour — defaults to ink; pass 'light' on dark/gradient grounds. */
  tone?: 'ink' | 'light';
  className?: string;
}

const SIZE_MAP: Record<LogoSize, { mark: number; font: number; gap: string }> = {
  sm: { mark: 24, font: 13.5, gap: 'gap-2' },
  md: { mark: 32, font: 15, gap: 'gap-2.5' },
  lg: { mark: 40, font: 18, gap: 'gap-3' },
};

export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <img
    src="/logo.png"
    alt=""
    width={size}
    height={size}
    className={`object-contain shrink-0 select-none ${className}`}
    style={{ width: size, height: size, filter: 'drop-shadow(0 1px 4px rgba(108,99,255,0.30))' }}
    draggable={false}
  />
);

export const Wordmark: React.FC<{ font?: number; tone?: 'ink' | 'light'; className?: string }> = ({ font = 15, tone = 'ink', className = '' }) => (
  <span
    className={`font-medium tracking-tight whitespace-nowrap leading-none ${className}`}
    style={{ fontSize: font, letterSpacing: '-0.018em', color: tone === 'light' ? '#fff' : 'var(--color-deep-navy, #0b1736)' }}
  >
    Campgains <span style={{ color: tone === 'light' ? 'var(--color-creator-teal)' : 'var(--color-creator-teal-deep, #00a89d)' }}>Hub</span>
  </span>
);

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', showWordmark = true, tone = 'ink', className = '' }) => {
  const { mark, font, gap } = SIZE_MAP[size];
  return (
    <span className={`inline-flex items-center ${gap} min-w-0 ${className}`} aria-label="Campgains Hub" role="img">
      <LogoMark size={mark} />
      {showWordmark && <Wordmark font={font} tone={tone} />}
    </span>
  );
};

export default BrandLogo;
