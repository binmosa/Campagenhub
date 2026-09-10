import React from 'react';
import { BadgeCheck, Coins, Globe2, Megaphone, ShieldCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { LandingSettings, PlatformStats } from '../useLandingData';
import PlatformIcon from '../mocks/PlatformIcon';
import Portrait from '../mocks/Portrait';
import { PORTRAITS, portraitSrc, type PortraitKey } from '../mocks/portraits';
import { Brand, C, CountUp } from '../mocks/SceneBits';

/**
 * Stats — what the platform can actually evidence, next to the people
 * behind the numbers.
 *
 * Every number comes from the platform's own tables
 * (`/public/platform-stats`), or from a value an admin typed in Site
 * control. No real number, no tile; no tiles, no section. The tiles are
 * illustrated (a face stack, brand marks, a coin stack, reach ripples)
 * and count up on scroll — decoration only, never a fabricated trend.
 *
 * Right: a small mosaic of creator portraits (illustrative, AI-generated —
 * see mocks/portraits.ts). A portrait whose file is not generated yet is
 * simply skipped, so the mosaic never shows a broken image.
 */
interface StatsProps {
  settings: LandingSettings;
  stats: PlatformStats | null;
}

/* Parse an admin override: "12,847" / "$2.4M" / "520+" / "1.8B" → number. */
const parseStat = (raw?: string): number | null => {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.replace(/[$,+\s]/g, '');
  let mult = 1;
  let num = trimmed;
  const last = num.slice(-1).toUpperCase();
  if (last === 'B') { mult = 1e9; num = num.slice(0, -1); }
  else if (last === 'M') { mult = 1e6; num = num.slice(0, -1); }
  else if (last === 'K') { mult = 1e3; num = num.slice(0, -1); }
  const parsed = parseFloat(num);
  return Number.isFinite(parsed) ? parsed * mult : null;
};

/** "12,847" → "12.8K" past 10K so a tile never wraps. */
const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 10_000 ? `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K` : n.toLocaleString());

/* ── tile decorations (pure decoration, no data claims) ────────────── */
const FaceStack: React.FC = () => (
  <span className="flex -space-x-2.5">
    {(['selam', 'amara', 'ravi'] as PortraitKey[]).map((k, i) => (
      <motion.span key={k} initial={{ opacity: 0, x: 6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }}>
        <Portrait id={k} initials={k[0].toUpperCase()} size={30} color={[C.purple, C.teal, C.warning][i]} style={{ border: '2px solid #fff' }} />
      </motion.span>
    ))}
  </span>
);

const BrandMarks: React.FC = () => (
  <span className="flex -space-x-1.5">
    {[
      { m: 'GL', c: C.purple },
      { m: 'ME', c: C.teal },
      { m: 'ST', c: C.warning },
    ].map((b, i) => (
      <motion.span key={b.m} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }} style={{ transform: `rotate(${(i - 1) * 8}deg)` }}>
        <Brand initials={b.m} color={b.c} size={28} />
      </motion.span>
    ))}
  </span>
);

const CoinStack: React.FC = () => (
  <span className="relative inline-block" style={{ width: 44, height: 36 }}>
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 300, damping: 18 }}
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{ width: 34, height: 12, bottom: i * 8, background: `linear-gradient(180deg, ${C.teal} 0%, #0e9f6a 100%)`, border: '1.5px solid #fff', boxShadow: 'rgba(11,23,54,0.15) 0 2px 4px' }}
      />
    ))}
  </span>
);

const Ripples: React.FC = () => (
  <span className="relative inline-flex items-center justify-center" style={{ width: 44, height: 44 }}>
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="absolute rounded-full"
        style={{ width: 14 + i * 14, height: 14 + i * 14, border: `1.5px solid ${C.blue}`, opacity: 0.55 - i * 0.15 }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.3, ease: 'easeInOut' }}
      />
    ))}
    <span className="relative inline-flex h-3.5 w-3.5 rounded-full" style={{ background: C.blue }} />
  </span>
);

const TILE_ART: Record<string, { icon: React.ReactNode; art: React.ReactNode; tint: string }> = {
  creators: { icon: <Users size={14} />, art: <FaceStack />, tint: C.purple },
  brands: { icon: <Megaphone size={14} />, art: <BrandMarks />, tint: C.teal },
  campaigns: { icon: <Coins size={14} />, art: <CoinStack />, tint: C.success },
  applications: { icon: <Globe2 size={14} />, art: <Ripples />, tint: C.blue },
};

/** Mosaic cells: who, what they make, where — captions are illustrative. */
const MOSAIC: { id: PortraitKey; name: string; niche: string; city: string; platform: 'instagram' | 'tiktok' | 'youtube' }[] = [
  { id: 'selam', name: 'Selam', niche: 'Lifestyle', city: 'Addis Ababa', platform: 'instagram' },
  { id: 'amara', name: 'Amara', niche: 'Beauty', city: 'Lagos', platform: 'tiktok' },
  { id: 'ravi', name: 'Ravi', niche: 'Tech', city: 'Nairobi', platform: 'youtube' },
  { id: 'leila', name: 'Leila', niche: 'Food', city: 'Cairo', platform: 'instagram' },
  { id: 'kofi', name: 'Kofi', niche: 'Music', city: 'Accra', platform: 'tiktok' },
  { id: 'mei', name: 'Mei', niche: 'Beauty', city: 'Dubai', platform: 'youtube' },
];

