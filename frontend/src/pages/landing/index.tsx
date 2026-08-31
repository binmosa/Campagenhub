import React from 'react';
import { useLandingData } from './useLandingData';

import LandingNav from './sections/LandingNav';
import Hero from './sections/Hero';
import PayoutTicker from './sections/PayoutTicker';
import ActiveCampaigns from './sections/ActiveCampaigns';
import Audiences from './sections/Audiences';
import ConsoleShowcase from './sections/ConsoleShowcase';
import Stats from './sections/Stats';
import HowItWorks from './sections/HowItWorks';
import AiStudio from './sections/AiStudio';
import RealResults from './sections/RealResults';
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
 * Creator-first narrative arc:
 *   Hero (what's my content worth?) → PayoutTicker (money in motion)
 *   → ActiveCampaigns (real briefs, real data) → Audiences (who it's for)
 *   → ConsoleShowcase (the machinery, for brands + managers)
 *   → Stats → HowItWorks → AiStudio → RealResults → Testimonials
 *   → Faq → FinalCta → Contact → Footer
 */
const LandingPage: React.FC = () => {
  const { settings, reviews, activeCampaigns, campaignsLoading, refetchReviews } = useLandingData();

  return (
    <div className="landing-visitors min-h-screen flex flex-col">
      <LandingNav />

      <main className="flex-1">
        <Hero settings={settings} />
        <PayoutTicker settings={settings} />
        <section id="campaigns">
          <ActiveCampaigns
            settings={settings}
            campaigns={activeCampaigns}
            loading={campaignsLoading}
          />
        </section>
        <Audiences />
        <ConsoleShowcase />
        <Stats settings={settings} />
        <HowItWorks settings={settings} />
        <AiStudio settings={settings} />
        <RealResults />
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
