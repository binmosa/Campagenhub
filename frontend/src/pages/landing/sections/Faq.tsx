import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Disclosure, DisclosureGroup } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import type { LandingSettings } from '../useLandingData';

/**
 * Faq — HeroUI DisclosureGroup with smooth expand/collapse.
 *
 * One row open at a time. HeroUI handles the height + opacity transition.
 */
interface FaqProps {
  settings: LandingSettings;
}

export const Faq: React.FC<FaqProps> = ({ settings }) => {
  const { t } = useTranslation();
  if (settings.faq_enabled === 'false') return null;

  const items = t('faq.items', { returnObjects: true }) as { q: string; a: string }[];

  return (
    <section
      id="faqs"
      className="px-6 lg:px-10 py-24 sm:py-28"
      style={{ borderTop: '1px solid var(--color-cool-gray)' }}
    >
      <div className="max-w-[760px] mx-auto">
        <div className="text-center mb-12">
          <span className="v-pill-quiet">{t('faq.pill')}</span>
          <h2 className="mt-5 v-heading-xl">{t('faq.title')}</h2>
          <p className="mt-4 v-body-lg v-muted">
            {t('faq.desc')}
          </p>
        </div>

        <DisclosureGroup>
          <div className="flex flex-col">
            {items.map((faq, i) => (
              <Disclosure key={i}>
                <div
                  style={{
                    borderBottom: '1px solid var(--color-cool-gray)',
                    borderTop: i === 0 ? '1px solid var(--color-cool-gray)' : 'none',
                  }}
                >
                  <Disclosure.Heading>
                    <Disclosure.Trigger
                      className="flex items-center justify-between w-full py-5 text-left"
                      style={{ background: 'transparent' }}
                    >
                      <span
                        className="v-ink font-medium pr-4"
                        style={{ fontSize: 17, letterSpacing: '-0.016em' }}
                      >
                        {faq.q}
                      </span>
                      <Disclosure.Indicator>
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0"
                          style={{
                            background: 'var(--color-paper)',
                            color: 'var(--color-graphite)',
                            border: '1px solid var(--color-cool-gray)',
                            transition: 'transform 240ms ease',
                          }}
                        >
                          <ChevronDown size={14} />
                        </span>
                      </Disclosure.Indicator>
                    </Disclosure.Trigger>
                  </Disclosure.Heading>
                  <Disclosure.Content>
                    <Disclosure.Body className="pb-5 pr-12 v-body-lg v-muted">
                      {faq.a}
                    </Disclosure.Body>
                  </Disclosure.Content>
                </div>
              </Disclosure>
            ))}
          </div>
        </DisclosureGroup>
      </div>
    </section>
  );
};

export default Faq;
