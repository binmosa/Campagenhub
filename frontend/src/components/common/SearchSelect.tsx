import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * SearchSelect — a searchable dropdown for picking exactly one option.
 *
 * Type to filter, click to select; no free text ever leaves the control.
 * Used for country/state/city everywhere (registration, profile, talent
 * filters) so location data stays clean.
 */

export type SearchSelectOption = {
  value: string;
  label: string;
  /** Right-aligned hint, e.g. a count ("3 creators"). */
  hint?: string;
};

export const SearchSelect: React.FC<{
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  allowClear?: boolean;
  'aria-label'?: string;
}> = ({ options, value, onChange, placeholder = 'Select…', disabled, loading, allowClear = true, ...aria }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return list.slice(0, 200); // huge lists stay responsive; typing narrows
  }, [options, query]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={ref}>
      <div
        className={`flex items-center gap-1.5 w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
          disabled
            ? 'bg-surface-secondary border-border text-muted cursor-not-allowed'
            : 'bg-surface border-border cursor-pointer hover:border-accent/40'
        }`}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) {
                e.preventDefault();
                pick(filtered[0].value);
              }
            }}
            placeholder={selected?.label || placeholder}
            className="flex-1 min-w-0 bg-transparent outline-none text-foreground placeholder:text-muted"
            aria-label={aria['aria-label'] || placeholder}
          />
        ) : (
          <span className={`flex-1 min-w-0 truncate ${selected ? 'text-foreground' : 'text-muted'}`}>
            {loading ? t('common.loading') : selected?.label || placeholder}
          </span>
        )}
        {allowClear && selected && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            className="text-muted hover:text-foreground shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setQuery('');
            }}
          >
            <X size={13} />
          </button>
        )}
        <ChevronDown
          size={14}
          className="text-muted shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
        />
      </div>

      {open && !disabled && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1.5 rounded-xl border bg-surface overflow-y-auto"
          style={{
            borderColor: 'var(--border)',
            maxHeight: 260,
            boxShadow: 'rgba(11,23,54,0.06) 0 4px 10px, rgba(11,23,54,0.14) 0 18px 40px -14px',
          }}
          role="listbox"
        >
          {loading ? (
            <div className="px-3 py-2.5 text-muted text-sm">{t('common.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-muted text-sm">{t('common.noMatches')}</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => pick(o.value)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  o.value === value
                    ? 'bg-accent-soft text-foreground font-medium'
                    : 'text-foreground hover:bg-surface-secondary'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="text-muted text-xs shrink-0 tabular-nums">{o.hint}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchSelect;
