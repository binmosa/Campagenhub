import React from 'react';
import { useLandingData } from './useLandingData';

import LandingNav from './sections/LandingNav';
import Hero from './sections/Hero';
import TrustedBy from './sections/TrustedBy';
import Stats from './sections/Stats';
import AiStudio from './sections/AiStudio';
import Audiences from './sections/Audiences';
import HowItWorks from './sections/HowItWorks';
import RealResults from './sections/RealResults';
import ActiveCampaigns from './sections/ActiveCampaigns';
import Testimonials from './sections/Testimonials';
import Faq from './sections/Faq';
import FinalCta from './sections/FinalCta';
import Contact from './sections/Contact';
import Footer from './sections/Footer';

/**
 * Landing — public homepage assembly, Visitors design.
 *
 * The whole page is wrapped in `.landing-visitors` so all the Visitors
 * design tokens (color, type, radius, shadow) override the in-app theme
 * on this route only. The rest of the app keeps its existing palette.
 *
 * Page flow:
 *   Nav → Hero → TrustedBy → Stats → AiStudio → Audiences
 *      → HowItWorks → ActiveCampaigns → Testimonials → Faq
 *      → FinalCta → Contact → Footer
 */
const LandingPage: React.FC = () => {
  const { settings, reviews, activeCampaigns, campaignsLoading, refetchReviews } = useLandingData();

  return (
    <div className="landing-visitors min-h-screen flex flex-col">
      <LandingNav />

      <main className="flex-1">
        <Hero settings={settings} />
        <TrustedBy settings={settings} />
        <Stats settings={settings} />
        <AiStudio settings={settings} />
        <Audiences />
        <HowItWorks settings={settings} />
        <RealResults />
        <section id="campaigns">
          <ActiveCampaigns
            settings={settings}
            campaigns={activeCampaigns}
            loading={campaignsLoading}
          />
        </section>
        <Testimonials
          settings={settings}
          reviews={reviews}
          onReviewSubmitted={refetchReviews}
        />
        <Faq settings={settings} />
        <FinalCta settings={settings} />
        <Contact settings={settings} />
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;