const MosaicPhoto: React.FC<{ cell: (typeof MOSAIC)[number]; className?: string }> = ({ cell, className = '' }) => {
  const [ok, setOk] = React.useState(true);
  if (!ok) return null;
  return (
    <figure className={`relative overflow-hidden rounded-2xl m-0 ${className}`} style={{ background: 'var(--color-cool-gray)' }}>
      <img src={portraitSrc(cell.id)} alt={PORTRAITS[cell.id].alt} loading="lazy" decoding="async" className="w-full h-full object-cover" onError={() => setOk(false)} />
      <figcaption className="absolute inset-x-0 bottom-0 px-3 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(180deg, rgba(11,23,54,0) 0%, rgba(11,23,54,0.78) 100%)', color: '#fff' }}>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
          <PlatformIcon platform={cell.platform} size={12} />
        </span>
        <span className="min-w-0">
          <span className="block font-medium truncate" style={{ fontSize: 12.5, letterSpacing: '-0.01em' }}>
            {cell.name}
            <span className="hidden sm:inline"> · {cell.niche}</span>
          </span>
          <span className="block truncate" style={{ fontSize: 10.5, opacity: 0.8 }}>{cell.city}</span>
        </span>
        <BadgeCheck size={13} className="ml-auto shrink-0" style={{ color: '#00d4c7' }} />
      </figcaption>
    </figure>
  );
};

export const Stats: React.FC<StatsProps> = ({ settings, stats }) => {
  const { t } = useTranslation();

  /* An admin value wins; otherwise the live count, when there is one. */
  const pick = (override: string | undefined, live: number | undefined): number | null => {
    const typed = parseStat(override);
    if (typed !== null) return typed;
    return typeof live === 'number' ? live : null;
  };

  const tiles = [
    { key: 'creators', label: settings.stats_lbl_1 || t('stats.lbl1'), value: pick(settings.stats_val_1, stats?.creatorCount) },
    { key: 'brands', label: settings.stats_lbl_2 || t('stats.lbl2'), value: pick(settings.stats_val_2, stats?.brandCount) },
    { key: 'campaigns', label: settings.stats_lbl_3 || t('stats.lbl3'), value: pick(settings.stats_val_3, stats?.activeCampaigns) },
    { key: 'applications', label: settings.stats_lbl_4 || t('stats.lbl4'), value: pick(settings.stats_val_4, stats?.totalApplications) },
  ].filter((tile) => tile.value !== null && tile.value > 0);

  if (tiles.length === 0) return null;

  return (
    <section className="px-6 lg:px-10 py-20 sm:py-24">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center max-w-[640px] mx-auto mb-12">
          <span className="v-pill-quiet">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-campaign-purple)' }} />
            {t('stats.pill')}
          </span>
          <h2 className="mt-5 v-heading-xl">{t('stats.title')}</h2>
          <p className="mt-4 v-body-lg v-muted">{t('stats.desc')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6 lg:gap-8 items-stretch">
          {/* numbers */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start"
            data-testid="stats-tiles"
          >
            {tiles.map((tile, i) => {
              const art = TILE_ART[tile.key];
              return (
                <motion.div
                  key={tile.key}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -3 }}
                  className="relative overflow-hidden rounded-2xl p-5 v-hairline flex items-center gap-4"
                  style={{ background: 'var(--color-paper)', transition: 'box-shadow 200ms' }}
                >
                  {/* tinted corner glow */}
                  <span aria-hidden className="absolute -top-10 -right-10 h-28 w-28 rounded-full" style={{ background: art.tint, opacity: 0.10, filter: 'blur(18px)' }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 v-caption v-muted" style={{ fontSize: 12.5 }}>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${art.tint}1f`, color: art.tint }}>
                        {art.icon}
                      </span>
                      <span className="truncate">{tile.label}</span>
                    </div>
                    <div className="mt-2 v-ink font-medium tabular-nums" style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.03em' }}>
                      <CountUp value={tile.value as number} format={fmt} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 v-caption" style={{ fontSize: 11, color: art.tint }}>
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: art.tint }} />
                      {t('stats.live')}
                    </div>
                  </div>
                  <div className="shrink-0 relative">{art.art}</div>
                </motion.div>
              );
            })}

            {/* the two promises the numbers rest on */}
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: <BadgeCheck size={16} />, title: t('stats.promiseVerified'), desc: t('stats.promiseVerifiedDesc') },
                { icon: <ShieldCheck size={16} />, title: t('stats.promiseEscrow'), desc: t('stats.promiseEscrowDesc') },
              ].map((p, i) => (
                <div key={i} className="rounded-2xl p-4 flex items-start gap-3 v-hairline" style={{ background: 'var(--color-paper)' }}>
                  <span className="v-hero-icon shrink-0" style={{ width: 36, height: 36, borderRadius: 11 }}>
                    {p.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="v-ink font-medium" style={{ fontSize: 14 }}>{p.title}</div>
                    <div className="v-caption v-muted" style={{ fontSize: 12.5 }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* faces */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-3 grid-rows-2 gap-3 min-h-[320px] lg:min-h-0"
            aria-label={t('stats.mosaicAria')}
            data-testid="stats-mosaic"
          >
            <MosaicPhoto cell={MOSAIC[0]} className="row-span-2 col-span-2 min-h-[220px]" />
            <MosaicPhoto cell={MOSAIC[1]} className="min-h-[120px]" />
            <MosaicPhoto cell={MOSAIC[2]} className="min-h-[120px]" />
            {MOSAIC.slice(3).map((cell) => (
              <MosaicPhoto key={cell.id} cell={cell} className="min-h-[120px]" />
            ))}
          </motion.div>
        </div>

        <p className="mt-4 text-center v-caption v-quiet" style={{ fontSize: 11.5 }}>
          {t('stats.mosaicNote')}
        </p>
      </div>
    </section>
  );
};

export default Stats;
