/**
 * Landing page copy + structural data.
 *
 * Sourced from the legacy Landing.tsx mock blocks. Admin can override any
 * piece via SiteSettings; these are the defaults shown when no override
 * exists, and the data that drives the section bodies (features, FAQs,
 * testimonials, etc.).
 */

import {
  BarChart3, UserCheck, Target, FileText, Search,
  DollarSign, Calendar, Users as UsersIcon, LineChart, Receipt,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';

export type FeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type WorkflowStep = {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  affiliation: string;
};

export type Faq = {
  question: string;
  answer: string;
};

/**
 * NAV_SECTIONS — public nav items.
 *
 * `anchor` items scroll to a section on the landing page (`/#<id>`); when
 * clicked from a non-landing page they React-Router-navigate to `/#<id>` so
 * the landing page loads and scrolls to the section. `route` items are
 * always plain page navigations (`/talent`, `/campaigns`, …).
 */
export type NavItem =
  | { kind: 'anchor'; id: string; label: string }
  | { kind: 'route';  href: string; label: string };

export const NAV_SECTIONS: NavItem[] = [
  { kind: 'anchor', id: 'home',         label: 'For creators' },
  { kind: 'anchor', id: 'console',      label: 'For brands' },
  { kind: 'anchor', id: 'how-it-works', label: 'How it works' },
  { kind: 'route',  href: '/talent',    label: 'Talent' },
  { kind: 'route',  href: '/campaigns', label: 'Campaigns' },
  { kind: 'anchor', id: 'faqs',         label: 'FAQs' },
];

// (BRAND_FEATURES + CREATOR_FEATURES removed — replaced by the unified
// AUDIENCES data below, consumed by the Segment-driven <Audiences> section.)

/** Brand-side journey (the original four steps were always brand-POV). */
export const WORKFLOW_STEPS: WorkflowStep[] = [
  { step: '01', title: 'Post your brief', description: "Set your goals, choose a platform, define your budget, and describe what you're looking for.", icon: FileText },
  { step: '02', title: 'Creators apply',  description: 'Vetted creators discover your campaign and send applications with their pitch and portfolio — most briefs get applications within 24 hours.', icon: Search },
  { step: '03', title: 'Match & escrow',  description: 'Review AI-ranked applicants, accept your match, and fund the budget into escrow — protected until work ships.', icon: UserCheck },
  { step: '04', title: 'Track & settle',  description: 'Watch reach and engagement live from every post. Escrow releases automatically when work is delivered.', icon: BarChart3 },
];

/** Creator-side journey — same machine, seen from the other side. */
export const CREATOR_WORKFLOW_STEPS: WorkflowStep[] = [
  { step: '01', title: 'Pick your briefs',  description: 'Browse live campaigns in your niche on the platforms you already post on. No cold outreach, no DMs.', icon: Search },
  { step: '02', title: 'Apply in a tap',    description: 'Send your pitch and portfolio in one tap — or let the AI draft the pitch for you.', icon: FileText },
  { step: '03', title: 'Create & post',     description: 'The budget is already escrowed before you hit record. Make the content you were going to make anyway.', icon: UserCheck },
  { step: '04', title: 'Get paid',          description: 'Escrow releases as soon as your work ships. No invoices, no chasing, no 90-day payment terms.', icon: DollarSign },
];

export const MOCK_TESTIMONIALS: Testimonial[] = [
  {
    quote: 'CampaignHub has been our system of record for influencer marketing for over 5 years. The matching engine and automated payments have saved us thousands of hours.',
    name: 'Ahmed K.', role: 'VP of Marketing', affiliation: 'Global Retailer',
  },
  {
    quote: 'As a creator, reliability and trust are everything. CampaignHub provides the most transparent, professional platform in the industry. The guaranteed payout system is flawless.',
    name: 'Lina M.', role: 'Content Creator', affiliation: '2.5M Followers',
  },
  {
    quote: 'We required a SOC-2 compliant platform that could handle our scale. CampaignHub completely revolutionized our discovery workflow.',
    name: 'Omar S.', role: 'Director of Digital', affiliation: 'Fortune 500 Agency',
  },
];

export const MOCK_FAQS: Faq[] = [
  { question: 'How much does it cost to get started?',                       answer: 'CampaignHub is completely free to join for creators. Brands can start creating campaigns immediately. You only pay the budget you set for each campaign. No hidden fees or subscriptions.' },
  { question: 'How does CampaignHub match me with the right creators?',     answer: 'Our smart matching looks at creator categories, audience size, past campaign performance, and your campaign goals to recommend the best-fit creators for your brand.' },
  { question: 'How do payments work on CampaignHub?',                       answer: "When a brand accepts a creator's application, the campaign budget is securely processed. Creators receive their payout directly through the platform, no chasing invoices." },
  { question: 'Can I run campaigns on multiple platforms?',                  answer: 'CampaignHub supports campaigns across Instagram, TikTok, YouTube, Twitter, and Twitch. You can target specific platforms or run cross-platform campaigns.' },
  { question: 'How quickly will I start getting applications?',              answer: "Most campaigns start receiving creator applications within the first 24 hours of publishing. The more detailed your brief, the better quality applications you'll attract." },
];

// (Removed: legacy hero background photo /images/bg-landing.jpg and
// /professional_collaboration.png. The revamped homepage uses brand-gradient
// washes + UI mockups instead of stock photography.)

/* ─── Audiences — Segment-tabbed section ──────────────────────────── */

export type AudienceKey = 'creator' | 'brand' | 'manager';

export type AudienceContent = {
  key: AudienceKey;
  label: string;
  eyebrow: string;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  benefits: { icon: LucideIcon; title: string; description: string }[];
};

export const AUDIENCES: AudienceContent[] = [
  {
    key: 'creator',
    label: 'Creator',
    eyebrow: 'For Creators',
    headline: 'Get paid for the work you already love.',
    description:
      'Browse real campaigns from real brands. Apply with one click. Get paid as soon as your work ships.',
    ctaLabel: 'Join as a creator',
    ctaHref: '/register?role=creator',
    benefits: [
      { icon: Target,        title: 'Real brand campaigns',     description: 'No middlemen. Direct briefs from brands on the platforms you publish on.' },
      { icon: DollarSign,    title: 'Pay on delivery',          description: 'Funds escrow at brief acceptance. Released as soon as your post ships.' },
      { icon: LineChart,     title: 'Track every collab',       description: 'See applications, deadlines, and earnings in one clean workspace.' },
    ],
  },
  {
    key: 'brand',
    label: 'Brand',
    eyebrow: 'For Brands',
    headline: 'Run campaigns end-to-end. Without the spreadsheets.',
    description:
      'Post a brief, get matched with creators on TikTok, Instagram and YouTube, and only pay when work ships.',
    ctaLabel: 'Launch a campaign',
    ctaHref: '/register?role=brand',
    benefits: [
      { icon: UserCheck,     title: 'Match in minutes',         description: 'AI matcher surfaces 5 strong candidates per brief, filtered by niche + audience.' },
      { icon: BarChart3,     title: 'Live performance',         description: 'Reach, engagement, and click-through from every creator post — no manual rollups.' },
      { icon: CreditCard,    title: 'Pay only on delivery',     description: 'Budgets stay escrowed until work ships. No invoicing, no payment risk.' },
    ],
  },
  {
    key: 'manager',
    label: 'Manager',
    eyebrow: 'For Managers',
    headline: 'Manage every roster. Take your cut, automatically.',
    description:
      'Onboard creators, broker campaigns on their behalf, and collect commission — without juggling four spreadsheets.',
    ctaLabel: 'Manage talent',
    ctaHref: '/register?role=manager',
    benefits: [
      { icon: UsersIcon,     title: 'Roster in one place',      description: 'Onboard creators under your wing. Track their pipeline + earnings at a glance.' },
      { icon: Calendar,      title: 'Broker campaigns',         description: 'Negotiate briefs on behalf of your roster. One inbox, every deal.' },
      { icon: Receipt,       title: 'Auto-commission payouts',  description: 'Your cut is calculated and split at every payout. No invoices to chase.' },
    ],
  },
];
