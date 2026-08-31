import React, { useRef } from 'react';
import { BadgeCheck } from 'lucide-react';
import PlatformIcon, { type PlatformKey } from '../mocks/PlatformIcon';
import type { LandingSettings } from '../useLandingData';

/**
 * PayoutTicker — money in motion.
 *
 * Replaces the anonymous logo marquee with the thing creators actually
 * care about: payouts settling. Same admin kill switch as the old band
 * (`ticker_enabled`). Items are illustrative, styled like settlement
 * receipts rather than claims.
 */

interface Props {
  settings: LandingSettings;
}

type Item = {
  handle: string;
  amount: string;
  brand: string;
  platform: PlatformKey;
  when: string;
};

const ITEMS: Item[] = [
  { handle: '@linaeats', amount: '$2,400', brand: 'Glow Athletic', platform: 'tiktok', when: '2m' },
  { handle: '@omarjourneys', amount: '$1,250', brand: 'Nomad Audio', platform: 'youtube', when: '14m' },
  { handle: '@studioveda', amount: '$880', brand: 'Aurora Skin', platform: 'instagram', when: '31m' },
  { handle: '@code.with.ada', amount: '$1,650', brand: 'Voltbox', platform: 'youtube', when: '1h' },
  { handle: '@sobremesa.kitchen', amount: '$540', brand: 'Mesa Coffee', platform: 'instagram', when: '1h' },
  { handle: '@thrift.theory', amount: '$720', brand: 'Loom & Fade', platform: 'tiktok', when: '2h' },
  { handle: '@hexplays', amount: '$960', brand: 'PixelForge', platform: 'twitch', when: '3h' },
  { handle: '@analog.wave', amount: '$430', brand: 'Reverb Rooms', platform: 'instagram', when: '4h' },
];

const Row: React.FC<{ ariaHidden?: boolean }> = ({ ariaHidden }) => (
  <div className="flex items-center gap-3 pr-3" aria-hidden={ariaHidden}>
    {ITEMS.map((it) => (
      <span key={it.handle} className="v-ticket">
        <span className="v-ticket-check">
          <BadgeCheck size={12} />
        </span>
        <span className="font-medium v-ink">{it.handle}</span>
        <span className="v-ticket-amount tabular-nums">{it.amount}</span>
        <span className="v-quiet inline-flex items-center gap-1">
          <PlatformIcon platform={it.platform} size={11} />
          {it.brand}
        </span>
        <span className="v-faint">· {it.when}</span>
      </span>
    ))}
  </div>
);

export const PayoutTicker: React.FC<Props> = ({ settings }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  if (settings.ticker_enabled === 'false') return null;

  const setPaused = (paused: boolean) => {
    if (trackRef.current) {
      trackRef.current.style.animationPlayState = paused ? 'paused' : 'running';
    }
  };

  return (
    <section
      className="relative py-6 border-y"
      style={{ borderColor: 'var(--color-cool-gray)', background: 'rgba(244,242,255,0.35)' }}
      aria-label="Example payouts settling on CampaignHub"
    >
      <div className="max-w-[1100px] mx-auto px-6 lg:px-10 mb-3">
        <span className="v-caption v-quiet" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          What getting paid here looks like
        </span>
      </div>

      <div
        className="relative overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* edge fades */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-16 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, #f8f7fe, transparent)' }}
        />
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-16 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(270deg, #f8f7fe, transparent)' }}
        />

        <div ref={trackRef} className="v-marquee flex w-max">
          <Row />
          <Row ariaHidden />
        </div>
      </div>
    </section>
  );
};

export default PayoutTicker;
