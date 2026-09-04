import React from 'react';
import { accentFor } from '../../pages/talent/shared';

/**
 * StoryAvatar — the story-ring avatar used on every directory card, as a
 * standalone so list rows (admin queues, dashboards) share the exact same
 * identity treatment: image when we have one, otherwise a gradient tile
 * with the initial, seeded so the same person always gets the same colour.
 */
export const StoryAvatar: React.FC<{
  src?: string | null;
  name?: string | null;
  /** Seed for the fallback colour — defaults to the name. */
  seed?: string;
  size?: number;
  className?: string;
}> = ({ src, name, seed, size = 40, className = '' }) => {
  const label = (name || '').trim() || '?';
  const accent = accentFor(seed || label);
  return (
    <span className={`v-story-ring shrink-0 ${className}`} style={{ padding: size >= 40 ? 3 : 2 }}>
      {src ? (
        <img src={src} alt="" loading="lazy" className="object-cover" style={{ width: size, height: size }} />
      ) : (
        <span
          className="inline-flex items-center justify-center font-medium text-white"
          style={{ width: size, height: size, background: accent.from, fontSize: Math.round(size * 0.4) }}
        >
          {label[0]?.toUpperCase()}
        </span>
      )}
    </span>
  );
};

export default StoryAvatar;
