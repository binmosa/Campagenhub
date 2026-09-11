import React, { useRef, useState } from 'react';
import { BadgeCheck, Check, Wand2 } from 'lucide-react';
import { Checkbox } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import PlatformIcon from '../../pages/landing/mocks/PlatformIcon';
import { PLATFORM_ICON_KEY } from '../../pages/talent/shared';
import { SOCIAL_PLATFORMS, type SocialMap, type SocialPlatformId } from '../../lib/socialLinks';

/**
 * PlatformPicker — the one way a creator tells us where they create.
 *
 * Tap a platform tile to switch it on, then type just the name after the
 * platform's prefix (instagram.com/ · tiktok.com/@ …); the profile URL is
 * built from that. "Use X for all" copies the first handle typed onto every
 * platform switched on afterwards.
 *
 * Born in onboarding, now shared: the profile editor and the dashboard's
 * "Add platforms" modal render exactly this, so a creator who linked only
 * Instagram at signup adds Facebook or X later with the same gestures.
 *
 * `value` is the saved map. Entries whose URL the creator has not touched
 * are passed through untouched, so verification state — and a legacy URL
 * that does not fit the prefix shape — survive an edit to another platform.
 */
export const PREFIX: Record<SocialPlatformId, { host: string; path: string }> = {
  instagram: { host: 'instagram.com/', path: '' },
  tiktok: { host: 'tiktok.com/', path: '@' },
  youtube: { host: 'youtube.com/', path: '@' },
  twitter: { host: 'x.com/', path: '' },
  facebook: { host: 'facebook.com/', path: '' },
  linkedin: { host: 'linkedin.com/', path: 'in/' },
  twitch: { host: 'twitch.tv/', path: '' },
};

export const buildUrl = (id: SocialPlatformId, name: string): string => {
  const n = name.trim().replace(/^@+/, '').replace(/\s+/g, '');
  return n ? `https://${PREFIX[id].host}${PREFIX[id].path}${n}` : '';
};

