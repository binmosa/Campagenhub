import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useNoIndex } from '../../lib/seo';
import api from '../../lib/api';
import { Notice } from '../../components/common/Notice';
import { AuthShell, authFieldClass, authFieldStyle } from './AuthShell';

/**
 * ForgotPassword — asks for the address, then says the same thing either
 * way. Whether a link was actually sent is deliberately not revealed:
 * this form would otherwise tell a stranger which addresses hold accounts.
 */
const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  useNoIndex();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err: any) {
      const status = err?.response?.status;
      setError(status === 429 ? t('auth.resetTooMany') : t('auth.resetFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      {sent ? (
        <div className="flex flex-col gap-4">
          <Notice tone="success">{t('auth.resetSent', { email: email.trim() })}</Notice>
          <p className="v-caption v-muted" style={{ fontSize: 13 }}>{t('auth.resetSentHint')}</p>
          <Link to="/login" className="v-caption font-medium inline-flex items-center gap-1.5" style={{ color: 'var(--color-campaign-purple)' }}>
            <ArrowLeft size={14} /> {t('auth.backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
          <div>
            <label htmlFor="reset-email" className="v-caption v-muted font-medium block mb-1.5">
              {t('auth.emailLabel')}
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet" aria-hidden />
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                className={authFieldClass}
                style={{ ...authFieldStyle, paddingLeft: 38 }}
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder={t('auth.emailPh')}
              />
            </div>
          </div>
          <Button type="submit" variant="primary" size="lg" isPending={sending} isDisabled={!email.trim()} fullWidth>
            {t('auth.sendResetLink')}
          </Button>
          <p className="v-caption v-quiet inline-flex items-start gap-1.5" style={{ fontSize: 12 }}>
            <ShieldCheck size={13} className="shrink-0 mt-0.5" /> {t('auth.resetPrivacy')}
          </p>
          <Link to="/login" className="v-caption font-medium inline-flex items-center gap-1.5" style={{ color: 'var(--color-campaign-purple)' }}>
            <ArrowLeft size={14} /> {t('auth.backToLogin')}
          </Link>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPassword;
