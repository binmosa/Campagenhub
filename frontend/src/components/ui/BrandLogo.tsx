import React from 'react';

/**
 * BrandLogo — CampaignHub mark + wordmark
 *
 * The mark is a stylized "C" with a sparkle in the negative space, set in
 * the brand gradient (accent → accent-2). Theme-aware: picks up the runtime
 * --accent / --accent-2 vars, so it reflects whichever palette the admin
 * has selected in SiteSettings.
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
  className?: string;
}

const SIZE_MAP: Record<LogoSize, { mark: number; wordmark: string; gap: string }> = {
  sm: { mark: 24, wordmark: 'text-sm',  gap: 'gap-2' },
  md: { mark: 32, wordmark: 'text-base', gap: 'gap-2.5' },
  lg: { mark: 40, wordmark: 'text-xl',  gap: 'gap-3' },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  const { mark, wordmark, gap } = SIZE_MAP[size];
  const gradientId = React.useId();

  return (
    <div className={`inline-flex items-center ${gap} ${className}`}>
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="CampaignHub"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        {/* C-shape ring with chat-bubble notch at lower right */}
        <path
          d="M24 4C12.954 4 4 12.954 4 24c0 11.045 8.954 20 20 20 4.418 0 8.5-1.432 11.804-3.86l4.79 2.187a1.2 1.2 0 0 0 1.622-1.49l-1.696-4.78A19.92 19.92 0 0 0 44 24c0-11.046-8.954-20-20-20Zm0 7.2c7.069 0 12.8 5.731 12.8 12.8S31.069 36.8 24 36.8 11.2 31.069 11.2 24 16.931 11.2 24 11.2Z"
          fill={`url(#${gradientId})`}
        />
        {/* 4-point sparkle in the negative space */}
        <path
          d="M30 16.5 L31.5 22 L37 23.5 L31.5 25 L30 30.5 L28.5 25 L23 23.5 L28.5 22 Z"
          fill="white"
        />
      </svg>

      {showWordmark && (
        <span className={`font-heading font-bold tracking-tight ${wordmark} text-foreground leading-none whitespace-nowrap`}>
          Campaign<span className="text-accent">Hub</span>
        </span>
      )}
    </div>
  );
};

export default BrandLogo;
