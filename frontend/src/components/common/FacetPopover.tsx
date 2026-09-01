import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * FacetPopover — compact toolbar filter button opening a floating panel.
 * Click-outside + Esc close it; when the facet has a selection the button
 * tints and shows the value as a badge. Shared by the talent and campaign
 * directories (styles: .v-facet-btn / .v-facet-badge / .v-facet-panel).
 */
export const FacetPopover: React.FC<{
  label: string;
  badge?: string;
  width?: number;
  children: React.ReactNode;
}> = ({ label, badge, width = 260, children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="v-facet-btn"
        data-active={badge ? true : undefined}
      >
        {label}
        {badge && <span className="v-facet-badge">{badge}</span>}
        <ChevronDown
          size={13}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 v-facet-panel" style={{ width }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default FacetPopover;
