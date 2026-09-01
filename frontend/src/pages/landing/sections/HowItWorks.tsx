import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Segment } from '@heroui-pro/react';
import type { LandingSettings } from '../useLandingData';
import { CREATOR_WORKFLOW_STEPS, WORKFLOW_STEPS } from '../copy';

/**
 * HowItWorks — one machine, two journeys.
 *
 * A persona toggle swaps between the creator steps (browse → apply →
 * create → get paid) and the brand steps (brief → applicants → escrow →
 * track). Same 4-card grid, same icon-halo language.
 */
interface HowItWorksProps {
  settings: LandingSettings;
}

type Track = 'creators' | 'brands';

export const HowItWorks: React.FC<HowItWorksProps> = ({ settings }) => {
  const { t } = useTranslation();
  const [track, setTrack] = useState<Track>('creators');
  const steps = track === 'creators' ? CREATOR_WORKFLOW_STEPS : WORKFLOW_STEPS;
  const stepText = t(track === 'creators' ? 'how.creator' : 'how.brand', {
    returnObjects: true,
  }) as { title: string; desc: string }[];

  return (
    <section
      id="how-it-works"
      className="px-6 lg:px-10 py-24 sm:py-28"
      style={{
        borderTop: '1px solid var(--color-cool-gray)',
        borderBottom: '1px solid var(--color-cool-gray)',
      }}
    >
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center max-w-[640px] mx-auto mb-10">
          <span className="v-pill-quiet">{t('how.pill')}</span>
          <h2 className="mt-5 v-heading-xl">
            {settings.how_it_works_title || t('how.title')}
          </h2>
          <p className="mt-4 v-body-lg v-muted">
            {settings.how_it_works_desc || t('how.desc')}
          </p>

          <div className="mt-7 flex justify-center">
            <Segment
              selectedKey={track}
              onSelectionChange={(k) => setTrack(k as Track)}
              size="sm"
              aria-label="Show the flow for"
            >
              <Segment.Item id="creators">{t('how.tabCreators')}</Segment.Item>
              <Segment.Separator />
              <Segment.Item id="brands">{t('how.tabBrands')}</Segment.Item>
            </Segment>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={track}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={`${track}-${step.step}`}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -4 }}
                  className="v-card"
                  style={{ transition: 'border-color 200ms, box-shadow 200ms' }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="v-caption font-medium tabular-nums"
                      style={{ color: 'var(--color-campaign-purple)', letterSpacing: '0.06em' }}
                    >
                      {step.step}
                    </span>
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--color-soft-lavender) 0%, rgba(0,212,199,0.22) 100%)',
                        color: 'var(--color-campaign-purple)',
                      }}
                    >
                      <Icon size={17} strokeWidth={1.75} />
                    </span>
                  </div>
                  <h3
                    className="mt-5 v-ink font-medium"
                    style={{ fontSize: 18, lineHeight: 1.3, letterSpacing: '-0.018em' }}
                  >
                    {stepText[i]?.title ?? step.title}
                  </h3>
                  <p className="mt-2 v-body v-muted">{stepText[i]?.desc ?? step.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default HowItWorks;
