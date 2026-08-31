import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Footer — minimal, hairline, original /logo.png brand mark.
 */
type LinkGroup = {
  heading: string;
  links: { label: string; href: string }[];
};

const LINK_GROUPS: LinkGroup[] = [
  {
    heading: 'Platform',
    links: [
      { label: 'For brands', href: '#audiences' },
      { label: 'For creators', href: '#audiences' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Active campaigns', href: '/campaigns' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '#contact' },
      { label: 'Get started', href: '/register' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy policy', href: '/legal/privacy' },
      { label: 'Terms of service', href: '/legal/terms' },
      { label: 'Cookie policy', href: '/legal/cookies' },
    ],
  },
];

const isAnchor = (href: string) => href.startsWith('#');
const scrollToHash = (e: React.MouseEvent, href: string) => {
  if (!isAnchor(href)) return;
  e.preventDefault();
  document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
};

export const Footer: React.FC = () => (
  <footer
    className="px-6 lg:px-10"
    style={{
      borderTop: '1px solid var(--color-cool-gray)',
      background: 'var(--color-paper)',
    }}
  >
    <div className="max-w-[1100px] mx-auto py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
      <div className="md:col-span-1">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Campgains Hub"
            className="h-8 w-8 object-contain"
            style={{ filter: 'drop-shadow(0 1px 4px rgba(108,99,255,0.30))' }}
          />
          <span
            className="v-ink font-medium"
            style={{ fontSize: 15, letterSpacing: '-0.018em' }}
          >
            Campgains <span style={{ color: 'var(--color-creator-teal-deep)' }}>Hub</span>
          </span>
        </div>
        <p className="mt-4 v-body v-muted max-w-[260px]">
          The end-to-end campaign console for brands, creators, and managers.
        </p>
      </div>

      {LINK_GROUPS.map((group) => (
        <div key={group.heading}>
          <h4
            className="v-caption font-medium uppercase mb-4"
            style={{ color: 'var(--color-ash)', letterSpacing: '0.06em' }}
          >
            {group.heading}
          </h4>
          <ul className="space-y-2.5">
            {group.links.map((link) => (
              <li key={link.label}>
                {isAnchor(link.href) ? (
                  <a
                    href={link.href}
                    onClick={(e) => scrollToHash(e, link.href)}
                    className="v-body v-link"
                    style={{ display: 'inline-block' }}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    to={link.href}
                    className="v-body v-link"
                    style={{ display: 'inline-block' }}
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    <div
      className="max-w-[1100px] mx-auto py-6 flex flex-col sm:flex-row items-center justify-between gap-3"
      style={{ borderTop: '1px solid var(--color-cool-gray)' }}
    >
      <p className="v-caption v-quiet">© {new Date().getFullYear()} Campgains Hub Inc. All rights reserved.</p>
      <p className="v-caption v-quiet">Built with care.</p>
    </div>
  </footer>
);

export default Footer;
