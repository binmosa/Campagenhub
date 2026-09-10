import React, { useState } from 'react';
import { PORTRAITS, portraitSrc, type PortraitKey } from './portraits';

/**
 * Portrait — a round creator photo that degrades to initials on a tinted
 * disc when the file is missing (the set is generated incrementally).
 */
export const Portrait: React.FC<{
  id?: PortraitKey;
  initials: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ id, initials, size = 36, color = '#6c63ff', className = '', style }) => {
  const [broken, setBroken] = useState(false);
  const showImg = !!id && !broken;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 font-medium ${className}`}
      style={{ width: size, height: size, background: showImg ? 'var(--color-cool-gray)' : color, color: '#fff', fontSize: Math.max(10, Math.round(size * 0.3)), ...style }}
      aria-hidden={!id}
    >
      {showImg ? (
        <img src={portraitSrc(id!)} alt={PORTRAITS[id!].alt} width={size} height={size} loading="lazy" decoding="async" className="w-full h-full object-cover" onError={() => setBroken(true)} />
      ) : (
        initials
      )}
    </span>
  );
};

export default Portrait;
