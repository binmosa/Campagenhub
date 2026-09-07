import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useNoIndex } from '../../lib/seo';
import api from '../../lib/api';
import { Notice } from '../../components/common/Notice';
import { AuthShell, authFieldClass, authFieldStyle } from './AuthShell';

/**
 * ResetPassword — the other end of the emailed link. The token and address
 * ride in the query string; the server decides whether they are still good,
 * so this page only checks what it can tell the person before they submit.
 */
const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  useNoIndex();
  const navigate = useNavigate();
  const { token, email } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return { token: params.get('token') || '', email: params.get('email') || '' };
  }, []);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 8 && confirm === password && !!token && !!email;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { email, token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('auth.resetFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!token || !email) {
    return (
      <AuthShell title={t('auth.resetTitle')}>
        <div className="flex flex-col gap-4">
          <Notice tone="error">{t('auth.resetBadLink')}</Notice>
          <Link to="/forgot-password" className="v-caption font-medium" style={{ color: 'var(--color-campaign-purple)' }}>
            {t('auth.sendResetLink')}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle', { email })}>
      {done ? (
        <div className="flex flex-col gap-4">
          <Notice tone="success">{t('auth.resetDone')}</Notice>
          <Link to="/login" className="v-caption font-medium inline-flex items-center gap-1.5" style={{ color: 'var(--color-campaign-purple)' }}>
            <ArrowLeft size={14} /> {t('auth.backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
          <div>
            <label htmlFor="new-password" className="v-caption v-muted font-medium block mb-1.5">
              {t('auth.newPassword')}
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet" aria-hidden />
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                className={authFieldClass}
                style={{ ...authFieldStyle, paddingLeft: 38 }}
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                placeholder={t('auth.passwordPh')}
              />
            </div>
            {tooShort && <p className="v-caption mt-1" style={{ fontSize: 12, color: 'var(--color-signal-red, #d33)' }}>{t('auth.passwordTooShort')}</p>}
          </div>
          <div>
            <label htmlFor="confirm-password" className="v-caption v-muted font-medium block mb-1.5">
              {t('auth.confirmPassword')}
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet" aria-hidden />
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                className={authFieldClass}
                style={{ ...authFieldStyle, paddingLeft: 38 }}
                value={confirm}
                onChange={(ev) => setConfirm(ev.target.value)}
                placeholder={t('auth.passwordPh')}
              />
            </div>
            {mismatch && <p className="v-caption mt-1" style={{ fontSize: 12, color: 'var(--color-signal-red, #d33)' }}>{t('auth.passwordMismatch')}</p>}
          </div>
          <Button type="submit" variant="primary" size="lg" isPending={saving} isDisabled={!canSubmit} fullWidth>
            {t('auth.setNewPassword')}
          </Button>
          <Link to="/login" className="v-caption font-medium inline-flex items-center gap-1.5" style={{ color: 'var(--color-campaign-purple)' }}>
            <ArrowLeft size={14} /> {t('auth.backToLogin')}
          </Link>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPassword;
