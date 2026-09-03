import React from 'react';
import { ExternalLink, FileText, Globe, Image as ImageIcon, ScrollText, Users, Video } from 'lucide-react';
import { Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { isOpenTargeting, parseMediaLinks, parseTargeting, type MediaLink, type Targeting } from '../../lib/catalog';

/**
 * BriefDetails — the structured parts of a campaign that creators (and
 * the brand reviewing applicants) need beyond the title and budget:
 * audience targeting chips, reference media links, and the script.
 *
 * Accepts a raw campaign object (hydrated from the API or with JSON
 * strings from older rows) and renders nothing for an empty brief.
 */
const MEDIA_ICON: Record<MediaLink['type'], React.ReactNode> = {
  video: <Video size={12} />,
  image: <ImageIcon size={12} />,
  article: <FileText size={12} />,
};

export const targetingChips = (tg: Targeting, t: (k: string, o?: any) => string): string[] => {
  const chips: string[] = [];
  if (tg.gender !== 'all') chips.push(t(`wizard.genders.${tg.gender}`));
  if (tg.age_groups.length) chips.push(tg.age_groups.join(', '));
  if (tg.countries.length) {
    const cities = tg.cities.map((c) => c.city);
    chips.push(...tg.countries.map((c) => c.name));
    if (cities.length) chips.push(cities.join(', '));
  }
  return chips;
};

export const BriefDetails: React.FC<{ campaign: any; compact?: boolean; className?: string }> = ({ campaign, compact = false, className = '' }) => {
  const { t } = useTranslation();
  const tg = parseTargeting(campaign?.targeting);
  const media = parseMediaLinks(campaign?.media_links);
  const script: string = campaign?.script || '';
  const open = isOpenTargeting(tg);
  if (open && media.length === 0 && !script.trim()) return null;

  const chips = targetingChips(tg, t);

  return (
    <div className={`space-y-4 ${className}`}>
      {!open && (
        <div>
          <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-1.5 inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}>
            <Users size={11} /> {t('board.targeting')}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {chips.map((c, i) => (
              <Chip key={`${c}-${i}`} size="sm" variant="soft" color={i === 0 && tg.gender !== 'all' ? 'accent' : 'default'}>
                {tg.countries.some((x) => x.name === c) && <Globe size={10} />}
                <Chip.Label>{c}</Chip.Label>
              </Chip>
            ))}
          </div>
        </div>
      )}

      {media.length > 0 && (
        <div>
          <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-1.5 inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}>
            <ImageIcon size={11} /> {t('board.media')}
          </div>
          <ul className={compact ? 'flex flex-wrap gap-1.5' : 'space-y-1.5'}>
            {media.map((m, i) => (
              <li key={`${m.url}-${i}`}>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="v-social-chip !h-auto py-1 max-w-full"
                  style={{ color: 'var(--color-deep-navy)' }}
                  title={m.url}
                >
                  <span style={{ color: 'var(--color-campaign-purple)' }}>{MEDIA_ICON[m.type]}</span>
                  <span className="v-caption truncate" style={{ fontSize: 11.5, maxWidth: compact ? 160 : 360 }}>
                    {m.label || m.url.replace(/^https?:\/\//, '')}
                  </span>
                  <ExternalLink size={10} className="v-quiet shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {script.trim() && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="v-caption v-quiet font-medium uppercase tracking-wider inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}>
              <ScrollText size={11} /> {t('board.script')}
            </span>
            <Chip size="sm" variant="soft" color={campaign?.script_required ? 'warning' : 'default'}>
              <Chip.Label>{campaign?.script_required ? t('board.scriptRequired') : t('board.scriptOptional')}</Chip.Label>
            </Chip>
          </div>
          <div
            className="rounded-xl p-3.5 v-body v-ink whitespace-pre-wrap"
            style={{
              background: campaign?.script_required ? 'rgba(255,181,71,0.10)' : 'rgba(244,242,255,0.5)',
              border: `1px solid ${campaign?.script_required ? 'rgba(255,181,71,0.35)' : 'var(--color-cool-gray)'}`,
              fontSize: 13,
              lineHeight: 1.6,
              maxHeight: compact ? 160 : 320,
              overflow: 'auto',
            }}
          >
            {script}
          </div>
        </div>
      )}
    </div>
  );
};

export default BriefDetails;
