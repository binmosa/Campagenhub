import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Check, DollarSign, FileText, Link2, ListChecks, MessageSquare, Send, Shield, Sparkles, UserCog } from 'lucide-react';
import { Button, Chip, Label, Modal, Switch } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatBudget } from '../../lib/campaignFormat';
import { CURRENCIES, PAYMENT_FREQUENCIES, hasPaymentDay, parseCampaignTasks } from '../../lib/catalog';
import { Notice } from '../../components/common/Notice';
import { StoryAvatar } from '../../components/common/StoryAvatar';
import { fieldClass, type Talent } from './shared';

/**
 * InvitationModal — three different invitations, one dialog:
 *
 *  - Brand → creator: an invitation to ONE campaign. The brand picks the
 *    brief and the offer; accepting signs the agreement for that brief and
 *    the brief's deliverables become the creator's tasks.
 *  - Brand → manager: hiring an account manager — what they will look
 *    after (which becomes their workspace permissions), a retainer with an
 *    end date, and the management agreement.
 *  - Manager → creator: adding a creator to the manager's roster with the
 *    terms the brand must approve.
 */
const PERMISSIONS = ['can_add_campaigns', 'can_manage_applications', 'can_view_analytics'] as const;
const URL_RE = /^https?:\/\/\S+$/i;

const Field: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; required?: boolean; children: React.ReactNode }> = ({ label, hint, required, children }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5 gap-2">
      <label className="v-caption v-ink font-medium" style={{ fontSize: 12.5 }}>
        {label}
        {required && <span style={{ color: 'var(--color-error-coral)' }}> *</span>}
      </label>
      {hint && <span className="v-caption v-quiet text-right" style={{ fontSize: 11 }}>{hint}</span>}
    </div>
    {children}
  </div>
);

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section>
    <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2.5 inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}>
      {icon} {title}
    </div>
    {children}
  </section>
);

type Variant = 'campaign' | 'manager' | 'roster';

