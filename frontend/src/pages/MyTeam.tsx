import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  Check,
  DollarSign,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  SearchX,
  Star,
  Trash2,
  Users,
  Briefcase,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { AlertDialog, Button, Chip, Label, Switch, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { formatBudget } from '../lib/campaignFormat';
import { CURRENCIES, PAYMENT_FREQUENCIES, hasPaymentDay, monthlyEquivalent } from '../lib/catalog';
import { formatCompact, socialEntries } from '../lib/socialLinks';
import { MetricCard, PageShell } from '../components/ui';
import { EmptyPanel } from '../components/common/EmptyPanel';
import { DashPanel } from '../components/common/DashPanel';
import { StoryAvatar } from '../components/common/StoryAvatar';
import { Notice } from '../components/common/Notice';
import { DirectoryToolbar } from '../components/common/filters';
import PlatformIcon from './landing/mocks/PlatformIcon';
import { PLATFORM_ICON_KEY, accentFor, fieldClass } from './talent/shared';

/**
 * MyTeam — the brand's roster (accepted applicants + accepted invitations):
 * who they are (profile, socials), what they are paid, what they may do.
 * Same story-ring identity as the directory, one shared currency/frequency
 * catalog (the old page silently downgraded `quarterly` to `monthly`).
 */
type Member = {
  id: string;
  member?: {
    id?: string;
    email?: string;
    creatorProfile?: any;
    managerProfile?: any;
  };
  member_type?: 'creator' | 'manager' | string;
  permissions?: Record<string, boolean>;
  grant?: { campaign_limit?: number | null; budget_cap?: number | null; campaigns?: string[] } | null;
  /** Managers only: what they have actually created and committed for this brand. */
  usage?: { campaigns_created: number; budget_used: number };
  payment_amount?: number | string | null;
  payment_frequency?: string;
  currency?: string;
  payment_day?: number;
  joined_at?: string;
};

const PERMISSIONS = ['can_add_campaigns', 'can_view_analytics', 'can_manage_applications'] as const;

const profileOf = (m: Member) => m.member?.creatorProfile || m.member?.managerProfile || {};
const nameOf = (m: Member) => {
  const p = profileOf(m);
  return p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || m.member?.email?.split('@')[0] || '—';
};

/* Hoisted so React keeps the switch mounted between renders. */
const PermissionSwitch: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <Switch isSelected={checked} onChange={onChange}>
    <Switch.Control>
      <Switch.Thumb />
    </Switch.Control>
    <Switch.Content>
      <Label className="text-sm">{label}</Label>
    </Switch.Content>
  </Switch>
);

/* ── One place to manage a member ────────────────────────────────
   The card stays a card: identity and the agreed numbers. Everything
   that changes money or access — pay, duties, spending limits — lives
   in this modal behind one Manage button, and saves in a single pass. */
const SettingsSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  hint?: string;
  tone?: 'plain' | 'grant';
  children: React.ReactNode;
}> = ({ icon, title, hint, tone = 'plain', children }) => (
  <section
    className="rounded-xl p-3.5"
    style={
      tone === 'grant'
        ? { background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.22)' }
        : { background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }
    }
  >
    <div className="v-caption v-quiet font-medium uppercase tracking-wider inline-flex items-center gap-1" style={{ fontSize: 10 }}>
      {icon} {title}
    </div>
    {hint && <p className="v-caption v-quiet mt-1 mb-2.5" style={{ fontSize: 11.5 }}>{hint}</p>}
    <div className={hint ? '' : 'mt-2.5'}>{children}</div>
  </section>
);

