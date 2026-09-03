import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link as LinkIcon, Lock, Mail, Send, Sparkles, Unplug } from 'lucide-react';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { toast } from '../lib/toast';
import { buildTelegramLink, getTelegramBotUsername } from '../lib/telegram';
import { fieldClass } from '../pages/talent/shared';
import { Notice } from './common/Notice';

/**
 * AccountSettings — password, email, Telegram and rewards as four compact
 * panels in a two-column grid (was one tall card of full-width inputs).
 * Every action is a HeroUI Button; feedback is inline via Notice / toast.
 */
const Panel: React.FC<{ icon: React.ReactNode; title: string; desc?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ icon, title, desc, children, className = '' }) => (
  <section className={`v-talent-card p-5 flex flex-col ${className}`}>
    <div className="flex items-start gap-3 mb-4">
      <span className="v-hero-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>{icon}</span>
      <div className="min-w-0">
        <h3 className="v-ink font-medium" style={{ fontSize: 15, letterSpacing: '-0.012em' }}>{title}</h3>
        {desc && <p className="v-caption v-quiet mt-0.5" style={{ fontSize: 12 }}>{desc}</p>}
      </div>
    </div>
    {children}
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="v-caption v-ink font-medium block mb-1" style={{ fontSize: 12 }}>{label}</span>
    {children}
  </label>
);

