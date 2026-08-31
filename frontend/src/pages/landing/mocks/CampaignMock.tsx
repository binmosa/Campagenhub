import React from 'react';
import { Sparkles, Heart } from 'lucide-react';
import PlatformIcon, { type PlatformKey } from './PlatformIcon';

/**
 * CampaignMock — illustrative campaign card used in the hero bento and
 * feature sections. Pure UI mockup, no live data.
 *
 * Looks like a "campaign post" — gradient hero strip, platform badge,
 * brand name, title, budget, applicants line. Designed to feel like a
 * social/marketplace listing rather than a corporate report.
 */
interface Props {
  brand?: string;
  title?: string;
  budget?: string;
  applicants?: number;
  platform?: PlatformKey;
  className?: string;
}

export const CampaignMock: React.FC<Props> = ({
  brand = 'Glow Athletic',
  title = 'Summer fitness challenge',
  budget = '$5,000',
  applicants = 47,
  platform = 'tiktok',
  className = '',
}) => (
  <div
    className={`relative rounded-2xl border border-border bg-surface shadow-overlay overflow-hidden w-full max-w-[280px] ${className}`}
  >
    {/* Hero strip — brand gradient */}
    <div className="h-20 bg-gradient-brand relative">
      <div className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface/90 backdrop-blur-sm text-[10px] font-semibold text-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Live
      </div>
      <div className="absolute -bottom-5 left-4 w-12 h-12 rounded-xl bg-surface ring-2 ring-surface flex items-center justify-center shadow-surface">
        <Sparkles size={20} className="text-accent" />
      </div>
    </div>

    <div className="pt-7 px-4 pb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold text-muted">{brand}</div>
        <div className="inline-flex items-center gap-1 text-muted">
          <PlatformIcon platform={platform} size={14} />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
        {title}
      </h3>

      <div className="mt-3 pt-3 border-t border-separator flex items-center justify-between">
        <div className="text-sm font-heading font-bold tabular-nums text-gradient-brand">
          {budget}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <Heart size={11} className="text-accent" />
          <span className="font-semibold tabular-nums">{applicants}</span>
          <span>applied</span>
        </div>
      </div>
    </div>
  </div>
);

export default CampaignMock;
