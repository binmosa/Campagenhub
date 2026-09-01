import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Check,
  Clock,
  Eye,
  Languages,
  Lock,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import {
  brandInitials,
  brandName,
  deadlineLabel,
  formatBudget,
  postedLabel,
} from '../../lib/campaignFormat';
import PlatformIcon, { type PlatformKey as GlyphKey } from '../../pages/landing/mocks/PlatformIcon';
import { accentFor } from '../../pages/talent/shared';

/**
 * CampaignCard — THE campaign card, shared by the /campaigns marketplace
 * and the landing "Live on the platform today" section so they can never
 * drift apart. Story-ring brand identity, multi-platform glyph cluster,
 * deadline/applicants signals, budget as the headline number.
 */

export type PlatformId =
  | 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'twitch' | 'linkedin' | 'other';

export const PLATFORM_META: { id: PlatformId; label: string; glyph?: GlyphKey; color: string }[] = [
  { id: 'tiktok', label: 'TikTok', glyph: 'tiktok', color: '#0b1736' },
  { id: 'instagram', label: 'Instagram', glyph: 'instagram', color: '#E1306C' },
  { id: 'youtube', label: 'YouTube', glyph: 'youtube', color: '#FF0000' },
  { id: 'twitter', label: 'X / Twitter', glyph: 'x', color: '#0b1736' },
  { id: 'twitch', label: 'Twitch', glyph: 'twitch', color: '#9146FF' },
  { id: 'linkedin', label: 'LinkedIn', glyph: 'linkedin', color: '#0A66C2' },
  { id: 'other', label: 'Other', color: '#6c63ff' },
];

export const normalizePlatform = (p?: string): PlatformId => {
  if (!p) return 'other';
  const k = p.toLowerCase().trim();
  if (k === 'x' || k.includes('twitter')) return 'twitter';
  for (const m of PLATFORM_META) {
    if (m.id !== 'other' && k.includes(m.id)) return m.id;
  }
  return 'other';
};

/** A campaign can target several platforms — `platform` holds a
 *  comma-separated list ("TikTok, Instagram"). */
