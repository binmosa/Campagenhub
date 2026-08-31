import React from 'react';
import { Chip } from '@heroui/react';
import type { LandingSettings } from '../useLandingData';

/**
 * TrustedBy — pure-CSS marquee of HeroUI Chips.
 *
 * We tried HeroUI Pro Carousel for this twice and lost both cascade
 * fights against `.carousel__item { flex: 0 0 100% }`. Going back to
 * the simplest thing that works: a single flex row, duplicated 2×,
 * shifted -50% over a fixed duration via a CSS keyframe.
 *
 * Each logo is a HeroUI <Chip> in the secondary variant, so the brand
 * tokens (radius, padding, focus ring) come from the design system,
 * while the motion is owned by us (CSS only, no embla, no react-aria).
 */
interface TrustedByProps {
  settings: LandingSettings;
}

const DEFAULT_BRANDS = [
  'Spotify',
  'LVMH',
  'Epic Games',
  'Adidas',
  'Red Bull',
  'Gymshark',
  'Nike',
  'Samsung',
  'Sephora',
  'Disney+',
  'Glossier',
  'Notion',
];

export const TrustedBy: React.FC<TrustedByProps> = ({ settings }) => {
  if (settings.ticker_enabled === 'false') return null;

  const tickerRaw = settings.ticker_text?.trim();
  // Admin enters logos as comma-separated text in Site Control; we also tolerate
  // `·`, `•`, `|` separators for backwards compatibility with older settings.
  const brands = tickerRaw
    ? tickerRaw.split(/[,·•|]/).map((s) => s.trim()).filter(Boolean)
    : DEFAULT_BRANDS;

  /* Repeat the row twice so the -50% translate produces a seamless loop. */
  const doubled = [...brands, ...brands];

  return (
    <section aria-label="Trusted by" className="px-6 lg:px-10 pt-8 pb-20">
      <div className="max-w-[1100px] mx-auto">
        <p
          className="text-center v-caption"
          style={{
            color: 'var(--color-ash)',
            fontWeight: 400,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Trusted by teams shipping culture
        </p>

        <div className="mt-8 relative">
          {/* Edge fades */}
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-20 z-10 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, var(--color-paper) 0%, transparent 100%)',
            }}
          />
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 w-20 z-10 pointer-events-none"
            style={{
              background:
                'linear-gradient(270deg, var(--color-paper) 0%, transparent 100%)',
            }}
          />

          {/* Scrolling row */}
          <div
            className="overflow-hidden"
            onMouseEnter={(e) => {
              const track = e.currentTarget.querySelector<HTMLDivElement>(
                '[data-marquee-track]'
              );
              if (track) track.style.animationPlayState = 'paused';
            }}
            onMouseLeave={(e) => {
              const track = e.currentTarget.querySelector<HTMLDivElement>(
                '[data-marquee-track]'
              );
              if (track) track.style.animationPlayState = 'running';
            }}
          >
            <div
              data-marquee-track
              className="flex items-center gap-4 w-max"
              style={{
                animation: 'v-marquee 30s linear infinite',
                willChange: 'transform',
              }}
            >
              {doubled.map((b, i) => (
                <Chip
                  key={`${b}-${i}`}
                  variant="secondary"
                  size="lg"
                  className="!rounded-full select-none whitespace-nowrap"
                >
                  <span
                    style={{
                      color: 'var(--color-ash)',
                      fontSize: 16,
                      fontWeight: 500,
                      letterSpacing: '-0.012em',
                      padding: '0 8px',
                    }}
                  >
                    {b}
                  </span>
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustedBy;
