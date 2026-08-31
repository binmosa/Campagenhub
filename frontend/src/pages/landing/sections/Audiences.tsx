import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { AnimatePresence, motion } from 'motion/react';
import { AUDIENCES, type AudienceKey } from '../copy';

/**
 * Audiences — HeroUI Pro Segment + animated 3-col feature grid.
 *
 * The Segment provides the smooth selection indicator transition; the
 * AnimatePresence handles the persona narrative + benefit-grid swap.
 */
export const Audiences: React.FC = () => {
  const [selected, setSelected] = useState<AudienceKey>('creator');
  const current = AUDIENCES.find((a) => a.key === selected) ?? AUDIENCES[0];

  return (
    <section id="audiences" className="px-6 lg:px-10 py-24 sm:py-28">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center max-w-[680px] mx-auto mb-12">
          <span className="v-pill-quiet">Built for every side of the marketplace</span>
          <h2 className="mt-5 v-heading-xl">
            One platform.{' '}
            <span className="v-text-signature">Every role.</span>
          </h2>
          <p className="mt-4 v-body-lg v-muted">
            Whether you create, run a brand, or manage talent — Campgains Hub ships a workflow that fits.
          </p>
        </div>

        {/* HeroUI Pro Segment — smooth indicator transitions */}
        <div className="flex justify-center mb-14">
          <Segment
            selectedKey={selected}
            onSelectionChange={(k) => setSelected(k as AudienceKey)}
            size="md"
          >
            {AUDIENCES.map((a, i) => (
              <React.Fragment key={a.key}>
                {i > 0 && <Segment.Separator />}
                <Segment.Item id={a.key}>For {a.label}s</Segment.Item>
              </React.Fragment>
            ))}
          </Segment>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-center max-w-[760px] mx-auto mb-14">
              <div className="v-badge-new">{current.eyebrow}</div>
              <h3 className="mt-5 v-heading-lg">{current.headline}</h3>
              <p className="mt-4 v-body-lg v-muted">{current.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-14">
              {current.benefits.map((b, i) => {
                const Icon = b.icon;
                return (
                  <motion.div
                    key={b.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.05 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center md:text-left"
                  >
                    <span
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--color-soft-lavender) 0%, rgba(0,212,199,0.18) 100%)',
                        color: 'var(--color-campaign-purple)',
                      }}
                    >
                      <Icon size={20} strokeWidth={1.75} />
                    </span>
                    <h4
                      className="mt-5 v-ink font-medium"
                      style={{ fontSize: 20, letterSpacing: '-0.02em' }}
                    >
                      {b.title}
                    </h4>
                    <p className="mt-2 v-body-lg v-muted">{b.description}</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-14 flex justify-center">
              <Link to={current.ctaHref}>
                <Button variant="primary" size="lg" className="!rounded-xl">
                  {current.ctaLabel} <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default Audiences;
