import React from 'react';
import { Link } from 'react-router-dom';
import { Award, BadgeCheck, Link2, Lock, MapPin, Send, Star, Users } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { formatCompact, socialEntries } from '../../lib/socialLinks';
import PlatformIcon from '../../pages/landing/mocks/PlatformIcon';
import {
  PLATFORM_ICON_KEY,
  accentFor,
  formatFollowers,
  type Talent,
} from '../../pages/talent/shared';

/**
 * TalentCard — THE creator / manager card, shared by the public /talent
 * directory and every dashboard surface that lists people (find talent,
 * applicants, team), so they can never drift apart.
 *
 * Story-ring avatar, platform rail with per-network follower counts, the
 * decision number pinned to the footer baseline.
 */
const STAGGER = 24;

export const TalentCard = React.memo<{
  talent: Talent;
  index: number;
  canInvite: boolean;
  loggedIn: boolean;
  viewerIsCreator: boolean;
  onInvite: (t: Talent) => void;
  /** Extra content between the bio and the platform rail (e.g. a pitch). */
  extra?: React.ReactNode;
  /** Replaces the default CTA cluster in the footer. */
  actions?: React.ReactNode;
  /** Small chip rendered top-right in place of the category / rating. */
  badge?: React.ReactNode;
}>(({ talent, index, canInvite, loggedIn, viewerIsCreator, onInvite, extra, actions, badge }) => {
  const { t } = useTranslation();
  const isCreator = talent._type === 'creator';
  const name =
    talent.full_name ||
    talent.username ||
    t(isCreator ? 'talent.creatorFallback' : 'talent.managerFallback');
  const initial = name[0]?.toUpperCase() || 'T';
  const accent = accentFor(String(talent.id || name));
  const links = socialEntries(talent.social_links);
  const shown = links.slice(0, 4);
  const overflow = links.length - shown.length;
  const focus = talent.category || talent.specialty;
  /** Sum of per-platform follower counts — the number brands decide on. */
  const platformTotal = links.reduce((s, l) => s + (l.followers || 0), 0);

  return (
    <article
      className="v-talent-card v-card-in p-4 flex flex-col"
      style={{ animationDelay: `${(index % STAGGER) * 28}ms` }}
    >
      {/* identity row — the story ring is the card's signature */}
      <div className="flex items-start gap-3">
        <span className="v-story-ring">
          {talent.avatar_url ? (
            <img src={talent.avatar_url} alt="" loading="lazy" className="h-11 w-11 object-cover" />
          ) : (
            <span
              className="inline-flex h-11 w-11 items-center justify-center text-base font-medium text-white"
              style={{ background: accent.from }}
            >
              {initial}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="v-ink font-medium truncate" style={{ fontSize: 15, letterSpacing: '-0.015em' }}>
            {name}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5 v-caption v-quiet" style={{ fontSize: 11.5 }}>
            {talent.username && <span className="truncate">@{talent.username}</span>}
            {talent.username && talent.location && <span aria-hidden>·</span>}
            {talent.location && (
              <span className="inline-flex items-center gap-0.5 truncate">
                <MapPin size={10} className="shrink-0" />
                {talent.location}
              </span>
            )}
          </div>
        </div>

        {badge !== undefined ? (
          badge
        ) : isCreator ? (
          focus && (
            <Chip color="accent" variant="soft" size="sm" className="shrink-0 max-w-[110px]">
              <Chip.Label className="truncate">{t(`cats.${focus}`, { defaultValue: focus })}</Chip.Label>
            </Chip>
          )
        ) : (
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
            style={{ background: 'rgba(255,181,71,0.14)', color: '#8a5a00' }}
          >
            <Star size={10} className="fill-warning text-warning" />
            {Number(talent.rating || 5).toFixed(1)}
          </span>
        )}
      </div>

      {/* bio — fixed 2-line slot so rows stay level */}
      <p className="mt-3 v-body v-muted line-clamp-2" style={{ fontSize: 12.5, minHeight: 38 }}>
        {talent.bio ||
          t(isCreator ? 'talent.bioCreator' : 'talent.bioManager', {
            focus: focus
              ? t(`cats.${focus}`, { defaultValue: focus })
              : t(isCreator ? 'talent.focusContent' : 'talent.focusCampaign'),
          })}
      </p>

      {extra}

      {/* platform rail — where they publish, and how big they are there */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap" aria-label="Platforms and follower counts">
        {shown.length > 0 ? (
          <>
            {shown.map((l) => (
              <a
                key={l.id}
                className="v-social-chip"
                href={l.url || undefined}
                target="_blank"
                rel="noreferrer"
                title={`${name} on ${l.label}${l.followers ? ` · ${formatCompact(l.followers)} followers` : ''}`}
                aria-label={`${name} on ${l.label}${l.followers ? `, ${formatCompact(l.followers)} followers` : ''}`}
              >
                <span className="inline-flex" style={{ color: l.color }}>
                  <PlatformIcon platform={PLATFORM_ICON_KEY[l.id]} size={13} />
                </span>
                {l.followers ? (
                  <span className="v-ink font-medium tabular-nums" style={{ fontSize: 11 }}>
                    {formatCompact(l.followers)}
                  </span>
                ) : null}
                {l.verified && <BadgeCheck size={11} style={{ color: 'var(--color-signal-green)' }} aria-label="Verified" />}
              </a>
            ))}
            {overflow > 0 && (
              <span
                className="v-social-tile v-quiet"
                style={{ fontSize: 10.5 }}
                title={links
                  .slice(4)
                  .map((l) => `${l.label}${l.followers ? ` ${formatCompact(l.followers)}` : ''}`)
                  .join(' · ')}
              >
                +{overflow}
              </span>
            )}
            {!isCreator && focus && (
              <span className="v-caption v-quiet ml-1 truncate" style={{ fontSize: 11 }}>
                {focus}
              </span>
            )}
          </>
        ) : (
          <span className="v-social-empty">
            <Link2 size={11} /> {t('talent.socialsNotLinked')}
          </span>
        )}
      </div>

      {/* footer: the decision number + a compact CTA — pinned to the card
          bottom so every stat line sits on the same baseline across a row */}
      <div className="flex-1" style={{ minHeight: 12 }} aria-hidden />
      <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
        <div className="inline-flex items-baseline gap-1.5 min-w-0">
          {isCreator ? (
            platformTotal > 0 ? (
              <>
                <span className="v-ink font-medium tabular-nums" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
                  {formatCompact(platformTotal)}
                </span>
                <span className="v-caption v-quiet inline-flex items-center gap-1" style={{ fontSize: 11 }}>
                  {t('talent.totalFollowers')}
                  {links.length > 0 && links.every((l) => l.verified) && (
                    <BadgeCheck size={11} style={{ color: 'var(--color-signal-green)' }} aria-label="Verified" />
                  )}
                </span>
              </>
            ) : (
              <>
                <Users size={12} className="self-center" style={{ color: 'var(--color-campaign-purple)' }} />
                <span className="v-ink font-medium tabular-nums truncate" style={{ fontSize: 13 }}>
                  {talent.follower_range || formatFollowers(talent.follower_count || 0)}
                </span>
                <span className="v-caption v-quiet" style={{ fontSize: 11 }}>
                  {t('talent.followersLbl')}
                </span>
              </>
            )
          ) : (
            <>
              <Award size={12} className="self-center" style={{ color: 'var(--color-campaign-purple)' }} />
              <span className="v-ink font-medium" style={{ fontSize: 13 }}>
                {talent.experience_years ? t('talent.years', { n: talent.experience_years }) : t('talent.yearsDefault')}
              </span>
              <span className="v-caption v-quiet" style={{ fontSize: 11 }}>
                {t('talent.experience')}
              </span>
            </>
          )}
        </div>

        {actions !== undefined ? (
          actions
        ) : !loggedIn ? (
          <Link to="/login" title={`Sign in to ${isCreator ? 'collaborate' : 'hire'}`}>
            <Button variant="ghost" size="sm" className="!px-2.5">
              <Lock size={11} /> {t('card.signIn')}
            </Button>
          </Link>
        ) : canInvite ? (
          <Button variant="primary" size="sm" onPress={() => onInvite(talent)}>
            <Send size={11} /> {t('talent.invite')}
          </Button>
        ) : viewerIsCreator ? (
          <span className="v-caption v-quiet" style={{ fontSize: 11 }}>
            {t('talent.creatorView')}
          </span>
        ) : null}
      </div>
    </article>
  );
});
TalentCard.displayName = 'TalentCard';

/* ── Skeleton ────────────────────────────────────────────────────── */
export const TalentCardSkeleton: React.FC = () => (
  <div className="v-talent-card p-4" aria-hidden>
    <div className="flex items-start gap-3">
      <div className="v-skel h-12 w-12 !rounded-full shrink-0" />
      <div className="flex-1 pt-1">
        <div className="v-skel h-4 w-1/2 mb-2" />
        <div className="v-skel h-3 w-3/4" />
      </div>
    </div>
    <div className="v-skel h-3 w-full mt-4 mb-1.5" />
    <div className="v-skel h-3 w-4/5 mb-4" />
    <div className="flex gap-1.5 mb-4">
      <div className="v-skel h-[30px] w-[30px] !rounded-[9px]" />
      <div className="v-skel h-[30px] w-[30px] !rounded-[9px]" />
      <div className="v-skel h-[30px] w-[30px] !rounded-[9px]" />
    </div>
    <div className="flex items-center justify-between pt-3 border-t border-border">
      <div className="v-skel h-4 w-24" />
      <div className="v-skel h-8 w-20 !rounded-lg" />
    </div>
  </div>
);

export default TalentCard;
