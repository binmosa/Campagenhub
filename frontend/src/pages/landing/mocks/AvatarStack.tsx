import React from 'react';

/**
 * AvatarStack — overlapping circles used to convey "X creators / users
 * online" without listing them. Uses brand-tinted backgrounds drawn from
 * the OKLCH brand gradient so they pick up the active palette.
 */
interface Props {
  count?: number;
  size?: number;
  className?: string;
}

const FALLBACK_INITIALS = ['LM', 'AK', 'JS', 'OS', 'RP', 'TM'];

// Mix accent + accent-2 + neutrals so the stack feels lively without
// requiring real profile images.
const TINTS = [
  'bg-accent text-accent-foreground',
  'bg-accent-soft text-accent-soft-foreground',
  'bg-warning-soft text-warning-soft-foreground',
  'bg-success-soft text-success-soft-foreground',
  'bg-surface-tertiary text-foreground',
];

export const AvatarStack: React.FC<Props> = ({ count = 4, size = 32, className = '' }) => {
  const items = Array.from({ length: Math.min(count, 6) }, (_, i) => ({
    initials: FALLBACK_INITIALS[i % FALLBACK_INITIALS.length],
    tint: TINTS[i % TINTS.length],
  }));

  return (
    <div
      className={`flex items-center ${className}`}
      style={{ marginRight: `${size / 6}px` }}
    >
      {items.map((a, i) => (
        <div
          key={i}
          className={`rounded-full flex items-center justify-center font-semibold ring-2 ring-surface ${a.tint}`}
          style={{
            width: size,
            height: size,
            fontSize: size * 0.36,
            marginLeft: i === 0 ? 0 : -size / 3,
            zIndex: items.length - i,
          }}
        >
          {a.initials}
        </div>
      ))}
    </div>
  );
};

export default AvatarStack;
