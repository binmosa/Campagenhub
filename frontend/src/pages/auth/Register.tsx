import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Camera,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@heroui/react';
import { AnimatePresence, motion } from 'motion/react';
import api from '../../lib/api';

/**
 * Register — Campgains Hub simplified onboarding.
 *
 * Two-step flow:
 *   1. Role + email + password + essential role-specific profile fields → submit.
 *   2. Telegram connect (optional notification channel) → dashboard.
 *
 * Identity verification (KYC) is intentionally deferred. New accounts start
 * `active` and the user can use the platform straight away. If an admin
 * flips `kyc_required=true` on the user, they'll see a banner + a KYC card
 * in their profile prompting them to submit ID + verification video.
 */
const Register: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'creator' | 'brand' | 'manager'>('creator');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  /* Role-specific essentials */
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [tinNumber, setTinNumber] = useState('');

  /* After-register telegram connect token */
  const [telegramToken, setTelegramToken] = useState('');
  const navigate = useNavigate();

  const handleRegisterSubmit = async () => {
    if (!email || !password || password !== confirmPassword || password.length < 8) {
      setError('Please fill all account details correctly. Passwords must match and be at least 8 characters.');
      return;
    }
    if ((role === 'creator' || role === 'manager') && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (role === 'brand' && !companyName.trim()) {
      setError('Please enter your company name.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const profile =
        role === 'creator'
          ? { full_name: fullName }
          : role === 'brand'
          ? {
              company_name: companyName,
              contact_person: contactPerson,
              contact_email: email,
              tin_number: tinNumber,
            }
          : { full_name: fullName };

      const response = await api.post('/auth/register', {
        email,
        password,
        role,
        profile,
      });
      if (response.data.error) throw new Error(response.data.error);

      // Backend returns `{ access_token, user }` from login() — store and continue.
      const accessToken = response.data?.access_token;
      const returnedRole = response.data?.user?.role || role;
      if (accessToken) {
        localStorage.setItem('token', accessToken);
        localStorage.setItem('role', returnedRole);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      }
      setTelegramToken(response.data?.user?.telegram_connect_token || '');
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--color-cool-gray)',
    outline: 'none',
  };
  const fieldClass = 'w-full px-3.5 py-3 rounded-lg v-body v-ink';

  return (
    <div className="landing-visitors min-h-screen flex flex-col lg:flex-row">
      {/* ─── Left: brand panel ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden p-12 flex-col justify-between"
        style={{
          background:
            'radial-gradient(120% 90% at 80% 0%, rgba(108,99,255,0.55) 0%, rgba(79,124,255,0.30) 40%, rgba(0,212,199,0.22) 75%, transparent 100%), var(--color-deep-navy)',
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage:
              'radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 80%)',
          }}
        />

        <Link to="/" className="relative z-10 inline-flex items-center gap-2 self-start">
          <img
            src="/logo.png"
            alt="Campgains Hub"
            className="h-9 w-9 object-contain"
            style={{ filter: 'drop-shadow(0 1px 6px rgba(108,99,255,0.40))' }}
          />
          <span
            className="font-medium tracking-tight"
            style={{ color: '#fff', fontSize: 16, letterSpacing: '-0.018em' }}
          >
            Campgains <span style={{ color: 'var(--color-creator-teal)' }}>Hub</span>
          </span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-lg"
        >
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <Sparkles size={11} />
            Get started in seconds
          </span>
          <h1
            className="mt-6 font-medium"
            style={{
              color: '#fff',
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              lineHeight: 1.08,
              letterSpacing: '-0.025em',
            }}
          >
            Join the network.{' '}
            <span
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #ffffff 0%, #c8e1ff 50%, #00d4c7 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Start instantly.
            </span>
          </h1>
          <p
            className="mt-5"
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 17,
              lineHeight: 1.55,
              letterSpacing: '-0.012em',
            }}
          >
            Create your account in a few seconds and start using Campgains Hub.
            We'll ask you to verify your identity later — only if it's needed.
          </p>
        </motion.div>

        <div className="relative z-10 max-w-sm">
          <p
            className="v-caption mb-3"
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Onboarding progress
          </p>
          <div className="space-y-2">
            {[
              { n: 1, label: 'Account & profile' },
              { n: 2, label: 'Connect Telegram (optional)' },
            ].map((s) => {
              const active = step === s.n;
              const done = step > s.n;
              return (
                <div key={s.n} className="flex items-center gap-3">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0"
                    style={{
                      background: done
                        ? 'var(--color-signal-green)'
                        : active
                        ? 'linear-gradient(135deg, #6c63ff 0%, #00d4c7 100%)'
                        : 'rgba(255,255,255,0.06)',
                      color: done || active ? '#fff' : 'rgba(255,255,255,0.4)',
                      border:
                        done || active ? 'none' : '1px solid rgba(255,255,255,0.10)',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {done ? '✓' : s.n}
                  </span>
                  <span
                    style={{
                      color: active || done ? '#fff' : 'rgba(255,255,255,0.45)',
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                      letterSpacing: '-0.012em',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Right: form pane ──────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center px-6 py-10 lg:p-12 v-bg-canvas relative overflow-y-auto">
        <div className="lg:hidden w-full max-w-md mb-6 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/logo.png" alt="Campgains Hub" className="h-7 w-7 object-contain" />
            <span
              className="v-ink font-medium tracking-tight"
              style={{ fontSize: 15, letterSpacing: '-0.018em' }}
            >
              Campgains <span style={{ color: 'var(--color-creator-teal-deep)' }}>Hub</span>
            </span>
          </Link>
          <span
            className="v-caption v-quiet font-medium"
            style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}
          >
            Step {step} / 2
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md my-auto"
        >
          <div className="flex items-center gap-2 mb-7">
            {[1, 2].map((s) => (
              <div
                key={s}
                className="flex-1 h-1 rounded-full overflow-hidden"
                style={{ background: 'var(--color-cool-gray)' }}
              >
                <motion.div
                  className="h-full"
                  initial={{ width: 0 }}
                  animate={{ width: step >= s ? '100%' : '0%' }}
                  transition={{ duration: 0.4 }}
                  style={{
                    background:
                      s === 2 && step >= 2
                        ? 'var(--color-signal-green)'
                        : 'linear-gradient(90deg, #6c63ff 0%, #00d4c7 100%)',
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mb-6">
            <h2 className="v-heading-xl">
              {step === 1 ? 'Create your account.' : "You're all set."}
            </h2>
            <p className="mt-3 v-body-lg v-muted">
              {step === 1
                ? 'A few essentials and you can start using the platform.'
                : 'Optionally connect Telegram so we can notify you about new opportunities.'}
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg v-body mb-5"
                style={{
                  background: 'rgba(255,90,95,0.08)',
                  border: '1px solid rgba(255,90,95,0.22)',
                  color: '#c5363a',
                  fontWeight: 500,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0 animate-pulse"
                  style={{ background: '#ff5a5f' }}
                />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── STEP 1: Role + credentials + essential profile ─── */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-5"
            >
              <div>
                <label
                  className="v-caption v-muted font-medium mb-2 block"
                  style={{ letterSpacing: '-0.012em' }}
                >
                  I'm joining as a…
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['creator', 'brand', 'manager'] as const).map((r) => {
                    const active = role === r;
                    const Icon = r === 'brand' ? Briefcase : r === 'creator' ? Camera : Users;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className="relative py-3 px-2 rounded-xl flex flex-col items-center gap-1.5"
                        style={{
                          background: active ? 'var(--color-soft-lavender)' : 'var(--color-paper)',
                          border: `1px solid ${active ? '#d6dbe8' : 'var(--color-cool-gray)'}`,
                          color: active
                            ? 'var(--color-campaign-purple)'
                            : 'var(--color-graphite)',
                          transition: 'background 200ms, border-color 200ms, color 200ms',
                        }}
                      >
                        <Icon size={18} strokeWidth={1.75} />
                        <span
                          className="font-medium capitalize"
                          style={{ fontSize: 12, letterSpacing: '-0.012em' }}
                        >
                          {r}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                  placeholder="Email address"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                  placeholder="Password (min 8 chars)"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                  placeholder="Confirm password"
                />
              </div>

              <div className="space-y-3">
                {role === 'creator' || role === 'manager' ? (
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                    placeholder="Full name"
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className={fieldClass}
                      style={fieldStyle}
                      placeholder="Company name"
                    />
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className={fieldClass}
                      style={fieldStyle}
                      placeholder="Contact person (optional)"
                    />
                    <input
                      type="text"
                      value={tinNumber}
                      onChange={(e) => setTinNumber(e.target.value)}
                      className={fieldClass}
                      style={fieldStyle}
                      placeholder="Tax ID / TIN (optional)"
                    />
                  </>
                )}
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                isPending={isLoading}
                onPress={handleRegisterSubmit}
                className="!rounded-xl"
              >
                Create account <ArrowRight size={16} />
              </Button>

              <div
                className="mt-3 pt-5 text-center v-body v-muted"
                style={{ borderTop: '1px solid var(--color-cool-gray)' }}
              >
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-medium"
                  style={{ color: 'var(--color-campaign-purple)' }}
                >
                  Sign in
                </Link>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 2: Telegram connect (optional) ─────────────── */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-center"
            >
              <div
                className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg, var(--color-soft-lavender) 0%, rgba(0,212,199,0.18) 100%)',
                  border: '1px solid var(--color-cool-gray)',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-10 h-10"
                  style={{ fill: 'var(--color-campaign-purple)' }}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              </div>
              <h2 className="v-heading-lg">Your account is active.</h2>
              <p className="mt-3 v-body-lg v-muted">
                Optionally connect our Telegram bot so we can ping you about
                new campaign matches and updates. You can skip this and do it
                later from your profile.
              </p>

              {telegramToken && (
                <div
                  className="my-7 p-5 rounded-2xl"
                  style={{
                    background: 'var(--color-paper)',
                    border: '1px solid var(--color-cool-gray)',
                  }}
                >
                  <p
                    className="v-caption v-quiet font-medium mb-3"
                    style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  >
                    Your secure link
                  </p>
                  <a
                    href={`https://t.me/official_CampaignHub_bot?start=${telegramToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium"
                    style={{
                      background: '#0088cc',
                      color: '#fff',
                      fontSize: 14,
                      letterSpacing: '-0.012em',
                      boxShadow: 'rgba(0,136,204,0.30) 0px 6px 16px -4px',
                    }}
                  >
                    Open Telegram & connect <ArrowRight size={14} />
                  </a>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={() => navigate('/dashboard')}
                className="!rounded-xl"
              >
                Go to dashboard <ArrowRight size={14} />
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