/** Reverse of buildUrl for prefilling — a stored URL becomes just the name. */
export const nameFromUrl = (id: SocialPlatformId, url: string): string => {
  const path = url.replace(/^https?:\/\/(www\.|m\.)?[^/]+\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const p = PREFIX[id].path;
  return (p && path.startsWith(p) ? path.slice(p.length) : path).replace(/^@+/, '');
};

type Names = Partial<Record<SocialPlatformId, string>>;

const cleanName = (raw: string) => raw.replace(/^@+/, '').replace(/\s+/g, '');

export const PlatformPicker: React.FC<{
  value: SocialMap;
  onChange: (next: SocialMap) => void;
  /** Prefix for data-testid hooks — onboarding keeps `onb`, so its tests still find it. */
  testIdPrefix?: string;
}> = ({ value, onChange, testIdPrefix = 'onb' }) => {
  const { t } = useTranslation();

  // Seeded once from the saved map. `active` keeps activation order so
  // "the first handle typed" is well defined.
  const [active, setActive] = useState<SocialPlatformId[]>(() =>
    SOCIAL_PLATFORMS.filter((p) => value[p.id]?.url).map((p) => p.id),
  );
  const [names, setNames] = useState<Names>(() => {
    const nm: Names = {};
    for (const p of SOCIAL_PLATFORMS) if (value[p.id]?.url) nm[p.id] = nameFromUrl(p.id, value[p.id]!.url);
    return nm;
  });
  const [sameForAll, setSameForAll] = useState(false);
  // What each saved URL looked like as a name — while the creator leaves it
  // alone, the saved URL is kept verbatim rather than rebuilt.
  const original = useRef<Names>({ ...names });
  const latestValue = useRef(value);
  latestValue.current = value;

  const toMap = (nextActive: SocialPlatformId[], nextNames: Names): SocialMap => {
    const saved = latestValue.current;
    const next: SocialMap = {};
    for (const p of SOCIAL_PLATFORMS) {
      if (!nextActive.includes(p.id)) continue;
      const name = (nextNames[p.id] || '').trim();
      const prev = saved[p.id];
      const url = prev?.url && name === (original.current[p.id] || '') ? prev.url : buildUrl(p.id, name);
      if (!url) continue;
      next[p.id] = prev && prev.url === url ? prev : { url, status: 'unverified' };
    }
    return next;
  };

  const commit = (nextActive: SocialPlatformId[], nextNames: Names) => {
    setActive(nextActive);
    setNames(nextNames);
    onChange(toMap(nextActive, nextNames));
  };

  /** The first social handle the creator typed, in the order they switched platforms on. */
  const firstHandle = active.map((id) => (names[id] || '').trim()).find(Boolean) || '';

  const togglePlatform = (id: SocialPlatformId) => {
    if (active.includes(id)) return commit(active.filter((x) => x !== id), names);
    // Switching a platform on with "use X for all" ticked prefills it.
    const nextNames = sameForAll && firstHandle && !(names[id] || '').trim() ? { ...names, [id]: firstHandle } : names;
    commit([...active, id], nextNames);
  };

  const setName = (id: SocialPlatformId, raw: string) => commit(active, { ...names, [id]: cleanName(raw) });

  const toggleSameForAll = (on: boolean) => {
    setSameForAll(on);
    if (!on || !firstHandle) return;
    const next = { ...names };
    for (const id of active) if (!(next[id] || '').trim()) next[id] = firstHandle;
    commit(active, next);
  };

  return (
    <div>
      {/* platform tiles — tap to switch a platform on */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-3" role="group" aria-label={t('onb.platformsQ')}>
        {SOCIAL_PLATFORMS.map((p) => {
          const on = active.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlatform(p.id)}
              className="v-niche-chip !flex-col !gap-1.5 !px-2 !py-3 justify-center"
              data-active={on || undefined}
              aria-pressed={on}
              data-testid={`${testIdPrefix}-platform-${p.id}`}
              title={p.label}
            >
              <span className="inline-flex" style={{ color: on ? '#fff' : p.color }}>
                <PlatformIcon platform={PLATFORM_ICON_KEY[p.id]} size={18} />
              </span>
              <span className="truncate w-full text-center" style={{ fontSize: 11 }}>
                {p.label.replace(' / Twitter', '')}
              </span>
            </button>
          );
        })}
      </div>

      {active.length > 0 && (
        <div className="space-y-2.5" data-testid={`${testIdPrefix}-handles`}>
          {firstHandle && (
            <label
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer"
              style={{ background: 'var(--color-soft-lavender)' }}
              data-testid={`${testIdPrefix}-same-handle`}
            >
              <Checkbox isSelected={sameForAll} onChange={(v) => toggleSameForAll(!!v)} aria-label={t('onb.sameHandle', { u: firstHandle })}>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
              </Checkbox>
              <span className="min-w-0">
                <span className="v-ink font-medium block" style={{ fontSize: 13 }}>
                  <Wand2 size={12} className="inline mr-1 -mt-0.5" /> {t('onb.sameHandle', { u: firstHandle })}
                </span>
                <span className="v-caption v-muted block" style={{ fontSize: 11.5 }}>
                  {t('onb.sameHandleHint')}
                </span>
              </span>
            </label>
          )}
          {SOCIAL_PLATFORMS.filter((p) => active.includes(p.id)).map((p) => {
            const name = names[p.id] || '';
            const saved = value[p.id];
            const url = saved?.url && name === (original.current[p.id] || '') ? saved.url : buildUrl(p.id, name);
            const verified = saved?.status === 'verified' && saved.url === url;
            const prefix = `${PREFIX[p.id].host}${PREFIX[p.id].path}`;
            return (
              <div
                key={p.id}
                className="rounded-xl p-2.5 v-hairline flex items-center gap-2.5"
                style={{ background: name ? 'rgba(244,242,255,0.45)' : 'var(--color-paper)' }}
              >
                <span className="v-social-tile shrink-0" style={{ color: p.color }}>
                  <PlatformIcon platform={PLATFORM_ICON_KEY[p.id]} size={14} />
                </span>
                <div className="flex-1 min-w-0 flex items-stretch rounded-lg overflow-hidden v-hairline" style={{ background: '#fff' }}>
                  <span
                    className="inline-flex items-center px-2.5 v-quiet whitespace-nowrap select-none"
                    style={{ fontSize: 12.5, background: 'var(--color-paper)', borderRight: '1px solid var(--color-cool-gray)' }}
                  >
                    {prefix}
                  </span>
                  <input
                    className="flex-1 min-w-0 px-2.5 py-2 text-sm bg-transparent outline-none v-ink"
                    value={name}
                    onChange={(e) => setName(p.id, e.target.value)}
                    placeholder={t('onb.handleOnly')}
                    autoCapitalize="none"
                    aria-label={p.label}
                    data-testid={`${testIdPrefix}-handle-${p.id}`}
                  />
                </div>
                {verified ? <BadgeCheck size={16} style={{ color: 'var(--color-signal-green)' }} /> : name ? <Check size={16} className="v-quiet" /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlatformPicker;