const MemberSettingsModal: React.FC<{
  member: Member;
  onClose: () => void;
  onSaved: (msg: string) => void;
}> = ({ member, onClose, onSaved }) => {
  const { t } = useTranslation();
  const isManager = member.member_type === 'manager';
  const name = nameOf(member);
  const grant = member.grant || {};
  const usage = member.usage || { campaigns_created: 0, budget_used: 0 };

  const payWas = member.payment_amount != null ? String(Number(member.payment_amount)) : '';
  const limitWas = grant.campaign_limit == null ? '' : String(grant.campaign_limit);
  const capWas = grant.budget_cap == null ? '' : String(grant.budget_cap);

  const [amount, setAmount] = useState(payWas);
  const [freq, setFreq] = useState(member.payment_frequency || 'monthly');
  const [curr, setCurr] = useState(member.currency || 'USD');
  const [day, setDay] = useState(String(member.payment_day || 1));
  const [perms, setPerms] = useState<Record<string, boolean>>(member.permissions || {});
  const [limit, setLimit] = useState(limitWas);
  const [cap, setCap] = useState(capWas);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const payDirty =
    amount !== payWas ||
    freq !== (member.payment_frequency || 'monthly') ||
    curr !== (member.currency || 'USD') ||
    (hasPaymentDay(freq) && day !== String(member.payment_day || 1));
  const permsDirty = PERMISSIONS.some((k) => !!perms[k] !== !!(member.permissions || {})[k]);
  const grantDirty = limit !== limitWas || cap !== capWas;
  const dirty = payDirty || (isManager && (permsDirty || grantDirty));

  const save = async () => {
    const n = Number(amount);
    if (payDirty && (!amount || !Number.isFinite(n) || n <= 0)) {
      setError(t('apps.errAmount'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (payDirty) {
        await api.patch(`/invitations/team/${member.id}/payment-terms`, {
          payment_amount: n,
          payment_frequency: freq,
          currency: curr,
          payment_day: hasPaymentDay(freq) ? Number(day) : 1,
        });
      }
      if (isManager && permsDirty) await api.patch(`/invitations/team/${member.id}/permissions`, { permissions: perms });
      if (isManager && grantDirty) {
        await api.patch(`/invitations/team/${member.id}/grant`, {
          campaign_limit: limit === '' ? null : Number(limit),
          budget_cap: cap === '' ? null : Number(cap),
        });
      }
      onSaved(t('team.settingsSaved', { name }));
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || t('team.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && !saving && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-xl" data-testid="member-settings">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <span className="v-hero-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                  {isManager ? <ShieldCheck size={15} /> : <Camera size={15} />}
                </span>
                {t('team.settingsTitle', { name })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-3.5">
                <p className="v-body v-muted" style={{ fontSize: 13 }}>
                  {isManager ? t('team.settingsIntroManager') : t('team.settingsIntroCreator')}
                </p>
                {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}

                <SettingsSection icon={<DollarSign size={10} />} title={t('team.payment')}>
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <select className={fieldClass} value={curr} onChange={(e) => setCurr(e.target.value)} aria-label={t('wizard.currency')}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input type="number" min={0} step="0.01" className={fieldClass} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={t('apps.amount')} placeholder="500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <select className={fieldClass} value={freq} onChange={(e) => setFreq(e.target.value)} aria-label={t('apps.frequency')}>
                      {PAYMENT_FREQUENCIES.map((f) => (
                        <option key={f} value={f}>{t(`apps.freq.${f}`)}</option>
                      ))}
                    </select>
                    <select
                      className={fieldClass}
                      value={day}
                      onChange={(e) => setDay(e.target.value)}
                      aria-label={t('apps.paymentDay')}
                      disabled={!hasPaymentDay(freq)}
                      style={!hasPaymentDay(freq) ? { opacity: 0.5 } : undefined}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{t('apps.dayN', { n: d })}</option>
                      ))}
                    </select>
                  </div>
                </SettingsSection>

                {isManager ? (
                  <>
                    <SettingsSection icon={<ShieldCheck size={10} />} title={t('team.duties')} hint={t('team.dutiesHint')}>
                      <div className="flex flex-col gap-1.5">
                        {PERMISSIONS.map((k) => (
                          <PermissionSwitch key={k} label={t(`invite.duty.${k}`)} checked={!!perms[k]} onChange={(v) => setPerms((p) => ({ ...p, [k]: v }))} />
                        ))}
                      </div>
                    </SettingsSection>

                    <SettingsSection icon={<ShieldCheck size={10} />} title={t('team.grant')} hint={t('team.grantHint')} tone="grant">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="member-limit" className="v-caption v-ink font-medium block mb-1" style={{ fontSize: 11.5 }}>{t('team.campaignLimit')}</label>
                          <input id="member-limit" type="number" min={0} className={fieldClass} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={t('team.unlimited')} />
                          <p className="v-caption v-quiet mt-1" style={{ fontSize: 11 }}>{t('team.campaignLimitHint')}</p>
                        </div>
                        <div>
                          <label htmlFor="member-cap" className="v-caption v-ink font-medium block mb-1" style={{ fontSize: 11.5 }}>{t('team.budgetCap')}</label>
                          <input id="member-cap" type="number" min={0} step="0.01" className={fieldClass} value={cap} onChange={(e) => setCap(e.target.value)} placeholder={t('team.unlimited')} />
                          <p className="v-caption v-quiet mt-1" style={{ fontSize: 11 }}>{t('team.budgetCapHint')}</p>
                        </div>
                      </div>
                      <p className="v-caption v-quiet mt-2.5" style={{ fontSize: 11.5 }}>
                        {t('team.grantUsed', { campaigns: usage.campaigns_created, budget: formatBudget(usage.budget_used, 'USD') })}
                        {' · '}
                        {t('team.campaignsAssigned', { count: (grant.campaigns || []).length })}
                      </p>
                    </SettingsSection>
                  </>
                ) : (
                  <SettingsSection icon={<Camera size={10} />} title={t('team.creatorRole')}>
                    <p className="v-caption v-ink" style={{ fontSize: 12 }}>{t('team.creatorRoleHint')}</p>
                    <Link to="/dashboard/workspace" className="inline-block mt-2">
                      <Button variant="tertiary" size="sm">
                        <Briefcase size={11} /> {t('ops.ws.assign')}
                      </Button>
                    </Link>
                  </SettingsSection>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={saving}>{t('common.cancel')}</Button>
              <Button variant="primary" onPress={save} isPending={saving} isDisabled={!dirty}>
                <Check size={13} /> {t('team.saveChanges')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Managers asking to run one of your campaigns ────────────────── */
const AcceptOfferModal: React.FC<{ offer: any; onClose: () => void; onDone: (msg: string) => void; onError: (msg: string) => void }> = ({ offer, onClose, onDone, onError }) => {
  const { t } = useTranslation();
  const [limit, setLimit] = useState('1');
  const [cap, setCap] = useState(offer?.campaign?.budget != null ? String(Number(offer.campaign.budget)) : '');
  const [fee, setFee] = useState(offer?.proposed_fee != null ? String(Number(offer.proposed_fee)) : '');
  const [currency, setCurrency] = useState(offer?.currency || 'USD');
  const [frequency, setFrequency] = useState(offer?.fee_frequency || 'one_time');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const managerName = offer?.manager?.managerProfile?.full_name || offer?.manager?.email?.split('@')[0] || '';

  const accept = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/manager-applications/${offer.id}/decide`, {
        action: 'accept',
        campaign_limit: limit === '' ? null : Number(limit),
        budget_cap: cap === '' ? null : Number(cap),
        permissions: { can_add_campaigns: true, can_manage_applications: true, can_view_analytics: true },
        payment_amount: fee ? Number(fee) : undefined,
        currency,
        payment_frequency: frequency,
      });
      onDone(t('team.offerAccepted', { name: managerName, title: offer?.campaign?.title || '' }));
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || t('team.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && !saving && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <span className="v-hero-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                  <ShieldCheck size={15} />
                </span>
                {t('team.acceptTitle', { name: managerName })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <p className="v-body v-muted" style={{ fontSize: 13 }}>{t('team.acceptIntro', { name: managerName, title: offer?.campaign?.title || '' })}</p>
                {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
                {offer?.pitch && (
                  <div className="rounded-xl p-3 v-body v-ink whitespace-pre-wrap" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)', fontSize: 13 }}>
                    {offer.pitch}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="grant-limit" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('team.campaignLimit')}</label>
                    <input id="grant-limit" type="number" min={0} className={fieldClass} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={t('team.unlimited')} />
                    <p className="v-caption v-quiet mt-1" style={{ fontSize: 11 }}>{t('team.campaignLimitHint')}</p>
                  </div>
                  <div>
                    <label htmlFor="grant-cap" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('team.budgetCap')}</label>
                    <input id="grant-cap" type="number" min={0} step="0.01" className={fieldClass} value={cap} onChange={(e) => setCap(e.target.value)} placeholder={t('team.unlimited')} />
                    <p className="v-caption v-quiet mt-1" style={{ fontSize: 11 }}>{t('team.budgetCapHint')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-[100px_1fr_150px] gap-3">
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('wizard.currency')}</label>
                    <select className={fieldClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="grant-fee" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('team.managerFee')}</label>
                    <input id="grant-fee" type="number" min={0} step="0.01" className={fieldClass} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="500" />
                  </div>
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.frequency')}</label>
                    <select className={fieldClass} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                      {PAYMENT_FREQUENCIES.map((f) => (
                        <option key={f} value={f}>{t(`apps.freq.${f}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('team.acceptNote')}</p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={saving}>{t('common.cancel')}</Button>
              <Button variant="primary" onPress={accept} isPending={saving}>
                <Check size={13} /> {t('team.acceptGrant')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

const ManagerOffersPanel: React.FC<{ onChanged: (msg: string) => void; onError: (msg: string) => void }> = ({ onChanged, onError }) => {
  const { t } = useTranslation();
  const [offers, setOffers] = useState<any[]>([]);
  const [accepting, setAccepting] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get('/manager-applications', { params: { status: 'pending' } })
      .then((res) => setOffers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setOffers([]));
  }, []);
  useEffect(load, [load]);

  const reject = async (offer: any) => {
    setBusy(offer.id);
    try {
      await api.patch(`/manager-applications/${offer.id}/decide`, { action: 'reject' });
      onChanged(t('team.offerDeclined'));
      load();
    } catch (e: any) {
      onError(e?.response?.data?.message || t('team.saveFailed'));
    } finally {
      setBusy(null);
    }
  };

  if (offers.length === 0) return null;
  return (
    <>
      <DashPanel icon={<Send size={15} />} title={t('team.offersTitle')} meta={t('team.offersN', { count: offers.length })}>
        <p className="v-caption v-quiet mb-2.5" style={{ fontSize: 12 }}>{t('team.offersHint')}</p>
        <ul className="divide-y divide-border">
          {offers.map((o) => {
            const name = o.manager?.managerProfile?.full_name || o.manager?.email?.split('@')[0] || '';
            return (
              <li key={o.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" data-testid="manager-offer">
                <StoryAvatar src={o.manager?.managerProfile?.avatar_url} name={name} seed={o.manager?.id || name} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{name}</div>
                  <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                    {t('team.wantsToManage', { title: o.campaign?.title || '' })}
                    {o.proposed_fee ? ` · ${formatBudget(Number(o.proposed_fee), o.currency || 'USD')}` : ''}
                  </div>
                  {o.pitch && <div className="v-caption v-quiet line-clamp-1" style={{ fontSize: 11.5 }}>“{o.pitch}”</div>}
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" className="!text-danger" isPending={busy === o.id} onPress={() => reject(o)}>
                    {t('team.decline')}
                  </Button>
                  <Button variant="primary" size="sm" onPress={() => setAccepting(o)}>
                    <Check size={11} /> {t('team.reviewAccept')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </DashPanel>
      {accepting && (
        <AcceptOfferModal
          offer={accepting}
          onClose={() => setAccepting(null)}
          onDone={(msg) => {
            onChanged(msg);
            load();
          }}
          onError={onError}
        />
      )}
    </>
  );
};

/* ── A member at a glance ────────────────────────────────────────
   Identity, the agreed money, and (for a manager) the two limits that
   govern them. Anything editable is one click away in the modal. */
const MemberCard: React.FC<{
  member: Member;
  index: number;
  onManage: (m: Member) => void;
  onRemove: (m: Member) => void;
}> = ({ member, index, onManage, onRemove }) => {
  const { t } = useTranslation();
  const isManager = member.member_type === 'manager';
  const name = nameOf(member);
  const profile = profileOf(member);
  const accent = accentFor(String(member.member?.id || name));
  const links = socialEntries(profile.social_links).slice(0, 4);
  const grant = member.grant || {};
  const usage = member.usage || { campaigns_created: 0, budget_used: 0 };
  const dutiesOn = PERMISSIONS.filter((k) => !!(member.permissions || {})[k]).length;

  return (
    <article className="v-talent-card v-card-in p-4 flex flex-col" style={{ animationDelay: `${(index % 12) * 28}ms` }} data-testid="team-member">
      <div className="flex items-start gap-3">
        <span className="v-story-ring">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" loading="lazy" className="h-11 w-11 object-cover" />
          ) : (
            <span className="inline-flex h-11 w-11 items-center justify-center text-base font-medium text-white" style={{ background: accent.from }}>
              {name[0]?.toUpperCase()}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="v-ink font-medium truncate" style={{ fontSize: 15, letterSpacing: '-0.015em' }}>{name}</h3>
          <div className="mt-0.5 flex items-center gap-1.5 v-caption v-quiet" style={{ fontSize: 11.5 }}>
            <span className="truncate">{member.member?.email}</span>
            {profile.location && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-0.5 truncate">
                  <MapPin size={10} className="shrink-0" /> {profile.location}
                </span>
              </>
            )}
          </div>
        </div>
        <Chip color={isManager ? 'accent' : 'success'} variant="soft" size="sm" className="shrink-0">
          {isManager ? <ShieldCheck size={10} /> : <Camera size={10} />}
          <Chip.Label>{isManager ? t('team.roleManager') : t('team.roleCreator')}</Chip.Label>
        </Chip>
      </div>

      {/* socials for a creator, what they cover for a manager */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        {links.length > 0 ? (
          links.map((l) => (
            <a key={l.id} className="v-social-chip" href={l.url || undefined} target="_blank" rel="noreferrer" title={l.label}>
              <span className="inline-flex" style={{ color: l.color }}>
                <PlatformIcon platform={PLATFORM_ICON_KEY[l.id]} size={13} />
              </span>
              {l.followers ? (
                <span className="v-ink font-medium tabular-nums" style={{ fontSize: 11 }}>{formatCompact(l.followers)}</span>
              ) : null}
            </a>
          ))
        ) : (
          <span className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
            {profile.category || profile.specialty || t('team.noSocials')}
          </span>
        )}
      </div>

      {/* the agreed numbers — read-only here */}
      <div className="mt-3.5 rounded-xl p-3" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="v-caption v-quiet font-medium uppercase tracking-wider inline-flex items-center gap-1" style={{ fontSize: 10 }}>
            <DollarSign size={10} /> {t('team.payment')}
          </span>
          {member.payment_amount ? (
            <span className="inline-flex items-baseline gap-1 min-w-0">
              <span className="font-medium tabular-nums" style={{ fontSize: 16, letterSpacing: '-0.018em', color: '#0b6e3e' }}>
                {formatBudget(member.payment_amount, member.currency || 'USD')}
              </span>
              <span className="v-caption v-quiet truncate" style={{ fontSize: 11 }}>
                / {t(`apps.freq.${member.payment_frequency || 'monthly'}`, { defaultValue: member.payment_frequency })}
              </span>
            </span>
          ) : (
            <span className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('team.notSet')}</span>
          )}
        </div>

        {isManager && (
          <div className="mt-2.5 pt-2.5 border-t border-border grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <div className="v-caption v-quiet uppercase tracking-wider" style={{ fontSize: 9.5 }}>{t('team.colCampaigns')}</div>
              <div className="v-ink font-medium tabular-nums truncate" style={{ fontSize: 12.5 }}>
                {grant.campaign_limit == null
                  ? t('team.usedNoLimit', { used: usage.campaigns_created })
                  : t('team.usedOf', { used: usage.campaigns_created, limit: grant.campaign_limit })}
              </div>
            </div>
            <div className="min-w-0">
              <div className="v-caption v-quiet uppercase tracking-wider" style={{ fontSize: 9.5 }}>{t('team.colBudget')}</div>
              <div className="v-ink font-medium tabular-nums truncate" style={{ fontSize: 12.5 }}>
                {grant.budget_cap == null
                  ? t('team.usedNoLimit', { used: formatBudget(usage.budget_used, 'USD') })
                  : t('team.usedOf', { used: formatBudget(usage.budget_used, 'USD'), limit: formatBudget(grant.budget_cap, 'USD') })}
              </div>
            </div>
          </div>
        )}
      </div>

      {isManager && (
        <p className="v-caption v-quiet mt-2" style={{ fontSize: 11 }}>
          {t('team.dutiesOn', { count: dutiesOn, total: PERMISSIONS.length })}
        </p>
      )}

      <div className="flex-1" style={{ minHeight: 12 }} aria-hidden />
      <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {member.member?.id && (
            <Link to={`/dashboard/messages?newId=${member.member.id}&name=${encodeURIComponent(name)}`}>
              <Button variant="ghost" size="sm">
                <MessageSquare size={12} /> {t('apps.message')}
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="sm" className="!text-danger" onPress={() => onRemove(member)}>
            <Trash2 size={12} /> {t('team.remove')}
          </Button>
        </div>
        <Button variant="primary" size="sm" onPress={() => onManage(member)}>
          <Pencil size={12} /> {t('team.manage')}
        </Button>
      </div>
    </article>
  );
};

const MyTeam: React.FC = () => {
  const { t } = useTranslation();
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'all' | 'creator' | 'manager'>('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null);
  const [managing, setManaging] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    setError(false);
    api
      .get('/invitations/team')
      .then((res) => setTeam(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const counts = useMemo(
    () => ({
      all: team.length,
      creator: team.filter((m) => m.member_type === 'creator').length,
      manager: team.filter((m) => m.member_type === 'manager').length,
    }),
    [team],
  );
  const monthly = useMemo(() => {
    // Rough monthly commitment in USD-equivalent is not computable without FX;
    // show per-currency totals instead.
    const byCur = new Map<string, number>();
    for (const m of team) {
      const n = Number(m.payment_amount) || 0;
      if (!n) continue;
      const perMonth = monthlyEquivalent(n, m.payment_frequency);
      if (!perMonth) continue; // one-time payments are not a monthly commitment
      const c = m.currency || 'USD';
      byCur.set(c, (byCur.get(c) || 0) + perMonth);
    }
    return [...byCur.entries()].map(([c, v]) => formatBudget(Math.round(v), c)).join(' + ') || '—';
  }, [team]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return team.filter((m) => {
      if (filter !== 'all' && m.member_type !== filter) return false;
      if (q && !`${nameOf(m)} ${m.member?.email || ''} ${profileOf(m).category || ''} ${profileOf(m).specialty || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [team, filter, search]);

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await api.delete(`/invitations/team/${pendingRemove.id}`);
      setNotice({ tone: 'success', text: t('team.removed', { name: nameOf(pendingRemove) }) });
      setPendingRemove(null);
      load();
    } catch (e: any) {
      setNotice({ tone: 'error', text: e?.response?.data?.message || t('team.saveFailed') });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('team.title')}
      titleAccent={t('team.titleAccent')}
      description={t('team.desc')}
      icon={<Users size={18} />}
      actions={
        <Link to="/dashboard/talent">
          <Button variant="primary" size="md">
            <Plus size={14} /> {t('team.recruit')}
          </Button>
        </Link>
      }
      stats={
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label={t('team.kpiMembers')} value={counts.all} icon={Users} />
          <MetricCard label={t('team.kpiCreators')} value={counts.creator} hint={t('team.kpiManagersN', { n: counts.manager })} icon={Star} />
          <MetricCard label={t('team.kpiMonthly')} value={monthly} hint={t('team.kpiMonthlyHint')} icon={DollarSign} />
        </div>
      }
    >
      {notice && <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice>}

      <ManagerOffersPanel onChanged={(text) => { setNotice({ tone: 'success', text }); load(); }} onError={(text) => setNotice({ tone: 'error', text })} />

      <DirectoryToolbar
        leading={
          <Segment size="sm" selectedKey={filter} onSelectionChange={(k) => setFilter(k as typeof filter)} aria-label="Member type">
            <Segment.Item id="all">{t('dash.all')} · {counts.all}</Segment.Item>
            <Segment.Item id="creator">{t('talent.tabCreators')} · {counts.creator}</Segment.Item>
            <Segment.Item id="manager">{t('talent.tabManagers')} · {counts.manager}</Segment.Item>
          </Segment>
        }
        search={{ value: search, onChange: setSearch, placeholder: t('talent.searchPh'), widthClass: 'w-full sm:w-[240px]' }}
        count={loading ? t('common.searching') : t('board.count', { shown: visible.length, total: team.length })}
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="v-talent-card p-4" aria-hidden>
              <div className="flex items-start gap-3">
                <div className="v-skel h-12 w-12 !rounded-full shrink-0" />
                <div className="flex-1 pt-1">
                  <div className="v-skel h-4 w-1/2 mb-2" />
                  <div className="v-skel h-3 w-3/4" />
                </div>
              </div>
              <div className="v-skel h-16 w-full mt-4" />
              <div className="v-skel h-20 w-full mt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyPanel tone="error" icon={<AlertTriangle size={22} />} title={t('board.errTitle')} description={t('board.errDesc')} actions={<Button variant="primary" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>} />
      ) : team.length === 0 ? (
        <EmptyPanel
          icon={<Users size={22} />}
          title={t('dash.noTeamTitle')}
          description={t('dash.noTeamDesc')}
          actions={
            <>
              <Link to="/dashboard/talent">
                <Button variant="primary">
                  <Star size={13} /> {t('dash.browseTalent')}
                </Button>
              </Link>
              <Link to="/dashboard/applications">
                <Button variant="tertiary">{t('dash.openInbox')}</Button>
              </Link>
            </>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyPanel size="sm" icon={<SearchX size={20} />} title={t('board.emptyTitle')} description={t('board.emptyStatus')} actions={<Button variant="primary" size="sm" onPress={() => { setFilter('all'); setSearch(''); }}>{t('board.resetFilters')}</Button>} />
      ) : (
        <div className="space-y-6">
          {(['manager', 'creator'] as const).map((kind) => {
            const rows = visible.filter((m) => (m.member_type === 'manager') === (kind === 'manager'));
            if (rows.length === 0) return null;
            return (
              <section key={kind}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="v-hero-icon" style={{ width: 28, height: 28, borderRadius: 9 }}>
                    {kind === 'manager' ? <ShieldCheck size={14} /> : <Camera size={14} />}
                  </span>
                  <div className="min-w-0">
                    <h2 className="v-ink font-medium" style={{ fontSize: 15, letterSpacing: '-0.012em' }}>
                      {kind === 'manager' ? t('team.groupManagers') : t('team.groupCreators')}
                    </h2>
                    <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>
                      {kind === 'manager' ? t('team.groupManagersHint') : t('team.groupCreatorsHint')}
                    </p>
                  </div>
                  <span className="v-caption v-quiet tabular-nums ml-auto" style={{ fontSize: 11.5 }}>{rows.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {rows.map((m, i) => (
                    <MemberCard key={m.id} member={m} index={i} onManage={setManaging} onRemove={setPendingRemove} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {managing && (
        <MemberSettingsModal
          member={managing}
          onClose={() => setManaging(null)}
          onSaved={(text) => { setNotice({ tone: 'success', text }); load(); }}
        />
      )}

      <AlertDialog isOpen={!!pendingRemove} onOpenChange={(open) => !open && !removing && setPendingRemove(null)}>
        <AlertDialog.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger">
                  <AlertTriangle size={18} />
                </AlertDialog.Icon>
                <AlertDialog.Heading>{t('team.removeTitle')}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>{t('team.removeBody', { name: pendingRemove ? nameOf(pendingRemove) : '' })}</AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="ghost" isDisabled={removing} onPress={() => setPendingRemove(null)}>{t('common.cancel')}</Button>
                <Button variant="danger" isPending={removing} onPress={confirmRemove}>
                  <Trash2 size={13} /> {t('team.remove')}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </PageShell>
  );
};

export default MyTeam;
