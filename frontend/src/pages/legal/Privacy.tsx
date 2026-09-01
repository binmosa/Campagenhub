import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage, { LegalSection } from './LegalPage';

/**
 * Privacy Policy — v1.
 * Reflects what the product actually does today: public directories,
 * structured profile data, third-party payment/AI/messaging providers.
 */
const Privacy: React.FC = () => (
  <LegalPage
    title="Privacy Policy"
    updated="September 1, 2026"
    intro={
      <p>
        This Privacy Policy explains how Campgains Hub Inc. (“CampaignHub”,
        “we”, “us”) collects, uses, and shares personal information when you use
        the Campgains Hub platform (the “Platform”). By using the Platform you
        agree to this Policy.
      </p>
    }
  >
    <LegalSection title="1. Information we collect">
      <p><strong className="v-ink">Account information</strong> — email address, password (stored as a salted hash — we never store it in plain text), and your role (creator, brand, or manager).</p>
      <p><strong className="v-ink">Profile information</strong> — for creators: name, username, bio, category, location (country, state, city), avatar, linked social accounts and the follower counts you declare for them, and follower range. For brands: company name, industry/sector, contact person and email, tax/registration number, logo, description, and headquarters location. For managers: name, bio, specialty, experience, and rating.</p>
      <p><strong className="v-ink">Verification (KYC) information</strong> — where verification is required: identity documents and verification media you submit.</p>
      <p><strong className="v-ink">Transaction information</strong> — campaign budgets, applications, invitations, contracts, payout records, and payment references. Card and bank details are collected and processed by our payment providers (currently including Flutterwave, PayPal, and Telebirr) — we do not store full card numbers.</p>
      <p><strong className="v-ink">Content and communications</strong> — briefs, pitches (text and video), messages, reviews, submitted post links, and support requests.</p>
      <p><strong className="v-ink">Technical and usage data</strong> — log data, device and browser information, and how you use the Platform. If you connect Telegram, we store your Telegram chat identifier to send notifications.</p>
    </LegalSection>

    <LegalSection title="2. Profiles and campaigns are public">
      <p>
        The Platform is a marketplace. Creator and manager profiles (including
        name, username, avatar, bio, category, location, linked platforms, and
        follower figures) and active campaigns (including brand name, logo, and
        budget) are <strong className="v-ink">publicly visible</strong> in our
        directories and may appear in search engines. Do not put information in
        a public profile that you are not comfortable making public.
      </p>
    </LegalSection>

    <LegalSection title="3. How we use information">
      <ul className="list-disc pl-5 space-y-2">
        <li>To operate the marketplace: accounts, profiles, discovery, matching, applications, contracts, payments, and payouts.</li>
        <li>To power AI-assisted features (matching scores, rankings, estimates, and generated text) — see Section 4.</li>
        <li>To send service notifications by email and, if connected, Telegram.</li>
        <li>To verify identity, prevent fraud and abuse, enforce our Terms, and keep the Platform safe.</li>
        <li>To comply with legal obligations and to improve the Platform.</li>
      </ul>
    </LegalSection>

    <LegalSection title="4. AI processing">
      <p>
        Some features send relevant data (for example, a campaign brief and
        candidate profile summaries) to third-party AI model providers to
        generate matches, rankings, estimates, or text. We send what the feature
        needs, and we do not authorize these providers to use your data to train
        their models beyond providing the service to us.
      </p>
    </LegalSection>

    <LegalSection title="5. How we share information">
      <ul className="list-disc pl-5 space-y-2">
        <li><strong className="v-ink">With other users</strong> — as inherent to the marketplace (public profiles, applications shown to the brand you applied to, messages with counterparties).</li>
        <li><strong className="v-ink">With service providers</strong> — payment processors, hosting and infrastructure, email delivery, Telegram (for notifications you opt into), and AI providers — each only for the services they perform for us.</li>
        <li><strong className="v-ink">For legal reasons</strong> — to comply with law, enforce our Terms, or protect the rights and safety of users and the Platform.</li>
        <li><strong className="v-ink">In a business transfer</strong> — if CampaignHub is involved in a merger, acquisition, or asset sale, information may transfer as part of that transaction.</li>
      </ul>
      <p>We do not sell your personal information.</p>
    </LegalSection>

    <LegalSection title="6. International transfers">
      <p>
        We and our service providers may process information in countries other
        than yours. Where required, we use appropriate safeguards for such
        transfers.
      </p>
    </LegalSection>

    <LegalSection title="7. Retention">
      <p>
        We keep information for as long as your account is active and as needed
        for the purposes above. Transaction and payout records may be retained
        longer where required for accounting, tax, fraud-prevention, or legal
        reasons.
      </p>
    </LegalSection>

    <LegalSection title="8. Security">
      <p>
        We use administrative and technical safeguards appropriate to the nature
        of the data (including hashed passwords and encrypted transport). No
        system is perfectly secure, and we cannot guarantee absolute security.
      </p>
    </LegalSection>

    <LegalSection title="9. Your choices and rights">
      <ul className="list-disc pl-5 space-y-2">
        <li>You can view and update your profile information at any time from your account.</li>
        <li>Depending on your location, you may have rights to access, correct, delete, or port your personal information, or to object to certain processing. To exercise them, contact us (Section 12).</li>
        <li>You can disconnect Telegram notifications at any time.</li>
        <li>Deleting your account removes your public profile; some records may be retained as described in Section 7.</li>
      </ul>
    </LegalSection>

    <LegalSection title="10. Cookies and local storage">
      <p>
        We use browser local storage to keep you signed in (your session token
        and role) and to remember interface preferences. We do not use
        third-party advertising cookies.
      </p>
    </LegalSection>

    <LegalSection title="11. Children">
      <p>
        The Platform is for users 18 and older. We do not knowingly collect
        information from anyone under 18; if we learn we have, we will delete it.
      </p>
    </LegalSection>

    <LegalSection title="12. Changes and contact">
      <p>
        We may update this Policy; material changes will be notified through the
        Platform or by email, with the “Last updated” date revised above. For
        privacy questions or requests, reach us through the{' '}
        <Link to="/#contact" className="v-link" style={{ color: 'var(--color-campaign-purple)' }}>
          contact form
        </Link>
        .
      </p>
    </LegalSection>
  </LegalPage>
);

export default Privacy;
