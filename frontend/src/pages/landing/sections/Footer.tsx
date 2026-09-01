import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../../lib/api';

/**
 * Footer — the site's closing argument.
 *
 * Columns are organized by AUDIENCE (Creators / Brands / Support). Fully
 * translated via i18n keys, and the Markets row is data-driven from
 * /api/markets — launching a country automatically adds its link here.
 */

type FooterLink = { key: string; href: string };
type LinkGroup = { headingKey: string; links: FooterLink[] };

const LINK_GROUPS: LinkGroup[] = [
  {
    headingKey: 'footer.forCreators',
    links: [
      { key: 'footer.openCampaigns', href: '/campaigns' },
      { key: 'footer.estimatePayout', href: '#home' },
      { key: 'footer.howItWorks', href: '#how-it-works' },
      { key: 'footer.joinFree', href: '/register?role=creator' },
    ],
  },
  {
    headingKey: 'footer.forBrands',
    links: [
      { key: 'footer.browseTalent', href: '/talent' },
      { key: 'footer.theConsole', href: '#console' },
      { key: 'footer.whoItsFor', href: '#audiences' },
      { key: 'footer.launchACampaign', href: '/register?role=brand' },
    ],
  },
  {
    headingKey: 'footer.support',
    links: [
      { key: 'footer.faqs', href: '#faqs' },
      { key: 'footer.contactUs', href: '#contact' },
      { key: 'footer.signIn', href: '/login' },
    ],
  },
];

type Market = {
  code: string;
  name: string;
  flag: string;
  status: 'live' | 'coming_soon';
};

export const Footer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [markets, setMarkets] = useState<Market[]>([]);
  useEffect(() => {
    api
      .get('/markets')
      .then((res) => setMarkets(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  /** Anchors smooth-scroll on the landing; from any other page they
   *  navigate home with the hash so the target actually exists. */
  const goToAnchor = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (el && location.pathname === '/') {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`/#${id}`);
    }
  };

  const renderLink = (link: FooterLink) =>
    link.href.startsWith('#') ? (
      <a
        href={`/${link.href}`}
        onClick={(e) => goToAnchor(e, link.href)}
        className="v-body v-link"
        style={{ display: 'inline-block' }}
      >
        {t(link.key)}
      </a>
    ) : (
      <Link to={link.href} className="v-body v-link" style={{ display: 'inline-block' }}>
        {t(link.key)}
      </Link>
    );

  return (
    <footer
      className="px-6 lg:px-10"
      style={{
        borderTop: '1px solid var(--color-cool-gray)',
        /* The directory-card wash, reversed: cards fade lavender → paper
           downward, the footer fades paper → lavender — the page grounds
           into the brand surface as it closes. */
        background:
          'linear-gradient(180deg, var(--color-paper) 0%, rgba(244,242,255,0.55) 55%, var(--color-soft-lavender) 100%)',
      }}
    >
      <div className="max-w-[1100px] mx-auto pt-16 pb-10 grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-10">
        {/* Brand column */}
        <div className="col-span-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2"
            aria-label="Campgains Hub — home"
          >
            <img
              src="/logo.png"
              alt=""
              className="h-8 w-8 object-contain"
              style={{ filter: 'drop-shadow(0 1px 4px rgba(108,99,255,0.30))' }}
            />
            <span className="v-ink font-medium" style={{ fontSize: 15, letterSpacing: '-0.018em' }}>
              Campgains <span style={{ color: 'var(--color-creator-teal-deep)' }}>Hub</span>
            </span>
          </Link>
          <p className="mt-4 v-body v-muted max-w-[280px]">{t('footer.promise')}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              to="/register?role=creator"
              className="v-body font-medium inline-flex items-center gap-1.5 v-link"
              style={{ color: 'var(--color-campaign-purple)' }}
            >
              {t('footer.startEarningCta')} <ArrowRight size={13} />
            </Link>
            <Link
              to="/register?role=brand"
              className="v-body font-medium inline-flex items-center gap-1.5 v-link"
              style={{ color: 'var(--color-graphite)' }}
            >
              {t('footer.launchCta')} <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Audience-oriented link columns */}
        {LINK_GROUPS.map((group) => (
          <div key={group.headingKey}>
            <h4
              className="v-caption font-medium uppercase mb-4"
              style={{ color: 'var(--color-ash)', letterSpacing: '0.06em' }}
            >
              {t(group.headingKey)}
            </h4>
            <ul className="space-y-2.5">
              {group.links.map((link) => (
                <li key={link.key}>{renderLink(link)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Markets row — data-driven from /api/markets */}
      {markets.length > 0 && (
        <div
          className="max-w-[1100px] mx-auto pb-6 flex items-center gap-2 flex-wrap"
          aria-label={t('footer.markets')}
        >
          <span className="v-caption v-quiet uppercase" style={{ letterSpacing: '0.06em' }}>
            {t('footer.markets')}
          </span>
          {markets.map((m) =>
            m.status === 'live' ? (
              <Link key={m.code} to={`/${m.code}`} className="v-pill-quiet v-link">
                {m.flag} {m.name}
              </Link>
            ) : (
              <span key={m.code} className="v-pill-quiet" style={{ opacity: 0.55 }}>
                {m.flag} {m.name} · {t('market.comingSoon')}
              </span>
            ),
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div
        className="max-w-[1100px] mx-auto py-5 flex flex-col sm:flex-row items-center justify-between gap-3"
        style={{ borderTop: '1px solid var(--color-cool-gray)' }}
      >
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <p className="v-caption v-quiet">
            © {new Date().getFullYear()} Campgains Hub Inc. {t('footer.rights')}
          </p>
          <Link to="/legal/terms" className="v-caption v-link">
            {t('footer.terms')}
          </Link>
          <Link to="/legal/privacy" className="v-caption v-link">
            {t('footer.privacy')}
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <p className="v-caption v-quiet">{t('footer.madeFor')}</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label={t('footer.backToTop')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:-translate-y-0.5"
            style={{
              border: '1px solid var(--color-cool-gray)',
              background: 'var(--color-paper)',
              color: 'var(--color-graphite)',
            }}
          >
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
