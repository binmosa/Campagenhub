import React, { useEffect, useMemo, useState } from 'react';
import { Check, DollarSign, FileText, Link2, MessageSquare, Send, Shield, Sparkles } from 'lucide-react';
import { Button, Chip, Label, Modal, Switch } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatBudget } from '../../lib/campaignFormat';
import { CURRENCIES, PAYMENT_FREQUENCIES, hasPaymentDay } from '../../lib/catalog';
import { Notice } from '../../components/common/Notice';
import { accentFor, fieldClass, type Talent } from './shared';

/**
 * InvitationModal — brand/manager invites a creator or manager with a
 * message, an optional video pitch, payment terms, the contract, and
 * (for creators) permission grants. One scrollable HeroUI dialog, sections
 * in the order the recipient reads them.
 */
const PERMISSIONS = ['can_add_campaigns', 'can_view_analytics', 'can_manage_applications'] as const;
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

export const InvitationModal: React.FC<{
  talent: Talent;
  isOpen: boolean;
  type: 'creator_collab' | 'manager_assign';
  onClose: () => void;
}> = ({ talent, isOpen, type, onClose }) => {
  const { t } = useTranslation();
  const role = localStorage.getItem('role') || '';
  const isCreatorInvite = type === 'creator_collab';
  const name = talent.full_name || talent.username || t(isCreatorInvite ? 'talent.creatorFallback' : 'talent.managerFallback');
  const accent = accentFor(String(talent.id || name));

  const [message, setMessage] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [contract, setContract] = useState('');
  const [generating, setGenerating] = useState(false);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [day, setDay] = useState('1');
  const [currency, setCurrency] = useState('USD');
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setMessage(t('invite.defaultMessage', { name }));
    setVideoLink('');
    setContract('');
    setAmount('');
    setFrequency('monthly');
    setDay('1');
    setCurrency('USD');
    setPerms({});
    setSent(false);
    setError('');
  }, [isOpen, name, t]);

  const amountNum = Number(amount);
  const receiverId = talent.user?.id || talent.user_id || (isCreatorInvite ? talent.id : undefined);

  const generateContract = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/contracts/generate', {
        type,
        talent_name: name,
        amount: amountNum > 0 ? amountNum : undefined,
        frequency,
        currency,
      });
      const text = res.data?.content || res.data?.contract;
      if (!text) throw new Error('empty');
      setContract(text);
    } catch (e: any) {
      setError(e?.response?.data?.message || t('wizard.errAi'));
    } finally {
      setGenerating(false);
    }
  };

  const send = async () => {
    if (!receiverId) return setError(t('invite.errReceiver'));
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) return setError(t('apps.errAmount'));
    if (videoLink.trim() && !URL_RE.test(videoLink.trim())) return setError(t('wizard.errMediaUrl'));
    setSending(true);
    setError('');
    try {
      await api.post('/invitations', {
        receiver_id: receiverId,
        type,
        message: message.trim(),
        contract_content: contract,
        payment_amount: amountNum,
        payment_frequency: frequency,
        payment_day: hasPaymentDay(frequency) ? Number(day) : 1,
        currency,
        permissions: isCreatorInvite ? perms : undefined,
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
    return `${formatBudget(amountNum, currency)} · ${freq}${hasPaymentDay(frequency) ? ` · ${t('apps.dayN', { n: Number(day) })}` : ''}`;
  }, [amountNum, currency, frequency, day, t]);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && !sending && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-3 min-w-0">
                <span className="v-story-ring" style={{ padding: 2 }}>
                  {talent.avatar_url ? (
                    <img src={talent.avatar_url} alt="" className="h-9 w-9 object-cover" />
                  ) : (
                    <span className="inline-flex h-9 w-9 items-center justify-center text-sm font-medium text-white" style={{ background: accent.from }}>
                      {name[0]?.toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate" style={{ fontSize: 16 }}>{t('invite.title', { name })}</span>
                  <span className="block v-caption v-quiet font-normal" style={{ fontSize: 11.5 }}>
                    {isCreatorInvite ? t('invite.subtitleCreator') : t('invite.subtitleManager')}
                  </span>
                </span>
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="max-h-[68vh] overflow-y-auto">
              <div className="space-y-6">
                {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
                {role === 'manager' && <Notice tone="info">{t('invite.managerNote')}</Notice>}

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

                <Section icon={<DollarSign size={11} />} title={t('invite.payment')}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label={t('wizard.currency')}>
                      <select className={fieldClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('apps.amount')} required>
                      <input type="number" min={0} step="0.01" inputMode="decimal" className={fieldClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
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
                  <div
                    className="mt-3 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap"
                    style={{ background: 'linear-gradient(135deg, rgba(22,199,132,0.10) 0%, rgba(0,212,199,0.12) 100%)', border: '1px solid rgba(22,199,132,0.20)' }}
                  >
                    <span className="v-caption font-medium" style={{ color: '#0b6e3e', fontSize: 11.5 }}>{t('invite.termsPreview')}</span>
                    <span className="font-medium tabular-nums" style={{ color: '#0b6e3e', fontSize: 14 }}>{termsPreview || '—'}</span>
                  </div>
                </Section>

                <Section icon={<FileText size={11} />} title={t('invite.contract')}>
                  <Field
                    label={t('wizard.contract')}
                    hint={
                      <button type="button" onClick={generateContract} disabled={generating} className="inline-flex items-center gap-1 font-medium disabled:opacity-50" style={{ color: 'var(--color-campaign-purple)' }}>
                        <Sparkles size={11} /> {generating ? t('wizard.generating') : t('wizard.generateAi')}
                      </button>
                    }
                  >
                    <textarea
                      className={`${fieldClass} resize-y min-h-[120px] font-mono`}
                      style={{ fontSize: 12.5, lineHeight: 1.55 }}
                      rows={5}
                      value={contract}
                      onChange={(e) => setContract(e.target.value)}
                      placeholder={t('invite.contractPh')}
                    />
                  </Field>
                </Section>

                {isCreatorInvite && (
                  <Section icon={<Shield size={11} />} title={t('invite.permissions')}>
                    <p className="v-caption v-quiet mb-2" style={{ fontSize: 11.5 }}>{t('invite.permissionsHint')}</p>
                    <div className="flex flex-col gap-1.5">
                      {PERMISSIONS.map((k) => (
                        <Switch key={k} isSelected={!!perms[k]} onChange={(v) => setPerms((p) => ({ ...p, [k]: v }))}>
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                          <Switch.Content>
                            <Label className="text-sm">{t(`team.perm.${k}`)}</Label>
                          </Switch.Content>
                        </Switch>
                      ))}
                    </div>
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
                  <Button variant="primary" onPress={send} isPending={sending}>
                    <Send size={13} /> {t('invite.send')}
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
