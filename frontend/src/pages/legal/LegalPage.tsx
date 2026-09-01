import React, { useEffect } from 'react';
import LandingNav from '../landing/sections/LandingNav';
import Footer from '../landing/sections/Footer';

/**
 * LegalPage — shared long-form reading layout for Terms / Privacy.
 * Narrow prose column, quiet typography, same shell as the rest of the site.
 */
export const LegalSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="mt-10">
    <h2 className="v-ink font-medium" style={{ fontSize: 19, letterSpacing: '-0.018em' }}>
      {title}
    </h2>
    <div className="mt-3 space-y-3 v-body-lg v-muted" style={{ fontSize: 15, lineHeight: 1.7 }}>
      {children}
    </div>
  </section>
);

export const LegalPage: React.FC<{
  title: string;
  updated: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, updated, intro, children }) => {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="landing-visitors min-h-screen flex flex-col">
      <LandingNav />
      <main className="flex-1 px-6 lg:px-10 pt-12 pb-24">
        <div className="mx-auto" style={{ maxWidth: 'var(--landing-prose, 760px)' }}>
          <span className="v-pill-quiet">Legal</span>
          <h1 className="mt-4 v-heading-xl">{title}</h1>
          <p className="mt-2 v-caption v-quiet">Last updated: {updated}</p>
          <div className="mt-6 v-body-lg v-muted" style={{ fontSize: 15, lineHeight: 1.7 }}>
            {intro}
          </div>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LegalPage;
