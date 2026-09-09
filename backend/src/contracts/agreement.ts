/**
 * buildAgreement — the plain-text collaboration agreement a brand sends
 * when it accepts an application. Everything a lawyer would look for
 * first is on the page: who the parties are (names + account emails),
 * what the campaign is, what gets delivered, what is paid and how, rights,
 * termination, and how acceptance is recorded. The brand can edit the text
 * before sending; the creator accepts, declines or counters.
 */
export interface AgreementInput {
  brand: { company: string; contact?: string | null; email: string; country?: string | null };
  creator: { name: string; email: string; country?: string | null };
  campaign: {
    title: string;
    description?: string | null;
    platform?: string | null;
    content_type?: string | null;
    deadline?: string | Date | null;
    script_required?: boolean | null;
    contract_template?: string | null;
  };
  terms: { amount: number; currency: string; frequency: string; day?: number | null; ends_at?: string | null };
  notes?: string | null;
  date?: Date;
}

const FREQ_TEXT: Record<string, string> = {
  one_time: 'as a one-time fee',
  daily: 'per day',
  weekly: 'per week',
  monthly: 'per month',
  quarterly: 'per quarter',
  yearly: 'per year',
};
const PERIOD_TEXT: Record<string, string> = { monthly: 'month', quarterly: 'quarter', yearly: 'year' };

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const money = (amount: number, currency: string) =>
  `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const trim = (s: string | null | undefined, max: number) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

export const buildAgreement = (i: AgreementInput): string => {
  const date = i.date || new Date();
  const freq = String(i.terms.frequency || 'one_time');
  const period = PERIOD_TEXT[freq];
  const payLine = `${money(i.terms.amount, i.terms.currency)} ${FREQ_TEXT[freq] || 'per ' + freq}${
    period && i.terms.day ? `, paid on day ${i.terms.day} of each ${period}` : ''
  }`;
  const deadline = i.campaign.deadline ? fmtDate(new Date(i.campaign.deadline)) : '';
  const brandLine = [i.brand.company, i.brand.contact ? `represented by ${i.brand.contact}` : '', i.brand.email, i.brand.country]
    .filter(Boolean)
    .join(', ');
  const creatorLine = [i.creator.name, i.creator.email, i.creator.country].filter(Boolean).join(', ');

  const sections: string[] = [];
  sections.push(`COLLABORATION AGREEMENT\nCampaign: "${i.campaign.title}"\nPrepared on Campaign Hubz · ${fmtDate(date)}`);
  sections.push(`1. PARTIES\nBrand: ${brandLine} ("Brand").\nCreator: ${creatorLine} ("Creator").`);

  const del: string[] = [`Campaign: ${i.campaign.title}`];
  if (i.campaign.description) del.push(`Brief: ${trim(i.campaign.description, 700)}`);
  const fmt = [i.campaign.platform ? `Platform(s): ${i.campaign.platform}` : '', i.campaign.content_type ? `Format: ${i.campaign.content_type}` : '']
    .filter(Boolean)
    .join(' · ');
  if (fmt) del.push(fmt);
  if (deadline) del.push(`Deadline: ${deadline}`);
  if (i.campaign.script_required) del.push('The Creator must follow the script / key messages provided in the brief.');
  del.push(
    'The Creator will produce and publish the content described in the brief, submit the links on Campaign Hubz, and apply reasonable feedback from the Brand before publishing.',
  );
  sections.push(`2. CAMPAIGN & DELIVERABLES\n${del.join('\n')}`);

  const pay: string[] = [
    `Fee: ${payLine}.`,
    "Payment is made through Campaign Hubz. The Brand funds the campaign escrow and payouts are released to the Creator's payout account once the deliverables are submitted and approved.",
  ];
  if (i.notes && i.notes.trim()) pay.push(`Additional terms: ${i.notes.trim()}`);
  sections.push(`3. COMPENSATION\n${pay.join('\n')}`);

  sections.push(
    `4. CONTENT RIGHTS\nThe Creator keeps ownership of the content. The Brand receives a non-exclusive, worldwide licence to reshare and promote the delivered content on its own channels for 12 months from publication. Paid amplification or any other use needs written agreement between the parties.`,
  );
  sections.push(
    `5. APPROVALS, DISCLOSURE & CONDUCT\nContent follows the brief and the applicable advertising disclosure rules (for example #ad or "paid partnership"). Up to two rounds of reasonable revisions are included. Both parties keep campaign details and compensation confidential.`,
  );
  const endsAt = i.terms.ends_at ? fmtDate(new Date(i.terms.ends_at)) : '';
  sections.push(
    `6. TERM & TERMINATION\nThis agreement starts when both parties have accepted it on Campaign Hubz${
      endsAt ? ` and ends on ${endsAt}, when the recurring fee stops and the contract closes automatically` : ' and runs until the deliverables are approved and paid'
    }. Either party may end it earlier with 14 days' written notice through Campaign Hubz. Work delivered and approved before termination is paid in full.`,
  );
  if (i.campaign.contract_template && i.campaign.contract_template.trim()) {
    sections.push(`7. BRAND TERMS (from the campaign brief)\n${i.campaign.contract_template.trim()}`);
  }
  sections.push(
    `${i.campaign.contract_template && i.campaign.contract_template.trim() ? 8 : 7}. ACCEPTANCE\nThis agreement is accepted digitally on Campaign Hubz. Each party's acceptance is recorded against their account email with a timestamp, and the recorded terms bind both parties. Either party may propose different terms before accepting; nothing is binding until both have accepted. Disputes are handled under the Campaign Hubz Terms of Service.`,
  );
  return sections.join('\n\n');
};