const AccountSettings: React.FC<{ email?: string }> = ({ email }) => {
  const { t } = useTranslation();

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNotice, setPwNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNotice, setEmailNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Telegram
  const [telegramStatus, setTelegramStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [telegramUser, setTelegramUser] = useState('');
  const [telegramBotLink, setTelegramBotLink] = useState('');
  const [generating, setGenerating] = useState(false);
  const [botUsername, setBotUsername] = useState('');

  // Rewards
  const [points, setPoints] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getTelegramBotUsername().then(setBotUsername);
    checkTelegramStatus();
  }, []);

  const checkTelegramStatus = async () => {
    try {
      const res = await api.get('/telegram/status');
      if (res.data?.connected) {
        setTelegramStatus('connected');
        setTelegramUser(res.data.username || 'User');
        setPoints(res.data.points || 0);
        setReferralCode(res.data.referral_code || '');
      } else {
        setTelegramStatus('disconnected');
      }
    } catch {
      setTelegramStatus('disconnected');
    }
  };

  const generateTelegramToken = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/telegram/generate-token');
      setTelegramBotLink(res.data?.botLink || '');
      if (!res.data?.botLink) toast.error(t('account.tokenFailed'));
    } catch {
      toast.error(t('account.tokenFailed'));
    } finally {
      setGenerating(false);
    }
  };

  const disconnectTelegram = async () => {
    try {
      await api.post('/telegram/disconnect');
      setTelegramStatus('disconnected');
      setTelegramUser('');
      setTelegramBotLink('');
      toast.success(t('account.disconnected'));
    } catch {
      toast.error(t('account.disconnectFailed'));
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setPwNotice({ tone: 'error', text: t('account.pwMismatch') });
    if (newPassword.length < 8) return setPwNotice({ tone: 'error', text: t('account.pwShort') });
    setPwBusy(true);
    setPwNotice(null);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPwNotice({ tone: 'success', text: t('account.pwUpdated') });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwNotice({ tone: 'error', text: err?.response?.data?.message || t('account.pwFailed') });
    } finally {
      setPwBusy(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes('@')) return setEmailNotice({ tone: 'error', text: t('account.emailInvalid') });
    setEmailBusy(true);
    setEmailNotice(null);
    try {
      const res = await api.post('/auth/change-email', { newEmail, currentPassword: emailPassword });
      if (res.data?.access_token) localStorage.setItem('token', res.data.access_token);
      setEmailNotice({ tone: 'success', text: t('account.emailUpdated') });
      setNewEmail('');
      setEmailPassword('');
    } catch (err: any) {
      setEmailNotice({ tone: 'error', text: err?.response?.data?.message || t('account.emailFailed') });
    } finally {
      setEmailBusy(false);
    }
  };

  const referralLink = referralCode && botUsername ? buildTelegramLink(botUsername, `REF_${referralCode}`) : '';
  const copyReferral = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success(t('account.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('account.copyFailed'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Password */}
      <Panel icon={<Lock size={14} />} title={t('account.security')} desc={t('account.securityDesc')}>
        <form onSubmit={handlePasswordChange} className="space-y-3 flex-1 flex flex-col">
          <Field label={t('account.currentPassword')}>
            <input type="password" autoComplete="current-password" className={fieldClass} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('account.newPassword')}>
              <input type="password" autoComplete="new-password" className={fieldClass} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </Field>
            <Field label={t('account.confirmPassword')}>
              <input type="password" autoComplete="new-password" className={fieldClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
            </Field>
          </div>
          {pwNotice && <Notice tone={pwNotice.tone} onDismiss={() => setPwNotice(null)}>{pwNotice.text}</Notice>}
          <div className="flex justify-end pt-1 mt-auto">
            <Button type="submit" variant="primary" size="sm" isPending={pwBusy}>
              <Lock size={12} /> {t('account.updatePassword')}
            </Button>
          </div>
        </form>
      </Panel>

      {/* Email */}
      <Panel icon={<Mail size={14} />} title={t('account.email')} desc={email ? t('account.emailDesc', { email }) : t('account.emailDescNoEmail')}>
        <form onSubmit={handleEmailChange} className="space-y-3 flex-1 flex flex-col">
          <Field label={t('account.newEmail')}>
            <input type="email" autoComplete="email" className={fieldClass} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" required />
          </Field>
          <Field label={t('account.currentPassword')}>
            <input type="password" autoComplete="current-password" className={fieldClass} value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} required />
          </Field>
          {emailNotice && <Notice tone={emailNotice.tone} onDismiss={() => setEmailNotice(null)}>{emailNotice.text}</Notice>}
          <div className="flex justify-end pt-1 mt-auto">
            <Button type="submit" variant="primary" size="sm" isPending={emailBusy}>
              <Mail size={12} /> {t('account.updateEmail')}
            </Button>
          </div>
        </form>
      </Panel>

      {/* Telegram */}
      <Panel icon={<Send size={14} />} title={t('account.telegram')} desc={t('account.telegramDesc')}>
        {telegramStatus === 'loading' ? (
          <div className="space-y-2" aria-hidden>
            <div className="v-skel h-10 w-full" />
          </div>
        ) : telegramStatus === 'connected' ? (
          <div className="rounded-xl p-3.5 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'rgba(22,199,132,0.10)', border: '1px solid rgba(22,199,132,0.28)' }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full v-pulse-dot" style={{ background: 'var(--color-signal-green)' }} />
              <div className="min-w-0">
                <div className="v-ink font-medium" style={{ fontSize: 13 }}>{t('account.connected')}</div>
                <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>{t('account.connectedAs', { user: telegramUser })}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="tertiary" size="sm" isDisabled={!botUsername} onPress={() => botUsername && window.open(buildTelegramLink(botUsername), '_blank')}>
                <ExternalLink size={12} /> {t('account.openBot')}
              </Button>
              <Button variant="ghost" size="sm" className="!text-danger" onPress={disconnectTelegram}>
                <Unplug size={12} /> {t('account.disconnect')}
              </Button>
            </div>
          </div>
        ) : !telegramBotLink ? (
          <div className="flex-1 flex flex-col">
            <p className="v-caption v-muted mb-3" style={{ fontSize: 12 }}>{t('account.notConnected')}</p>
            <div className="mt-auto">
              <Button variant="primary" size="sm" onPress={generateTelegramToken} isPending={generating}>
                <LinkIcon size={12} /> {t('account.connect')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }}>
            <ol className="space-y-2">
              {[t('account.step1'), t('account.step2'), t('account.step3')].map((s, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="v-step" data-state={i === 0 ? 'current' : undefined} style={{ width: 22, height: 22, fontSize: 11 }}>{i + 1}</span>
                  <span className="v-body v-ink" style={{ fontSize: 12.5, paddingTop: 2 }}>{s}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <a href={telegramBotLink} target="_blank" rel="noreferrer">
                <Button variant="primary" size="sm">
                  <ExternalLink size={12} /> {t('account.openBotLink')}
                </Button>
              </a>
              <Button variant="tertiary" size="sm" onPress={checkTelegramStatus}>
                <Check size={12} /> {t('account.verifyConnected')}
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* Rewards */}
      <Panel icon={<Sparkles size={14} />} title={t('account.rewards')} desc={t('account.rewardsDesc')}>
        <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'var(--color-soft-lavender)', border: '1px solid rgba(108,99,255,0.2)', minWidth: 96 }}>
            <div className="v-text-signature font-medium tabular-nums" style={{ fontSize: 26, lineHeight: 1 }}>{points}</div>
            <div className="v-caption v-quiet mt-1" style={{ fontSize: 10.5 }}>{t('account.points')}</div>
          </div>
          <div className="min-w-0">
            <div className="v-ink font-medium" style={{ fontSize: 13 }}>{t('account.referral')}</div>
            <p className="v-caption v-quiet mt-0.5 mb-2" style={{ fontSize: 11.5 }}>{t('account.referralDesc')}</p>
            {referralLink ? (
              <div className="flex items-center gap-1.5">
                <input readOnly value={referralLink} className={`${fieldClass} !py-2 text-xs`} onFocus={(e) => e.currentTarget.select()} />
                <Button variant="tertiary" size="sm" isIconOnly aria-label={t('account.copy')} onPress={copyReferral}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </Button>
              </div>
            ) : (
              <p className="v-caption v-quiet italic" style={{ fontSize: 11.5 }}>
                {telegramStatus === 'connected' ? t('account.referralHint') : t('account.referralNeedsTelegram')}
              </p>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default AccountSettings;
