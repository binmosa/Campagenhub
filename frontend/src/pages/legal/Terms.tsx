import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage, { LegalSection } from './LegalPage';

/**
 * Terms of Service — v1.
 * Written to protect the platform: intermediary status, user-to-user
 * contracts, payment-processor dependency, AI-output disclaimers,
 * anti-circumvention, liability caps.
 */
const Terms: React.FC = () => (
  <LegalPage
    title="Terms of Service"
    updated="September 1, 2026"
    intro={
      <p>
        These Terms of Service (the “Terms”) govern your access to and use of the
        Campgains Hub platform, websites, and services (the “Platform”), operated
        by Campgains Hub Inc. (“CampaignHub”, “we”, “us”). By creating an account
        or using the Platform you agree to these Terms. If you do not agree, do
        not use the Platform.
      </p>
    }
  >
    <LegalSection title="1. Who may use the Platform">
      <p>
        You must be at least 18 years old and able to form a binding contract to
        use the Platform. If you use the Platform on behalf of a company or other
        entity, you represent that you are authorized to bind that entity, and
        “you” includes that entity.
      </p>
    </LegalSection>

    <LegalSection title="2. What the Platform is (and is not)">
      <p>
        CampaignHub is a marketplace that connects brands, content creators, and
        talent managers for marketing collaborations. We provide discovery,
        matching, communication, contract-drafting, payment-facilitation, and
        tracking tools.
      </p>
      <p>
        <strong className="v-ink">We are an intermediary only.</strong> Collaboration
        agreements are entered into directly between users (for example, between a
        brand and a creator). CampaignHub is not a party to those agreements, is
        not an employer, agency, broker, or guarantor of any user, and does not
        guarantee the quality, safety, legality, or outcome of any campaign,
        content, or collaboration, nor that any user will find matches, work, or
        results.
      </p>
    </LegalSection>

    <LegalSection title="3. Accounts">
      <p>
        You agree to provide accurate, current information when registering and to
        keep it updated — including, for creators, your platform links, audience
        location, and follower counts. You are responsible for all activity under
        your account and for keeping your credentials secure. We may decline,
        suspend, or reclaim usernames and accounts that are misleading,
        infringing, or inactive.
      </p>
    </LegalSection>

    <LegalSection title="4. Creator responsibilities">
      <ul className="list-disc pl-5 space-y-2">
        <li>Provide truthful profile data, including genuine follower counts. Artificially inflated metrics (purchased followers, engagement pods, bots) are prohibited.</li>
        <li>Deliver content that is original, complies with the brief you accepted, and does not infringe third-party rights.</li>
        <li>Comply with advertising-disclosure rules that apply to you (for example, clearly labeling sponsored content with #ad or equivalent).</li>
        <li>Comply with the terms of the social platforms on which you publish.</li>
      </ul>
    </LegalSection>

    <LegalSection title="5. Brand responsibilities">
      <ul className="list-disc pl-5 space-y-2">
        <li>Publish briefs that are lawful, accurate, and for genuine campaigns.</li>
        <li>Fund agreed budgets through the Platform and review submitted work within a reasonable time.</li>
        <li>Do not request content that is illegal, deceptive, or that violates the policies of the target social platforms.</li>
      </ul>
    </LegalSection>

    <LegalSection title="6. Campaigns, applications, and contracts">
      <p>
        Applying to a campaign is an offer to collaborate; a collaboration exists
        only when a brand accepts an application or an invitation is accepted.
        The resulting contract is between the users involved.
      </p>
      <p>
        The Platform can generate draft contracts and other documents, including
        with AI assistance. <strong className="v-ink">These drafts are templates
        provided for convenience only — they are not legal advice, and
        CampaignHub does not warrant that they are complete, accurate, or
        enforceable in your jurisdiction.</strong> Review them (with your own
        counsel where appropriate) before relying on them.
      </p>
    </LegalSection>

    <LegalSection title="7. Payments, escrow, and fees">
      <ul className="list-disc pl-5 space-y-2">
        <li>Payments are processed by third-party payment providers (currently including Flutterwave, PayPal, and Telebirr). Your use of those providers is subject to their own terms, and CampaignHub is not responsible for their acts, omissions, or outages.</li>
        <li>Where escrow-style handling is offered, campaign budgets are held and released according to the campaign flow (for example, on acceptance and delivery). Release timing may depend on the payment provider.</li>
        <li>CampaignHub may charge platform or service fees, which will be shown before you commit to a transaction and may change on notice.</li>
        <li>You are solely responsible for any taxes, levies, or reporting obligations that arise from amounts you pay or receive.</li>
        <li>Chargebacks, refunds, and payment disputes are handled per the applicable provider’s rules; we may suspend accounts involved in payment abuse.</li>
      </ul>
    </LegalSection>

    <LegalSection title="8. Content and intellectual property">
      <p>
        You retain ownership of content you create. You grant CampaignHub a
        worldwide, non-exclusive, royalty-free license to host, store, reproduce,
        display, and distribute content you submit to the Platform (profiles,
        briefs, pitches, submissions) for the purposes of operating, promoting,
        and improving the Platform. Usage rights in delivered campaign content as
        between a brand and a creator are governed by their agreement, not by
        these Terms.
      </p>
      <p>
        The Platform, including its software, design, and branding, is owned by
        CampaignHub or its licensors. If you send us feedback, we may use it
        without restriction or compensation.
      </p>
    </LegalSection>

    <LegalSection title="9. Prohibited conduct">
      <ul className="list-disc pl-5 space-y-2">
        <li>Misrepresenting your identity, metrics, or affiliation; impersonating others.</li>
        <li><strong className="v-ink">Circumventing the Platform</strong> — using it to find a counterparty and then moving the transaction off-platform to avoid fees or protections.</li>
        <li>Scraping, harvesting, or bulk-extracting Platform data; reverse engineering; interfering with security or rate limits.</li>
        <li>Posting content that is unlawful, infringing, deceptive, hateful, or sexually exploitative, or that targets minors.</li>
        <li>Uploading malware or using the Platform to spam or defraud.</li>
      </ul>
    </LegalSection>

    <LegalSection title="10. AI features">
      <p>
        Matching scores, applicant rankings, performance predictions, payout and
        reach estimates, and generated text (captions, pitches, contracts,
        analyses) may be produced by automated and AI systems.
        <strong className="v-ink"> They are estimates and drafts, provided “as is”,
        may be inaccurate, and are not promises, professional advice, or
        guarantees of results.</strong> You are responsible for decisions you make
        based on them.
      </p>
    </LegalSection>

    <LegalSection title="11. Third-party services">
      <p>
        The Platform links to and interoperates with third-party services (social
        media platforms, Telegram, payment providers). We do not control them and
        are not responsible for their content, policies, or availability.
      </p>
    </LegalSection>

    <LegalSection title="12. Verification and suspension">
      <p>
        We may require identity or business verification (KYC) at any time and
        may limit features until it is completed. We may suspend or terminate
        accounts, remove content, or cancel campaigns at our discretion where we
        reasonably believe these Terms, the law, or the safety of the Platform is
        at risk. Where funds are held for a suspended account, we may retain them
        until the underlying issue is resolved or as the payment provider and
        applicable law require.
      </p>
    </LegalSection>

    <LegalSection title="13. Disclaimers">
      <p>
        THE PLATFORM IS PROVIDED “AS IS” AND “AS AVAILABLE”, WITHOUT WARRANTIES OF
        ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
        PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
        PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY
        USER-PROVIDED INFORMATION (INCLUDING FOLLOWER COUNTS) IS ACCURATE.
      </p>
    </LegalSection>

    <LegalSection title="14. Limitation of liability">
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, CAMPAIGNHUB WILL NOT BE LIABLE FOR
        ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
        FOR LOST PROFITS, REVENUE, DATA, OR GOODWILL. OUR TOTAL LIABILITY FOR ANY
        CLAIM ARISING FROM THE PLATFORM IS LIMITED TO THE GREATER OF (A) THE
        PLATFORM FEES YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM, OR (B) USD
        100. SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS, SO PARTS OF THIS
        SECTION MAY NOT APPLY TO YOU.
      </p>
    </LegalSection>

    <LegalSection title="15. Indemnification">
      <p>
        You will defend, indemnify, and hold harmless CampaignHub and its
        officers, employees, and agents from claims, damages, and expenses
        (including reasonable legal fees) arising from your content, your use of
        the Platform, your collaborations with other users, or your breach of
        these Terms or applicable law.
      </p>
    </LegalSection>

    <LegalSection title="16. Disputes between users">
      <p>
        Disputes about a collaboration (quality, delivery, payment terms) are
        between the users involved. We may — but are not obligated to — assist,
        mediate, or make a determination regarding escrowed funds in good faith,
        and you release CampaignHub from claims arising out of disputes with
        other users.
      </p>
    </LegalSection>

    <LegalSection title="17. Changes to the Platform and these Terms">
      <p>
        We may modify or discontinue features at any time. We may update these
        Terms; material changes will be notified through the Platform or by
        email, and continued use after the effective date constitutes acceptance.
      </p>
    </LegalSection>

    <LegalSection title="18. Governing law and disputes with us">
      <p>
        These Terms are governed by the laws of the jurisdiction in which
        Campgains Hub Inc. is incorporated, without regard to conflict-of-law
        rules. Any dispute with CampaignHub will be brought in the courts of that
        jurisdiction, and where permitted, resolved on an individual basis and
        not as part of a class or representative action.
      </p>
    </LegalSection>

    <LegalSection title="19. Contact">
      <p>
        Questions about these Terms? Reach us through the{' '}
        <Link to="/#contact" className="v-link" style={{ color: 'var(--color-campaign-purple)' }}>
          contact form
        </Link>
        .
      </p>
    </LegalSection>
  </LegalPage>
);

export default Terms;
