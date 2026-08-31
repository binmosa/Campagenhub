import React from 'react';
import { motion } from 'motion/react';
import type { LandingSettings } from '../useLandingData';
import { WORKFLOW_STEPS } from '../copy';

/**
 * HowItWorks — 4-step grid with brand-gradient icon halos.
 */
interface HowItWorksProps {
  settings: LandingSettings;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ settings }) => (
  <section
    id="how-it-works"
    className="px-6 lg:px-10 py-24 sm:py-28"
    style={{
      borderTop: '1px solid var(--color-cool-gray)',
      borderBottom: '1px solid var(--color-cool-gray)',
    }}
  >
    <div className="max-w-[1100px] mx-auto">
      <div className="text-center max-w-[640px] mx-auto mb-16">
        <span className="v-pill-quiet">The flow</span>
        <h2 className="mt-5 v-heading-xl">
          {settings.how_it_works_title || 'From brief to payout in four steps.'}
        </h2>
        <p className="mt-4 v-body-lg v-muted">
          {settings.how_it_works_desc ||
            'No spreadsheets, no agencies, no chasing invoices — everything runs on-platform.'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {WORKFLOW_STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.step}
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
                {step.title}
              </h3>
              <p className="mt-2 v-body v-muted">{step.description}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

export default HowItWorks;
