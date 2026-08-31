import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Button } from '@heroui/react';
import { motion } from 'motion/react';
import api from '../../lib/api';

/**
 * Login — Campgains Hub brand-aligned sign-in.
 *
 * Two-pane layout:
 *   Left  — Deep Navy panel with signature-gradient atmospheric wash,
 *           original /logo.png, headline, three quick proof rows.
 *   Right — White form pane with hairline inputs and HeroUI primary CTA.
 *
 * Wrapped in `.landing-visitors` so it inherits Fredoka + the Campgains
 * brand palette + the scoped HeroUI accent override.
 */
const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<any>({});
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/public/settings').then((res) => setSettings(res.data)).catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (email && password) {
        const response = await api.post('/auth/login', { email, password });
        if (response.data.error) throw new Error(response.data.error);
        const { access_token, user } = response.data;
        if (access_token) {
          localStorage.setItem('token', access_token);
          localStorage.setItem('role', user.role);
          navigate('/dashboard');
        } else {
          throw new Error('No token received');
        }
      } else {
        throw new Error('Please fill in all fields');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
      setIsLoading(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--color-cool-gray)',
    outline: 'none',
  };

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
        {/* Decorative grid */}
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

        {/* Logo */}
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
            Campgains{' '}
            <span style={{ color: 'var(--color-creator-teal)' }}>Hub</span>
          </span>
        </Link>

        {/* Headline block */}
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
            Welcome back
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
            The platform brands{' '}
            <span
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #ffffff 0%, #c8e1ff 50%, #00d4c7 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              run on.
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
            Sign in to manage your campaigns, review applications, track
            payouts — all in the same console that shipped your last brief.
          </p>
        </motion.div>

        {/* Proof rows */}
        <div className="relative z-10 grid grid-cols-1 gap-3">
          {[
            { icon: ShieldCheck, label: 'SOC-2 compliant', meta: 'Enterprise-grade KYC' },
            { icon: Zap, label: 'Launch in 60 seconds', meta: 'Free forever to start' },
          ].map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.2 + i * 0.08 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  maxWidth: 360,
                }}
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(108,99,255,0.35) 0%, rgba(0,212,199,0.35) 100%)',
                    color: '#fff',
                  }}
                >
                  <Icon size={14} strokeWidth={2} />
                </span>
                <div className="text-left min-w-0">
                  <div
                    className="font-medium truncate"
                    style={{ color: '#fff', fontSize: 13, letterSpacing: '-0.012em' }}
                  >
                    {p.label}
                  </div>
                  <div
                    className="truncate"
                    style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5 }}
                  >
                    {p.meta}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ─── Right: form pane ──────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center px-6 py-10 lg:p-12 v-bg-canvas relative">
        {/* Mobile-only brand mark */}
        <Link to="/" className="lg:hidden self-start inline-flex items-center gap-2 mb-8">
          <img src="/logo.png" alt="Campgains Hub" className="h-7 w-7 object-contain" />
          <span
            className="v-ink font-medium tracking-tight"
            style={{ fontSize: 15, letterSpacing: '-0.018em' }}
          >
            Campgains <span style={{ color: 'var(--color-creator-teal-deep)' }}>Hub</span>
          </span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md my-auto"
        >
          <div className="mb-8">
            <h2 className="v-heading-xl">Welcome back.</h2>
            <p className="mt-3 v-body-lg v-muted">
              Enter your details to sign in.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg v-body"
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

            <div>
              <label
                className="block v-caption v-muted font-medium mb-2"
                style={{ letterSpacing: '-0.012em' }}
              >
                Email address
              </label>
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none v-quiet"
                >
                  <Mail size={16} strokeWidth={1.75} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-3.5 py-3 rounded-lg v-body v-ink"
                  style={fieldStyle}
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  className="v-caption v-muted font-medium"
                  style={{ letterSpacing: '-0.012em' }}
                >
                  Password
                </label>
                <a
                  href="#"
                  className="v-caption font-medium"
                  style={{ color: 'var(--color-campaign-purple)' }}
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none v-quiet"
                >
                  <Lock size={16} strokeWidth={1.75} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-3.5 py-3 rounded-lg v-body v-ink"
                  style={fieldStyle}
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isPending={isLoading}
              className="!rounded-xl !mt-2"
            >
              Sign in <ArrowRight size={16} />
            </Button>
          </form>

          {/* Ticker — quiet trust row */}
          {settings.ticker_enabled === 'true' && settings.ticker_text && (
            <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--color-cool-gray)' }}>
              <p
                className="v-caption v-quiet"
                style={{
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                Trusted by teams shipping culture
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
                {settings.ticker_text
                  .split(/[,·•|]/)
                  .map((s: string) => s.trim())
                  .filter(Boolean)
                  .slice(0, 6)
                  .map((name: string, i: number) => (
                    <span
                      key={i}
                      className="v-body font-medium select-none"
                      style={{ color: 'var(--color-ash)', letterSpacing: '-0.014em' }}
                    >
                      {name}
                    </span>
                  ))}
              </div>
            </div>
          )}

          <div
            className="mt-8 text-center v-body v-muted"
            style={{ borderTop: '1px solid var(--color-cool-gray)', paddingTop: 24 }}
          >
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium"
              style={{ color: 'var(--color-campaign-purple)' }}
            >
              Sign up
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