/** Text appended when a counter-offer changes the money after the agreement was drafted. */
export const amendmentText = (d: { amount: number; currency: string; frequency: string; day?: number | null; ends_at?: string | null; by: 'brand' | 'creator'; date?: Date }) => {
  const period = PERIOD_TEXT[String(d.frequency)];
  return `AMENDMENT — ${fmtDate(d.date || new Date())}\nCompensation changed to ${money(d.amount, d.currency)} ${FREQ_TEXT[String(d.frequency)] || 'per ' + d.frequency}${
    period && d.day ? `, paid on day ${d.day} of each ${period}` : ''
  }${d.ends_at ? `, running until ${fmtDate(new Date(d.ends_at))}` : ''}. Proposed by the ${d.by === 'creator' ? 'Creator' : 'Brand'} and accepted by the ${d.by === 'creator' ? 'Brand' : 'Creator'} on Campaign Hubz; this amendment replaces section 3 (Compensation).`;
};

export interface AddendumInput {
  brand: { company: string; email: string };
  creator: { name: string; email: string };
  campaign: { title: string };
  mainAcceptedOn?: string | Date | null;
  title: string;
  scope?: string | null;
  tasks?: { title: string; platform?: string; due_days?: number; description?: string }[] | null;
  terms: { amount: number; currency: string; frequency: string; day?: number | null; ends_at?: string | null };
  notes?: string | null;
  date?: Date;
}

/** An extra-work proposal on top of a signed agreement — accepted or declined on its own. */
export const buildAddendum = (i: AddendumInput): string => {
  const date = i.date || new Date();
  const freq = String(i.terms.frequency || 'one_time');
  const period = PERIOD_TEXT[freq];
  const payLine = `${money(i.terms.amount, i.terms.currency)} ${FREQ_TEXT[freq] || 'per ' + freq}${period && i.terms.day ? `, paid on day ${i.terms.day} of each ${period}` : ''}`;
  const endsAt = i.terms.ends_at ? fmtDate(new Date(i.terms.ends_at)) : '';
  const accepted = i.mainAcceptedOn ? ` accepted on ${fmtDate(new Date(i.mainAcceptedOn))}` : '';
  const sections: string[] = [];
  sections.push(`ADDENDUM — EXTRA WORK\nTo the Collaboration Agreement for "${i.campaign.title}"${accepted}\nBetween ${i.brand.company} (${i.brand.email}) and ${i.creator.name} (${i.creator.email}) · Prepared on Campaign Hubz · ${fmtDate(date)}`);
  sections.push(`1. SCOPE\n${i.title}${i.scope && i.scope.trim() ? `\n${trim(i.scope, 1500)}` : ''}`);
  const tasks = (i.tasks || []).filter((t) => t && t.title);
  if (tasks.length) {
    sections.push(
      `2. DELIVERABLES\n${tasks
        .map((t, n) => `${n + 1}. ${t.title}${t.platform ? ` — ${t.platform}` : ''}${t.due_days ? ` — due ${t.due_days} day${t.due_days === 1 ? '' : 's'} after acceptance` : ''}${t.description ? `\n   ${trim(t.description, 300)}` : ''}`)
        .join('\n')}`,
    );
  }
  const pay: string[] = [`Fee for this extra work: ${payLine}, in addition to the fees in the main agreement.`, "Payment is made through Campaign Hubz and released to the Creator's payout account once the deliverables are submitted and approved."];
  if (i.notes && i.notes.trim()) pay.push(`Additional terms: ${i.notes.trim()}`);
  sections.push(`${tasks.length ? 3 : 2}. COMPENSATION\n${pay.join('\n')}`);
  sections.push(`${tasks.length ? 4 : 3}. TERM\nThis addendum starts when both parties have accepted it on Campaign Hubz${endsAt ? ` and ends on ${endsAt}` : ' and runs until the deliverables are approved and paid'}. It ends automatically if the main agreement ends.`);
  sections.push(`${tasks.length ? 5 : 4}. OTHER TERMS\nAll other clauses of the main agreement — content rights, approvals and disclosure, confidentiality, termination — apply to this extra work unchanged.`);
  sections.push(`${tasks.length ? 6 : 5}. ACCEPTANCE\nThis addendum is accepted digitally on Campaign Hubz and recorded against each party's account email with a timestamp. The Creator may accept, decline, or propose different terms; nothing here is binding until both parties have accepted. The main agreement is not changed by declining this addendum.`);
  return sections.join('\n\n');
};