export const InvitationModal: React.FC<{
  talent: Talent;
  isOpen: boolean;
  type: 'creator_collab' | 'manager_assign';
  onClose: () => void;
}> = ({ talent, isOpen, type, onClose }) => {
  const { t } = useTranslation();
  const role = (localStorage.getItem('role') || '').toLowerCase();
  const variant: Variant = type === 'manager_assign' ? 'manager' : role === 'brand' ? 'campaign' : 'roster';
  const name = talent.full_name || talent.username || t(type === 'creator_collab' ? 'talent.creatorFallback' : 'talent.managerFallback');

  const [message, setMessage] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [contract, setContract] = useState('');
  const [scope, setScope] = useState('');
  const [generating, setGenerating] = useState(false);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<string>('one_time');
  const [day, setDay] = useState('1');
  const [currency, setCurrency] = useState('USD');
  const [endsAt, setEndsAt] = useState('');
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setMessage(t(variant === 'campaign' ? 'invite.campaignMessage' : variant === 'manager' ? 'invite.managerMessage' : 'invite.defaultMessage', { name }));
    setVideoLink('');
    setContract('');
    setScope('');
    setAmount('');
    setFrequency(variant === 'manager' ? 'monthly' : 'one_time');
    setDay('1');
    setCurrency('USD');
    setEndsAt('');
    setPerms(variant === 'manager' ? { can_add_campaigns: true, can_manage_applications: true, can_view_analytics: true } : {});
    setCampaignId('');
    setSent(false);
    setError('');
    if (variant === 'campaign') {
      api
        .get('/campaigns/mine')
        .then((res) => {
          const list = (Array.isArray(res.data) ? res.data : []).filter((c: any) => ['active', 'draft'].includes(String(c.status)));
          setCampaigns(list);
          const first = list.find((c: any) => c.status === 'active') || list[0];
          if (first) setCampaignId(first.id);
        })
        .catch(() => setCampaigns([]));
    }
  }, [isOpen, name, t, variant]);

  const campaign = useMemo(() => campaigns.find((c) => c.id === campaignId) || null, [campaigns, campaignId]);
  useEffect(() => {
    if (!campaign) return;
    if (campaign.budget != null && campaign.budget !== '') setAmount(String(Number(campaign.budget)));
    if (campaign.currency) setCurrency(String(campaign.currency).toUpperCase());
  }, [campaign]);

  const amountNum = Number(amount);
  const receiverId = talent.user?.id || talent.user_id || (type === 'creator_collab' ? talent.id : undefined);
  const campaignTasks = useMemo(() => parseCampaignTasks(campaign?.tasks), [campaign]);
  const platforms = String(campaign?.platform || '')
    .split(/[,|]+/)
    .map((x: string) => x.trim())
    .filter(Boolean);

  const generateContract = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/contracts/generate', { type, talent_name: name, amount: amountNum > 0 ? amountNum : undefined, frequency, currency });
      const text = res.data?.content || res.data?.contract;
      if (!text) throw new Error('empty');
      setContract(scope.trim() ? `${text}\n\nSCOPE OF MANAGEMENT\n${scope.trim()}` : text);
    } catch (e: any) {
      setError(e?.response?.data?.message || t('wizard.errAi'));
    } finally {
      setGenerating(false);
    }
  };

  const send = async () => {
    if (!receiverId) return setError(t('invite.errReceiver'));
    if (variant === 'campaign' && !campaignId) return setError(t('invite.errCampaign'));
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) return setError(t('apps.errAmount'));
    if (frequency !== 'one_time' && !endsAt) return setError(t('apps.errEndsAt'));
    if (videoLink.trim() && !URL_RE.test(videoLink.trim())) return setError(t('wizard.errMediaUrl'));
    setSending(true);
    setError('');
    try {
      await api.post('/invitations', {
        receiver_id: receiverId,
        type,
        message: message.trim(),
        contract_content: variant === 'manager' ? contract : undefined,
        payment_amount: amountNum,
        payment_frequency: frequency,
        payment_day: hasPaymentDay(frequency) ? Number(day) : 1,
        currency,
        ends_at: frequency !== 'one_time' ? endsAt : null,
        permissions: variant === 'manager' ? perms : undefined,
        scope: variant === 'manager' ? scope.trim() || undefined : undefined,
        campaign_id: variant === 'campaign' ? campaignId : undefined,
        video_link: videoLink.trim() || undefined,
        ...(role === 'manager' ? { payment_approved: false } : {}),
      });
      setSent(true);
      setTimeout(onClose, 1400);
    } catch (e: any) {
      setError(e?.response?.data?.message || t('invite.errSend'));
    } finally {
      setSending(false);
    }
  };

  const termsPreview = useMemo(() => {
    if (!(amountNum > 0)) return null;
    const freq = t(`apps.freq.${frequency}`, { defaultValue: frequency });
    const base = `${formatBudget(amountNum, currency)} · ${freq}${hasPaymentDay(frequency) ? ` · ${t('apps.dayN', { n: Number(day) })}` : ''}`;
    return frequency !== 'one_time' && endsAt ? `${base} · ${t('contract.until', { date: new Date(endsAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) })}` : base;
  }, [amountNum, currency, frequency, day, endsAt, t]);

  const title = variant === 'campaign' ? t('invite.campaignTitle', { name }) : variant === 'manager' ? t('invite.managerTitle', { name }) : t('invite.rosterTitle', { name });
  const subtitle = variant === 'campaign' ? t('invite.campaignSubtitle') : variant === 'manager' ? t('invite.managerSubtitle') : t('invite.rosterSubtitle');

  const paymentFields = (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label={t('wizard.currency')}>
          <select className={fieldClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label={variant === 'manager' ? t('invite.retainerAmount') : t('apps.amount')} required>
          <input id="invite-amount" type="number" min={0} step="0.01" inputMode="decimal" className={fieldClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
        </Field>
        <Field label={t('apps.frequency')}>
          <select className={fieldClass} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {PAYMENT_FREQUENCIES.map((f) => (
              <option key={f} value={f}>{t(`apps.freq.${f}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('apps.paymentDay')}>
          <select className={fieldClass} value={day} onChange={(e) => setDay(e.target.value)} disabled={!hasPaymentDay(frequency)} style={!hasPaymentDay(frequency) ? { opacity: 0.5 } : undefined}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
      </div>
      {frequency !== 'one_time' && (
        <div className="mt-3">
          <Field label={t('apps.runsUntil', { freq: t(`apps.freq.${frequency}`) })} required hint={t('apps.runsUntilHint')}>
            <input id="invite-ends" type="date" min={new Date().toISOString().slice(0, 10)} className={fieldClass} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
      )}
      <div
        className="mt-3 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: 'linear-gradient(135deg, rgba(22,199,132,0.10) 0%, rgba(0,212,199,0.12) 100%)', border: '1px solid rgba(22,199,132,0.20)' }}
      >
        <span className="v-caption font-medium" style={{ color: '#0b6e3e', fontSize: 11.5 }}>{t('invite.termsPreview')}</span>
        <span className="font-medium tabular-nums" style={{ color: '#0b6e3e', fontSize: 14 }}>{termsPreview || '—'}</span>
      </div>
    </>
  );

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && !sending && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-3 min-w-0">
                <StoryAvatar src={talent.avatar_url} name={name} seed={String(talent.id || name)} size={36} />
                <span className="min-w-0">
                  <span className="block truncate" style={{ fontSize: 16 }}>{title}</span>
                  <span className="block v-caption v-quiet font-normal" style={{ fontSize: 11.5 }}>{subtitle}</span>
                </span>
                <Chip variant="soft" size="sm" color={variant === 'manager' ? 'accent' : 'default'} className="ml-auto shrink-0">
                  {variant === 'manager' ? <UserCog size={10} /> : <Briefcase size={10} />}
                  <Chip.Label>{variant === 'manager' ? t('invite.kindManager') : variant === 'campaign' ? t('invite.kindCampaign') : t('invite.kindRoster')}</Chip.Label>
                </Chip>
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="max-h-[68vh] overflow-y-auto">
              <div className="space-y-6">
                {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
                {role === 'manager' && <Notice tone="info">{t('invite.managerNote')}</Notice>}

                {/* Brand → creator: which brief */}
                {variant === 'campaign' && (
                  <Section icon={<Briefcase size={11} />} title={t('invite.campaign')}>
                    {campaigns.length === 0 ? (
                      <Notice tone="info">{t('invite.campaignNone')}</Notice>
                    ) : (
                      <>
                        <select id="invite-campaign" className={fieldClass} value={campaignId} onChange={(e) => setCampaignId(e.target.value)} aria-label={t('invite.campaign')}>
                          {campaigns.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                              {c.status === 'draft' ? ` · ${t('status.draft')}` : ''}
                            </option>
                          ))}
                        </select>
                        {campaign && (
                          <div className="mt-2.5 rounded-xl p-3 space-y-2" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {campaign.budget != null && (
                                <Chip color="success" variant="soft" size="sm">
                                  <Chip.Label className="tabular-nums">{formatBudget(Number(campaign.budget), campaign.currency || 'USD')} · {t('card.budget')}</Chip.Label>
                                </Chip>
                              )}
                              {platforms.map((p) => (
                                <Chip key={p} variant="soft" size="sm" color="default">
                                  <Chip.Label>{p}</Chip.Label>
                                </Chip>
                              ))}
                              {campaign.deadline && (
                                <Chip variant="soft" size="sm" color="default">
                                  <Chip.Label>{t('invite.deadline', { date: new Date(campaign.deadline).toLocaleDateString(undefined, { dateStyle: 'medium' }) })}</Chip.Label>
                                </Chip>
                              )}
                            </div>
                            {campaignTasks.length > 0 ? (
                              <div>
                                <div className="v-caption v-ink font-medium inline-flex items-center gap-1.5" style={{ fontSize: 12 }}>
                                  <ListChecks size={12} style={{ color: 'var(--color-campaign-purple)' }} /> {t('wizard.tasksN', { count: campaignTasks.length })}
                                </div>
                                <ol className="mt-1 space-y-0.5">
                                  {campaignTasks.slice(0, 5).map((task, i) => (
                                    <li key={task.key} className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                                      {i + 1}. {task.title}{task.platform ? ` · ${task.platform}` : ''}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ) : (
                              <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('invite.noTasksYet')}</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </Section>
                )}

                {/* Brand → manager: what they will look after */}
                {variant === 'manager' && (
                  <Section icon={<Shield size={11} />} title={t('invite.manageWhat')}>
                    <p className="v-caption v-quiet mb-2" style={{ fontSize: 11.5 }}>{t('invite.manageWhatHint')}</p>
                    <div className="flex flex-col gap-1.5">
                      {PERMISSIONS.map((k) => (
                        <Switch key={k} isSelected={!!perms[k]} onChange={(v) => setPerms((p) => ({ ...p, [k]: v }))}>
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                          <Switch.Content>
                            <Label className="text-sm">{t(`invite.duty.${k}`)}</Label>
                          </Switch.Content>
                        </Switch>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Field label={t('invite.scope')} hint={t('wizard.optional')}>
                        <textarea id="invite-scope" className={`${fieldClass} resize-y`} rows={2} value={scope} onChange={(e) => setScope(e.target.value)} placeholder={t('invite.scopePh')} />
                      </Field>
                    </div>
                  </Section>
                )}

                <Section icon={<MessageSquare size={11} />} title={t('invite.message')}>
                  <textarea className={`${fieldClass} resize-y`} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
                  <div className="mt-2.5">
                    <Field label={t('invite.video')} hint={t('wizard.optional')}>
                      <div className="relative">
                        <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet pointer-events-none" />
                        <input className={`${fieldClass} !pl-9`} value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="https://loom.com/share/…" inputMode="url" />
                      </div>
                    </Field>
                  </div>
                </Section>

                <Section icon={<DollarSign size={11} />} title={variant === 'manager' ? t('invite.retainer') : variant === 'campaign' ? t('invite.offer') : t('invite.payment')}>
                  {variant === 'campaign' && <p className="v-caption v-quiet mb-2.5" style={{ fontSize: 11.5 }}>{t('invite.offerHint')}</p>}
                  {paymentFields}
                </Section>

                {variant === 'campaign' && (
                  <Notice tone="info">
                    <span className="inline-flex items-start gap-1.5">
                      <FileText size={13} className="shrink-0 mt-0.5" /> {t('invite.campaignWhatHappens', { name })}
                    </span>
                  </Notice>
                )}

                {variant === 'manager' && (
                  <Section icon={<FileText size={11} />} title={t('invite.agreement')}>
                    <Field
                      label={t('invite.agreementLbl')}
                      hint={
                        <button type="button" onClick={generateContract} disabled={generating} className="inline-flex items-center gap-1 font-medium disabled:opacity-50" style={{ color: 'var(--color-campaign-purple)' }}>
                          <Sparkles size={11} /> {generating ? t('wizard.generating') : t('invite.generate')}
                        </button>
                      }
                    >
                      <textarea className={`${fieldClass} resize-y min-h-[120px]`} style={{ fontSize: 12.5, lineHeight: 1.55 }} rows={5} value={contract} onChange={(e) => setContract(e.target.value)} placeholder={t('invite.agreementPh')} />
                    </Field>
                  </Section>
                )}

                {variant === 'roster' && (
                  <Section icon={<FileText size={11} />} title={t('invite.contract')}>
                    <textarea className={`${fieldClass} resize-y min-h-[100px]`} style={{ fontSize: 12.5, lineHeight: 1.55 }} rows={4} value={contract} onChange={(e) => setContract(e.target.value)} placeholder={t('invite.contractPh')} />
                  </Section>
                )}
              </div>
            </Modal.Body>

            <Modal.Footer>
              {sent ? (
                <Chip color="success" variant="soft" size="md">
                  <Check size={13} />
                  <Chip.Label>{t('invite.sent')}</Chip.Label>
                </Chip>
              ) : (
                <>
                  <Button variant="ghost" onPress={onClose} isDisabled={sending}>{t('common.cancel')}</Button>
                  <Button variant="primary" onPress={send} isPending={sending} isDisabled={variant === 'campaign' && campaigns.length === 0}>
                    <Send size={13} /> {variant === 'manager' ? t('invite.sendManager') : variant === 'campaign' ? t('invite.sendCampaign') : t('invite.send')}
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

export default InvitationModal;
