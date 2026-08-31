import React from 'react';

/**
 * PlatformIcon — minimal SVG glyphs for the social platforms creators
 * publish on. Single-color (uses currentColor) so they pick up text color
 * utilities like `text-muted` / `text-accent` / `text-foreground`.
 *
 * Used in TrustedBy and elsewhere to communicate "this is for creators
 * on the platforms you already use."
 */

export type PlatformKey = 'instagram' | 'tiktok' | 'youtube' | 'x' | 'twitch' | 'linkedin' | 'facebook';

interface Props {
  platform: PlatformKey;
  size?: number;
  className?: string;
}

const ICONS: Record<PlatformKey, React.ReactNode> = {
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </>
  ),
  tiktok: (
    <path
      d="M16.5 3a4.5 4.5 0 0 0 4.5 4.5v3.2a7.6 7.6 0 0 1-4.5-1.45v6.3a6.5 6.5 0 1 1-6.5-6.5c.34 0 .67.02 1 .07v3.4a3.1 3.1 0 1 0 2.5 3.03V3h3z"
      fill="currentColor"
    />
  ),
  youtube: (
    <path
      d="M21.6 7.2c-.2-1.2-1.1-2.1-2.3-2.3C17 4.5 12 4.5 12 4.5s-5 0-7.3.4C3.5 5.1 2.6 6 2.4 7.2 2 9.5 2 12 2 12s0 2.5.4 4.8c.2 1.2 1.1 2.1 2.3 2.3 2.3.4 7.3.4 7.3.4s5 0 7.3-.4c1.2-.2 2.1-1.1 2.3-2.3.4-2.3.4-4.8.4-4.8s0-2.5-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z"
      fill="currentColor"
    />
  ),
  x: (
    <path
      d="M17.5 3h3.2l-7 8 8.2 10h-6.5l-5.1-6.5L4.5 21H1.3l7.5-8.6L1 3h6.6l4.6 6 5.3-6zm-1.2 16h1.8L7.8 5H6l10.3 14z"
      fill="currentColor"
    />
  ),
  twitch: (
    <path
      d="M4.3 2 3 5.3v13.4h4.5V21h2.6l2.3-2.3H16l4.3-4.3V2H4.3zm14.4 11.4-2.6 2.6h-4.3l-2.3 2.3v-2.3H6.5V3.7h12.2v9.7zm-3.5-6.7h1.6v4.7h-1.6V6.7zm-4.3 0h1.6v4.7h-1.6V6.7z"
      fill="currentColor"
    />
  ),
  linkedin: (
    <path
      d="M19.7 3H4.3C3.6 3 3 3.6 3 4.3v15.4c0 .7.6 1.3 1.3 1.3h15.4c.7 0 1.3-.6 1.3-1.3V4.3c0-.7-.6-1.3-1.3-1.3zM8.3 18.3h-2.7V9.7h2.7v8.6zM7 8.5a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2zm11.3 9.8h-2.7V14c0-1-.02-2.3-1.4-2.3-1.4 0-1.6 1.1-1.6 2.2v4.4H10V9.7h2.6v1.2h.04c.4-.7 1.3-1.4 2.6-1.4 2.8 0 3.3 1.8 3.3 4.2v4.6z"
      fill="currentColor"
    />
  ),
  facebook: (
    <path
      d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H5.9v-2.91h2.54V9.85c0-2.52 1.5-3.92 3.79-3.92 1.1 0 2.24.2 2.24.2v2.47H13.2c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.9h-2.33V22c4.78-.75 8.43-4.91 8.43-9.94z"
      fill="currentColor"
    />
  ),
};

export const PlatformIcon: React.FC<Props> = ({ platform, size = 22, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label={platform}
    className={className}
  >
    {ICONS[platform]}
  </svg>
);

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  twitch: 'Twitch',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
};

export default PlatformIcon;
