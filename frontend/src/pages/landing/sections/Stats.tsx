import React from 'react';
import { KPI } from '@heroui-pro/react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { LandingSettings, PlatformStats } from '../useLandingData';

/**
 * Stats — what the platform can actually evidence.
 *
 * This row used to ship invented figures: 12,847 creators, $2.4M paid,
 * 1.8B reach, each with a fabricated sparkline and a "from 12,535" baseline,
 * all rendered on a brand-new deploy. Every number here now comes from the
 * platform's own tables (`/public/platform-stats`), or from a value an admin
 * typed in Site control. No real number, no tile; no tiles, no section.
 *
 * The sparklines and trend chips are gone with the fake data — there is no
 * historical series behind them, and drawing one would be the same lie in
 * another shape.
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

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${tiles.length >= 4 ? 'lg:grid-cols-4' : tiles.length === 3 ? 'lg:grid-cols-3' : ''}`}
        >
          {tiles.map((tile) => (
            <KPI key={tile.key}>
              <KPI.Header>
                <KPI.Title>{tile.label}</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <KPI.Value value={tile.value as number} maximumFractionDigits={0} />
              </KPI.Content>
            </KPI>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Stats;
