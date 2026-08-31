import React from 'react';
import { BadgeCheck, Users } from 'lucide-react';
import PlatformIcon, { type PlatformKey } from './PlatformIcon';

/**
 * CreatorMock — illustrative creator profile card.
 *
 * Shows the kind of profile a brand would browse: avatar + handle, verified
 * badge, follower count, platforms, niche tags. Used in the ForBrands and
 * ForCreators sections to make the experience tangible.
 */
interface Props {
  name?: string;
  handle?: string;
  niche?: string;
  followers?: string;
  platforms?: PlatformKey[];
  verified?: boolean;
  initials?: string;
  tint?: 'accent' | 'cyan' | 'warm';
  className?: string;
}

const TINT_MAP = {
  accent: 'bg-accent text-accent-foreground',
  cyan:   'bg-success-soft text-success-soft-foreground',
  warm:   'bg-warning-soft text-warning-soft-foreground',
} as const;

export const CreatorMock: React.FC<Props> = ({
  name = 'Lina Marwan',
  handle = '@linaeats',
  niche = 'Food & Lifestyle',
  followers = '2.4M',
  platforms = ['instagram', 'tiktok'],
  verified = true,
  initials = 'LM',
  tint = 'accent',
  className = '',
}) => (
  <div
    className={`rounded-2xl border border-border bg-surface shadow-overlay p-5 w-full max-w-[280px] ${className}`}
  >
    <div className="flex items-start gap-3">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${TINT_MAP[tint]}`}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <div className="text-sm font-semibold text-foreground truncate">{name}</div>
          {verified && <BadgeCheck size={14} className="text-accent shrink-0" fill="currentColor" stroke="white" strokeWidth={2.5} />}
        </div>
        <div className="text-xs text-muted truncate">{handle} · {niche}</div>
      </div>
    </div>

    <div className="mt-4 pt-4 border-t border-separator flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Users size={13} className="text-muted" />
        <span className="text-xs font-semibold text-foreground tabular-nums">{followers}</span>
        <span className="text-xs text-muted">followers</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted">
        {platforms.map((p) => (
          <PlatformIcon key={p} platform={p} size={14} />
        ))}
      </div>
    </div>
  </div>
);

export default CreatorMock;
