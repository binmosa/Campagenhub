/**
 * Creator Agreement — the text a creator accepts during onboarding.
 *
 * This is the creator-facing summary of the full Terms of Service
 * (/legal/terms) and Privacy Policy (/legal/privacy), which it incorporates
 * by reference. It is written to be jurisdiction-neutral: it binds the
 * creator to the platform rules wherever they are, and the governing-law
 * clause defers to the full Terms rather than naming a country here.
 *
 * LEGAL RECORD: every acceptance is stored on the user (timestamp, this
 * version string, IP, user agent). Bump `CREATOR_AGREEMENT_VERSION` whenever
 * the wording changes so old acceptances stay tied to the text they covered
 * and existing creators are asked to accept the new one.
 */
export const CREATOR_AGREEMENT_VERSION = '2026-09-10';
export const CREATOR_AGREEMENT_EFFECTIVE = 'September 10, 2026';

export type AgreementSection = {
  title: string;
  /** Lead paragraph(s) shown before the bullets. */
  intro?: string[];
  /** Bullet points; an optional bold lead-in is separated with " — ". */
  bullets?: string[];
};

export const CREATOR_AGREEMENT: AgreementSection[] = [
  {
    title: '1. Acceptance of these terms',
    intro: [
      'By creating a creator account or using the Campaign Hubz platform, websites, apps, bot integrations, and related services (together, the "Platform"), you agree to this Creator Agreement, our Terms of Service, and our Privacy Policy (together, the "Terms"). If you do not agree, do not use the Platform.',
      'Campaign Hubz operates the Platform. In this Agreement "we", "us", and "Campaign Hubz" mean the Campaign Hubz operating company; "you" means the person or entity opening the creator account.',
    ],
  },
  {
    title: '2. Eligibility',
    bullets: [
      'You are at least 18 years old, or the age of legal majority where you live if that is higher, and you are able to enter into a binding contract.',
      'If you use the Platform for a company, agency, or another person, you confirm you are authorised to bind them, and "you" includes them.',
      'You will comply with all laws and regulations that apply to you, including advertising, consumer-protection, tax, and data-protection rules in every country where your content is published or your audience is located.',
      'Campaign Hubz may decline or close an account at its discretion where the Platform is not available or lawful in your country.',
    ],
  },
  {
    title: '3. Your account',
    bullets: [
      'Accurate information — you will give true, current, and complete details during onboarding and keep them updated: your name, location, phone number, and every social media account you add.',
      'One person, one account — you may not create multiple creator accounts or share an account with others.',
      'Security — you are responsible for keeping your password and Telegram link private and for everything done through your account. Tell us immediately if you suspect misuse.',
      'Suspension — we may suspend, restrict, or terminate your account, reclaim a handle, or remove content if we reasonably believe these Terms, the law, or the safety of other users is at risk.',
    ],
  },
  {
    title: '4. Social media accounts and audience verification',
    intro: [
      'Brands rely on the audience figures shown on your profile. To protect them and you, every account you add is verified by Campaign Hubz before it carries a verified badge.',
    ],
    bullets: [
      'Ownership — every handle you add must be an account you personally own or are authorised to manage.',
      'We verify the numbers — you do not enter follower counts; Campaign Hubz records the audience it can confirm from the platform itself. Where a number cannot be confirmed, the account stays unverified and may be rejected.',
      'No artificial audiences — purchased followers, engagement pods, bots, view or like manipulation, and any other artificial inflation are prohibited. Campaign Hubz monitors traffic and engagement signals and may withhold or deny badges, campaign access, or payouts where such activity is detected, and may close the account.',
      'Re-verification — a changed or replaced account goes back to unverified until it is checked again. We may re-check any account at any time.',
      'Platform rules — you will follow the terms and community guidelines of each social platform you publish on.',
    ],
  },
  {
    title: '5. Campaigns, applications, and contracts',
    bullets: [
      'Campaign Hubz is a marketplace — collaborations are agreed directly between you and the brand (or its manager). Campaign Hubz is not a party to that agreement, and is not your employer, agent, or guarantor of any brand.',
      'Applying to a campaign is an offer to collaborate. A collaboration exists only when a brand accepts your application, or you accept an invitation, and the resulting contract is between you and the brand.',
      'You will deliver what the brief and contract describe, on time, with content that is original, lawful, and does not infringe anyone else\'s rights.',
      'You will clearly disclose paid partnerships as required where you and your audience are located (for example #ad, #sponsored, or the platform\'s paid-partnership label).',
      'No circumvention — you will not use the Platform to find a brand and then move the deal off-platform to avoid fees, tracking, or protections.',
      'Draft contracts and other documents generated by the Platform, including with AI assistance, are templates only and not legal advice. Review them before you rely on them.',
    ],
  },
  {
    title: '6. Payments and payouts',
    bullets: [
      'Payments are processed by third-party providers and paid to the payout account you register. Their terms apply, and Campaign Hubz is not responsible for their acts, delays, or outages.',
      'Where a campaign budget is held in escrow-style handling, it is released according to the campaign flow and the contract, for example on approval of delivered work.',
      'Campaign Hubz may charge platform or service fees. They are shown before you commit to a transaction and may change on notice.',
      'You are solely responsible for any taxes, levies, social charges, and reporting that apply to amounts you receive, in every relevant country.',
      'Payouts may be held where an account is under investigation for fraud, artificial audience activity, a payment dispute, or a breach of these Terms, until the matter is resolved or as the payment provider and applicable law require.',
    ],
  },
  {
    title: '7. Content and intellectual property',
    bullets: [
      'You own the content you create. Usage rights in campaign deliverables are governed by your contract with the brand.',
      'You grant Campaign Hubz a worldwide, non-exclusive, royalty-free licence to host, store, display, and distribute what you submit to the Platform (profile, handles, pitches, submissions, a welcome post about Campaign Hubz) to operate, promote, and improve the Platform.',
      'The Platform, its software, design, and branding belong to Campaign Hubz or its licensors. You may not copy, modify, scrape, or reverse-engineer it.',
    ],
  },
  {
    title: '8. Prohibited conduct',
    intro: ['You will not:'],
    bullets: [
      'Misrepresent your identity, audience, location, or affiliation, or impersonate anyone.',
      'Publish content that is unlawful, infringing, deceptive, hateful, sexually exploitative, or that targets minors.',
      'Use bots, scripts, or automation to interact with the Platform, or interfere with its security or rate limits.',
      'Spam, harass, or defraud brands, managers, other creators, or Campaign Hubz staff.',
    ],
  },
  {
    title: '9. Privacy and communications',
    bullets: [
      'We process your personal data, including your phone number, location, and social media handles, as described in our Privacy Policy, to operate the Platform, verify your audience, match you with campaigns, process payouts, and meet legal obligations.',
      'Your phone number is never shown publicly. It is used by Campaign Hubz for payout and account matters and for urgent campaign updates.',
      'You agree to receive service messages about your account, verification, applications, contracts, and payouts by email, in the Platform, and, if you connect it, through the official Campaign Hubz Telegram bot. You can disconnect Telegram at any time from your profile.',
    ],
  },
  {
    title: '10. AI features and estimates',
    intro: [
      'Matching scores, rankings, reach or earnings estimates, and generated text may be produced by automated and AI systems. They are estimates and drafts, provided "as is", may be inaccurate, and are not promises, professional advice, or guarantees of results.',
    ],
  },
  {
    title: '11. Disclaimers and limitation of liability',
    intro: [
      'The Platform is provided "as is" and "as available", without warranties of any kind. Campaign Hubz does not guarantee that you will be matched with brands, selected for campaigns, or earn any amount.',
      'To the maximum extent permitted by law, Campaign Hubz is not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, data, or goodwill. Our total liability for any claim connected with the Platform is limited to the greater of the platform fees you paid us in the 12 months before the claim or USD 100. Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you.',
    ],
  },
  {
    title: '12. Indemnity and disputes',
    bullets: [
      'You will defend, indemnify, and hold Campaign Hubz and its officers, employees, and agents harmless from claims, damages, and expenses (including reasonable legal fees) arising from your content, your use of the Platform, your collaborations, or your breach of these Terms or the law.',
      'Disputes about a collaboration (quality, delivery, payment terms) are between you and the brand. Campaign Hubz may, but is not obliged to, assist, mediate, or decide in good faith how held funds are released, and you release Campaign Hubz from claims arising from disputes with other users.',
    ],
  },
  {
    title: '13. Changes, governing law, and contact',
    bullets: [
      'We may change the Platform or these Terms. Material changes are announced in the Platform or by email, and you may be asked to accept a new version before continuing.',
      'This Agreement is governed by the law and courts set out in the Governing law section of the full Terms of Service, without regard to conflict-of-law rules, and, where permitted, disputes are resolved individually and not as part of a class or representative action.',
      'Mandatory consumer-protection rights in your country of residence are not affected by this Agreement.',
      'Questions about this Agreement can be sent through the contact form on the Campaign Hubz website.',
    ],
  },
];