export const parsePlatforms = (p?: string): PlatformId[] => {
  const ids = (p || '')
    .split(/[,/|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizePlatform)
    .filter((id) => id !== 'other');
  const unique = [...new Set(ids)];
  return unique.length ? unique : ['other'];
};

const STAGGER = 18;

export const CampaignCard = React.memo<{
  camp: any;
  index: number;
  applied: boolean;
  loggedIn: boolean;
  isCreator: boolean;
  onApply: (camp: any) => void;
  /** When absent, the contract peek link is hidden (e.g. on the landing). */
  onViewContract?: (contract: string) => void;
}>(({ camp, index, applied, loggedIn, isCreator, onApply, onViewContract }) => {
  const { t } = useTranslation();
  /* UGC translation: show the machine translation by default with a
     "see original" toggle — the original is always one tap away. */
  const hasTranslation = !!(camp.title_translated || camp.description_translated);
  const [showOriginal, setShowOriginal] = useState(false);
  const title = !showOriginal && camp.title_translated ? camp.title_translated : camp.title;
  const description =
    !showOriginal && camp.description_translated
      ? camp.description_translated
      : camp.description;
  /* Canonical USD hint next to non-USD budgets (locked at post time). */
  const usdApprox =
    camp.currency && camp.currency !== 'USD' && camp.budget_usd
      ? formatBudget(camp.budget_usd, 'USD')
      : null;
  const name = brandName(camp);
  const verified = camp.brand?.account_status === 'active';
  const accent = accentFor(String(camp.brand?.id || name));
  const platforms = parsePlatforms(camp.platform).map(
    (id) => PLATFORM_META.find((m) => m.id === id)!,
  );
  const due = deadlineLabel(camp.deadline);
  const posted = postedLabel(camp.created_at);
  const applicants = Number(camp.applicants_count) || 0;
  const logo = camp.brand?.brandProfile?.logo_url;

  return (
    <article
      className="v-talent-card v-card-in p-4 flex flex-col"
      style={{ animationDelay: `${(index % STAGGER) * 28}ms` }}
    >
      {/* brand row — the story ring is the card's signature */}
      <div className="flex items-center gap-2.5">
        <span className="v-story-ring">
          {logo ? (
            <img src={logo} alt="" loading="lazy" className="h-8 w-8 object-cover" />
          ) : (
            <span
              className="inline-flex h-8 w-8 items-center justify-center text-[11px] font-medium text-white"
              style={{ background: accent.from }}
            >
              {brandInitials(name)}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="v-ink font-medium truncate" style={{ fontSize: 13 }}>
              {name}
            </span>
            {verified && (
              <ShieldCheck size={12} className="shrink-0" style={{ color: 'var(--color-campaign-purple)' }} />
            )}
          </div>
          {posted && (
            <div className="v-caption v-quiet" style={{ fontSize: 10.5 }}>
              {t('card.posted', { when: posted })}
            </div>
          )}
        </div>
        <div
          className="flex items-center gap-1 shrink-0"
          aria-label={`Target platforms: ${platforms.map((p) => p.label).join(', ')}`}
        >
          {platforms.length === 1 ? (
            <span
              className="v-social-chip"
              title={platforms[0].label}
              style={{ color: platforms[0].color }}
            >
              {platforms[0].glyph ? (
                <PlatformIcon platform={platforms[0].glyph} size={13} />
              ) : (
                <Briefcase size={12} />
              )}
              <span className="v-ink font-medium" style={{ fontSize: 11 }}>
                {platforms[0].label}
              </span>
            </span>
          ) : (
            <>
              {platforms.slice(0, 4).map((p) => (
                <span
                  key={p.id}
                  className="v-social-tile"
                  title={p.label}
                  style={{ color: p.color, width: 26, height: 26 }}
                >
                  {p.glyph ? <PlatformIcon platform={p.glyph} size={13} /> : <Briefcase size={12} />}
                </span>
              ))}
              {platforms.length > 4 && (
                <span
                  className="v-social-tile v-quiet"
                  style={{ fontSize: 10.5, width: 26, height: 26 }}
                  title={platforms.slice(4).map((p) => p.label).join(' · ')}
                >
                  +{platforms.length - 4}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* brief */}
      <h3
        className="mt-3 v-ink font-medium line-clamp-2"
        style={{ fontSize: 15, lineHeight: 1.3, letterSpacing: '-0.015em', minHeight: 39 }}
      >
        {title}
      </h3>
      <p className="mt-1.5 v-body v-muted line-clamp-2" style={{ fontSize: 12.5, minHeight: 38 }}>
        {description || t('card.noBrief')}
      </p>
      {hasTranslation && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowOriginal((v) => !v);
          }}
          className="mt-1 self-start v-caption v-quiet inline-flex items-center gap-1"
          style={{ fontSize: 10.5 }}
        >
          <Languages size={10} />
          {showOriginal ? t('card.seeTranslation') : `${t('card.translated')} · ${t('card.seeOriginal')}`}
        </button>
      )}

      {/* signals */}
      <div className="mt-2.5 flex items-center gap-3 flex-wrap v-caption v-quiet" style={{ fontSize: 11 }}>
        {due && (
          <span className="inline-flex items-center gap-1" style={{ color: '#b45309' }}>
            <Clock size={10.5} /> {due}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users size={10.5} /> {applicants === 0 ? t('card.beFirst') : t('card.applied', { n: applicants })}
        </span>
        {camp.contract_template && onViewContract && (
          <button
            type="button"
            onClick={() => onViewContract(camp.contract_template)}
            className="inline-flex items-center gap-1 hover:underline"
            style={{ color: 'var(--color-campaign-purple)' }}
          >
            <Eye size={10.5} /> {t('card.contract')}
          </button>
        )}
      </div>

      {/* footer: the money + the action — pinned to the card bottom */}
      <div className="flex-1" style={{ minHeight: 12 }} aria-hidden />
      <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
        <div className="inline-flex items-baseline gap-1.5 min-w-0">
          <span
            className="font-medium tabular-nums"
            style={{ fontSize: 17, letterSpacing: '-0.018em', color: '#0b6e3e' }}
          >
            {formatBudget(camp.budget, camp.currency)}
          </span>
          <span className="v-caption v-quiet" style={{ fontSize: 11 }}>
            {usdApprox ? `≈ ${usdApprox} · ${t('card.budget')}` : t('card.budget')}
          </span>
        </div>

        {applied ? (
          <Chip color="success" variant="soft" size="sm">
            <Check size={11} />
            <Chip.Label>{t('card.appliedChip')}</Chip.Label>
          </Chip>
        ) : !loggedIn ? (
          <Link to="/login" title="Sign in to apply">
            <Button variant="ghost" size="sm" className="!px-2.5">
              <Lock size={11} /> {t('card.signIn')}
            </Button>
          </Link>
        ) : isCreator ? (
          <Button variant="primary" size="sm" onPress={() => onApply(camp)}>
            {t('card.apply')}
          </Button>
        ) : (
          <span className="v-caption v-quiet" style={{ fontSize: 11 }}>
            {t('card.creatorsOnly')}
          </span>
        )}
      </div>
    </article>
  );
});
CampaignCard.displayName = 'CampaignCard';

export default CampaignCard;
