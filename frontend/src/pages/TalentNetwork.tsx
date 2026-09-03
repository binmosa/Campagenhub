import React from 'react';
import { Zap } from 'lucide-react';
import { Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import LandingNav from './landing/sections/LandingNav';
import Footer from './landing/sections/Footer';
import { TalentDirectory } from '../components/common/TalentDirectory';

/**
 * TalentNetwork — public directory of creators and managers.
 *
 * Page chrome only: nav, hero, footer. The directory itself (filters,
 * cards, infinite scroll, invitations) is the shared <TalentDirectory />,
 * also rendered inside every role's dashboard.
 */
const TalentNetwork: React.FC = () => {
  const { t } = useTranslation();
  // Market pages deep-link the directory: /talent?country=Ethiopia
  const initialCountry = new URLSearchParams(window.location.search).get('country') || '';

  return (
    <div className="landing-visitors min-h-screen flex flex-col">
      <LandingNav />

      <main className="flex-1">
        {/* Hero (compact) */}
        <section className="px-6 lg:px-10 pt-10 pb-6">
          <div className="max-w-[1100px] mx-auto text-center">
            <Chip color="accent" variant="soft" size="md" className="!mb-4">
              <Zap size={12} />
              <Chip.Label>{t('talent.pill')}</Chip.Label>
            </Chip>
            <h1 className="v-heading-xl mb-2">
              {t('talent.titleA')} <span className="v-text-signature">{t('talent.titleB')}</span>
            </h1>
            <p className="v-body-lg v-muted max-w-2xl mx-auto">{t('talent.desc')}</p>
          </div>
        </section>

        <section className="px-6 lg:px-10 pb-16">
          <div className="max-w-[1100px] mx-auto">
            <TalentDirectory initialCountry={initialCountry} />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default TalentNetwork;
