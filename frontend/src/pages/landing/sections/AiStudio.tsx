import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Brain, LineChart, Sparkles, Wand2 } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { LandingSettings } from '../useLandingData';

/**
 * AiStudio — Campgains Hub creative-partner showcase.
 *
 * Layout: left "feature cards" column (proper hairline borders, signature
 * gradient accent bar on the active card) + right preview card with full
 * chrome (sparkle icon, title, Live badge). Slide direction follows the
 * user's selection so cycling through reads like flipping pages.
 */
interface AiStudioProps {
  settings: LandingSettings;
}

type JobKey = 'briefs' | 'predict' | 'match';

const BRAND = {
  purple: '#6c63ff',
  teal: '#00d4c7',
  blue: '#4f7cff',
  success: '#16c784',
  lavender: '#f4f2ff',
};

/* ── Preview content ─────────────────────────────────────────────── */

const PreviewBrief: React.FC = () => (
  <div className="p-6">
    <div className="v-caption v-quiet">Auto-drafted brief</div>
    <div className="mt-1 v-heading">Summer fitness challenge — UGC short-form</div>
    <div className="mt-4 space-y-2">
      {['Goal: 3M reach on TikTok', 'Audience: 18–28 fitness enthusiasts US/EU', 'Deliverable: 1 × 30s UGC video'].map(
        (row, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.32, delay: i * 0.08 }}
            className="flex items-center gap-3 v-tile-mint px-3.5 py-2.5"
          >
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: BRAND.success, color: '#fff', fontSize: 11 }}
            >
              ✓
            </span>
            <span className="v-body v-ink">{row}</span>
          </motion.div>
        )
      )}
    </div>
    <div className="mt-5 flex items-center justify-between">
      <div className="v-caption v-quiet">Generated in 4.2s</div>
      <Chip color="accent" variant="soft" size="sm">
        <Sparkles size={11} /> Draft v3
      </Chip>
    </div>
  </div>
);

const PreviewPredict: React.FC = () => {
  const bars = [38, 52, 47, 61, 73, 68, 84, 92, 88, 96];
  return (
    <div className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="v-caption v-quiet">Forecasted reach · 14 days</div>
          <div className="mt-1 v-heading-lg tabular-nums">3.42M</div>
        </div>
        <Chip color="success" variant="soft" size="sm">
          ↑ 18% vs baseline
        </Chip>
      </div>
      <div className="mt-5 h-[120px] flex items-end gap-1.5">
        {bars.map((v, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-end h-full"
          >
            <motion.div
              className="w-full rounded-md block"
              initial={{ height: 0 }}
              whileInView={{ height: `${v}%` }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.55,
                delay: i * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                minHeight: 4,
                background:
                  i >= 7
                    ? `linear-gradient(180deg, ${BRAND.purple} 0%, ${BRAND.blue} 60%, ${BRAND.teal} 100%)`
                    : 'var(--color-cool-gray)',
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between v-caption v-muted">
        <span>D1</span>
        <span>D14</span>
      </div>
    </div>
  );
};

const PreviewMatch: React.FC = () => {
  const creators = [
    { name: '@linaeats', niche: 'Food · 2.5M', fit: 96, color: BRAND.purple },
    { name: '@omarjourneys', niche: 'Travel · 880K', fit: 91, color: BRAND.teal },
    { name: '@code.with.ada', niche: 'Tech · 410K', fit: 88, color: '#ffb547' },
  ];
  return (
    <div className="p-6">
      <div className="v-caption v-quiet">Top creator matches</div>
      <div className="mt-3 space-y-2">
        {creators.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="v-hairline flex items-center gap-3 px-3.5 py-3"
            style={{ borderRadius: 14 }}
          >
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full font-medium"
              style={{ background: c.color, color: '#fff', fontSize: 13 }}
            >
              {c.name.slice(1, 3).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="v-body font-medium v-ink">{c.name}</div>
              <div className="v-caption v-quiet">{c.niche}</div>
            </div>
            <div className="text-right">
              <div
                className="v-caption font-medium tabular-nums"
                style={{ color: BRAND.purple }}
              >
                {c.fit}% fit
              </div>
              <div
                className="mt-1 h-1 w-16 rounded-full overflow-hidden"
                style={{ background: 'var(--color-cool-gray)' }}
              >
                <motion.div
                  className="h-1 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${c.fit}%` }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.05 }}
                  style={{ background: `linear-gradient(90deg, ${BRAND.purple}, ${BRAND.teal})` }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

/* ── Job catalog ─────────────────────────────────────────────────── */
type Job = {
  key: JobKey;
  step: string;
  icon: typeof Wand2;
  title: string;
  desc: string;
  preview: React.FC;
};

const JOBS: Job[] = [
  { key: 'briefs',  step: '01', icon: Wand2,     title: 'AI brief shortcuts',      desc: 'Draft a campaign brief in seconds from a product, audience and budget.',     preview: PreviewBrief },
  { key: 'predict', step: '02', icon: LineChart, title: 'Reach + ROI forecasting', desc: 'Model expected impressions and engagement before you commit budget.',         preview: PreviewPredict },
  { key: 'match',   step: '03', icon: Brain,     title: 'Smart creator matching',  desc: 'Find the right fit using audience signals and past campaign performance.',    preview: PreviewMatch },
];

/* ── Component ───────────────────────────────────────────────────── */
export const AiStudio: React.FC<AiStudioProps> = ({ settings }) => {
  const [active, setActive] = useState<JobKey>('briefs');
  const prevIndexRef = useRef(0);
  const { t } = useTranslation();
  const activeIndex = JOBS.findIndex((j) => j.key === active);
  const direction = activeIndex >= prevIndexRef.current ? 1 : -1;
  prevIndexRef.current = activeIndex;

  const current = JOBS[activeIndex] ?? JOBS[0];
  const Preview = current.preview;

  return (
    <section className="px-6 lg:px-10 py-24 sm:py-28 v-bg-dawn-subtle">
      <div className="max-w-[1100px] mx-auto">
        {/* Section header */}
        <div className="text-center max-w-[640px] mx-auto mb-14">
          <span className="v-pill-quiet">
            <Sparkles size={11} style={{ color: BRAND.purple }} />
            {settings.ai_studio_title || t('ai.pill')}
          </span>
          <h2 className="mt-5 v-heading-xl">
            {settings.ai_studio_main_title || t('ai.title')}
          </h2>
          <p className="mt-4 v-body-lg v-muted">
            {settings.ai_studio_desc || t('ai.desc')}
          </p>
        </div>

        <div className="grid lg:grid-cols-[0.92fr_1.18fr] gap-6 lg:gap-8 items-start">
          {/* ─── Left: tab cards ──────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            {JOBS.map((j, ji) => {
              const Icon = j.icon;
              const isActive = j.key === active;
              return (
                <motion.div
                  key={j.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActive(j.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActive(j.key);
                    }
                  }}
                  whileTap={{ scale: 0.99 }}
                  className="relative cursor-pointer select-none outline-none"
                  style={{
                    background: isActive
                      ? 'linear-gradient(180deg, rgba(244,242,255,0.55) 0%, var(--color-paper) 100%)'
                      : 'var(--color-paper)',
                    border: `1px solid ${isActive ? '#d6dbe8' : 'var(--color-cool-gray)'}`,
                    borderRadius: 18,
                    padding: '18px 20px 18px 22px',
                    boxShadow: isActive
                      ? 'rgba(11,23,54,0.05) 0px 2px 6px 0px, rgba(11,23,54,0.08) 0px 16px 32px -16px'
                      : 'none',
                    transition:
                      'border-color 240ms cubic-bezier(0.16,1,0.3,1), background 240ms, box-shadow 240ms',
                  }}
                >
                  {/* Signature gradient left accent bar — only when active */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.span
                        layoutId="ai-studio-accent"
                        initial={{ opacity: 0, scaleY: 0.6 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0.6 }}
                        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute"
                        style={{
                          left: 0,
                          top: 14,
                          bottom: 14,
                          width: 4,
                          borderTopRightRadius: 4,
                          borderBottomRightRadius: 4,
                          background:
                            'linear-gradient(180deg, #6c63ff 0%, #4f7cff 50%, #00d4c7 100%)',
                        }}
                      />
                    )}
                  </AnimatePresence>

                  <div className="flex items-start gap-3.5">
                    {/* Icon pill */}
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                      style={{
                        background: isActive ? BRAND.lavender : 'rgba(233,237,245,0.7)',
                        color: isActive ? BRAND.purple : 'var(--color-graphite)',
                        transition: 'background-color 240ms, color 240ms',
                      }}
                    >
                      <Icon size={17} strokeWidth={1.75} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="v-caption font-medium tabular-nums"
                          style={{
                            color: isActive ? BRAND.purple : 'var(--color-ash)',
                            letterSpacing: '0.06em',
                          }}
                        >
                          {j.step}
                        </span>
                        <span
                          className="v-body font-medium v-ink"
                          style={{ fontSize: 15 }}
                        >
                          {t(`ai.job${ji + 1}t`)}
                        </span>
                      </div>
                      <p className="mt-1 v-body v-muted">{t(`ai.job${ji + 1}d`)}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <Link to="/register" className="mt-2">
              <Button variant="primary" size="md" className="!rounded-xl">
                {settings.ai_studio_btn || t('ai.btn')} <ArrowRight size={14} />
              </Button>
            </Link>
          </div>

          {/* ─── Right: preview card ──────────────────────────────── */}
          <div
            className="relative overflow-hidden"
            style={{
              background: 'var(--color-paper)',
              border: '1px solid var(--color-cool-gray)',
              borderRadius: 22,
              boxShadow:
                'rgba(11,23,54,0.04) 0px 1px 3px 0px, rgba(11,23,54,0.08) 0px 24px 48px -16px',
              minHeight: 420,
            }}
          >
            {/* Soft gradient halo top-right */}
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                top: -80,
                right: -60,
                width: 320,
                height: 320,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(108,99,255,0.10), transparent 70%)',
              }}
            />

            {/* Chrome */}
            <div
              className="flex items-center justify-between px-5 py-3.5 relative"
              style={{ borderBottom: '1px solid var(--color-cool-gray)' }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    background: BRAND.lavender,
                    color: BRAND.purple,
                  }}
                >
                  <Sparkles size={14} />
                </span>
                <span className="v-body font-medium v-ink" style={{ fontSize: 14 }}>
                  {t(`ai.job${activeIndex + 1}t`)}
                </span>
              </div>
              <Chip color="success" variant="soft" size="sm">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: BRAND.success }}
                />
                Live preview
              </Chip>
            </div>

            {/* Sliding body */}
            <div className="relative">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={active}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -24 }}
                  transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Preview />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Dot navigation in footer for mobile clarity */}
            <div
              className="flex items-center justify-center gap-1.5 pt-2 pb-5"
              aria-hidden
            >
              {JOBS.map((j) => {
                const isActive = j.key === active;
                return (
                  <span
                    key={j.key}
                    onClick={() => setActive(j.key)}
                    className="cursor-pointer"
                    style={{
                      height: 6,
                      width: isActive ? 20 : 6,
                      borderRadius: 999,
                      background: isActive
                        ? 'linear-gradient(90deg, #6c63ff 0%, #00d4c7 100%)'
                        : 'var(--color-cool-gray)',
                      transition:
                        'width 280ms cubic-bezier(0.16,1,0.3,1), background 240ms',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AiStudio;
