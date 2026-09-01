import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Camera,
  ChevronDown,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@heroui/react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useNoIndex } from '../../lib/seo';
import api from '../../lib/api';
import { buildTelegramLink, getTelegramBotUsername } from '../../lib/telegram';
import LocationCascade, { EMPTY_LOCATION, type LocationValue } from '../../components/common/LocationCascade';
import SearchSelect from '../../components/common/SearchSelect';
import PlatformIcon from '../landing/mocks/PlatformIcon';
import { NICHES, PLATFORM_ICON_KEY } from '../talent/shared';
import {
  SOCIAL_PLATFORMS,
  normalizeUrl,
  serializeSocialLinks,
  type SocialMap,
} from '../../lib/socialLinks';

/** Ad goals a brand can register interest in (mirrors campaign objectives). */
const AD_GOALS = ['Awareness', 'Engagement', 'Conversions', 'Content'];

/** The 4 primary handle fields shown at signup (full grid lives in the profile). */
const SIGNUP_SOCIALS = SOCIAL_PLATFORMS.filter((p) =>
  ['instagram', 'tiktok', 'youtube', 'twitter'].includes(p.id),
);

const EXPERIENCE_OPTIONS = [
  { value: '1', tKey: 'auth.exp1' },
  { value: '2', tKey: 'auth.exp2' },
  { value: '3', tKey: 'auth.exp3' },
  { value: '5', tKey: 'auth.exp5' },
  { value: '10', tKey: 'auth.exp10' },
];

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
  const { t } = useTranslation();
  useNoIndex();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'creator' | 'brand' | 'manager'>(() => {
    // Landing-page CTAs deep-link the audience: /register?role=brand etc.
    const param = new URLSearchParams(window.location.search).get('role');
    return param === 'brand' || param === 'manager' || param === 'creator' ? param : 'creator';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  /* Role-specific essentials */
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [tinNumber, setTinNumber] = useState('');

  /* Creator location — dropdown-only (ISO dataset via /api/geo) */
  const [loc, setLoc] = useState<LocationValue>(EMPTY_LOCATION);

  /* Brand essentials — sector powers campaign filtering + matching */
  const [brandSector, setBrandSector] = useState('');
  const [brandExtrasOpen, setBrandExtrasOpen] = useState(false);
  const [brandWebsite, setBrandWebsite] = useState('');
  const [brandGoals, setBrandGoals] = useState<Set<string>>(new Set());
  const [brandSocials, setBrandSocials] = useState<SocialMap>({});

  /* Manager essentials — sectors they want to manage */
  const [mgrSectors, setMgrSectors] = useState<Set<string>>(new Set());
  const [mgrExperience, setMgrExperience] = useState('');

  /* After-register telegram connect token + bot identity (from backend env) */
  const [telegramToken, setTelegramToken] = useState('');
  const [botUsername, setBotUsername] = useState('');
  useEffect(() => {
    getTelegramBotUsername().then(setBotUsername);
  }, []);

  /* Market-aware prefill: a geo-routed visitor (market_home = 'et', …) gets
     their country pre-selected in the location cascade — editable, never
     locked (VPNs, travelers, diaspora). */
  useEffect(() => {
    let home: string | null = null;
    try { home = localStorage.getItem('market_home'); } catch { /* private mode */ }
    if (!home || home === 'root') return;
    const iso = home.toUpperCase();
    api.get('/geo/countries').then((res) => {
      const c = (Array.isArray(res.data) ? res.data : []).find((x: any) => x.iso2 === iso);
      if (c) setLoc((prev) => (prev.country ? prev : { ...EMPTY_LOCATION, country: c.name, countryCode: c.iso2 }));
    }).catch(() => {});
  }, []);
  const navigate = useNavigate();

  const handleRegisterSubmit = async () => {
    if (!email || !password || password !== confirmPassword || password.length < 8) {
      setError(t('auth.errAccount'));
      return;
    }
    if ((role === 'creator' || role === 'manager') && !firstName.trim()) {
      setError(t('auth.errFirstName'));
      return;
    }
    if (role === 'brand' && !companyName.trim()) {
      setError(t('auth.errCompany'));
      return;
    }
    if (role === 'brand' && !brandSector) {
      setError(t('auth.errSector'));
      return;
    }
    if (role === 'creator' && (!loc.country || !loc.city)) {
      setError(t('auth.errLocation'));
      return;
    }
    if (role === 'manager' && mgrSectors.size === 0) {
      setError(t('auth.errMgrSectors'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const profile =
        role === 'creator'
          ? {
              first_name: firstName,
              last_name: lastName,
              country: loc.country,
              country_code: loc.countryCode,
              state: loc.state,
              state_code: loc.stateCode,
              city: loc.city,
              location: `${loc.city}, ${loc.country}`,
            }
          : role === 'brand'
          ? {
              company_name: companyName,
              contact_person: contactPerson,
              contact_email: email,
              tin_number: tinNumber,
              industry: brandSector,
              website: brandWebsite.trim() ? normalizeUrl(brandWebsite) : '',
              objectives: [...brandGoals].join(', '),
              social_links: serializeSocialLinks(brandSocials),
            }
          : {
              first_name: firstName,
              last_name: lastName,
              specialty: [...mgrSectors].join(', '),
              ...(mgrExperience ? { experience_years: Number(mgrExperience) } : {}),
            };

      let signupMarket: string | null = null;
      try { signupMarket = localStorage.getItem('market_home'); } catch { /* private mode */ }

      const response = await api.post('/auth/register', {
        email,
        password,
        role,
        profile,
        language: i18n.language,
        ...(signupMarket ? { signup_market: signupMarket } : {}),
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
      setError(err.response?.data?.message || err.message || t('auth.regFailed'));
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
            {t('auth.getStartedBadge')}
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
            {t('auth.regH1a')}{' '}
            <span
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #ffffff 0%, #c8e1ff 50%, #00d4c7 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {t('auth.regH1b')}
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
            {t('auth.regSub')}
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
            {t('auth.onboardingProgress')}
          </p>
          <div className="space-y-2">
            {[
              { n: 1, label: t('auth.step1') },
              { n: 2, label: t('auth.step2') },
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
            {t('auth.stepOf', { n: step })}
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
              {step === 1 ? t('auth.createTitle') : t('auth.doneTitle')}
            </h2>
            <p className="mt-3 v-body-lg v-muted">
              {step === 1 ? t('auth.createSub') : t('auth.doneSub')}
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
                  {t('auth.joiningAs')}
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
                          className="font-medium"
                          style={{ fontSize: 12, letterSpacing: '-0.012em' }}
                        >
                          {t(r === 'brand' ? 'auth.roleBrand' : r === 'manager' ? 'auth.roleManager' : 'auth.roleCreator')}
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
                  placeholder={t('auth.emailPh')}
                />
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={fieldClass}
                    style={{
                      ...fieldStyle,
                      ...(password && password.length < 8
                        ? { borderColor: 'rgba(255, 90, 95, 0.55)' }
                        : {}),
                    }}
                    placeholder={t('auth.passwordPh')}
                    aria-describedby="password-hint"
                  />
                  {password && password.length < 8 && (
                    <p
                      id="password-hint"
                      className="mt-1.5 v-caption"
                      style={{ color: '#e5484d' }}
                      aria-live="polite"
                    >
                      {t('auth.moreChars', { n: 8 - password.length })}
                    </p>
                  )}
                </div>
                <div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={fieldClass}
                    style={{
                      ...fieldStyle,
                      ...(confirmPassword && confirmPassword !== password
                        ? { borderColor: 'rgba(255, 90, 95, 0.55)' }
                        : confirmPassword && confirmPassword === password
                        ? { borderColor: 'rgba(22, 199, 132, 0.55)' }
                        : {}),
                    }}
                    placeholder={t('auth.confirmPh')}
                    aria-describedby="confirm-hint"
                    aria-invalid={!!confirmPassword && confirmPassword !== password}
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <p
                      id="confirm-hint"
                      className="mt-1.5 v-caption"
                      style={{ color: '#e5484d' }}
                      aria-live="polite"
                    >
                      {t('auth.noMatch')}
                    </p>
                  )}
                  {confirmPassword && password.length >= 8 && confirmPassword === password && (
                    <p
                      id="confirm-hint"
                      className="mt-1.5 v-caption"
                      style={{ color: '#0e9f6a' }}
                      aria-live="polite"
                    >
                      {t('auth.match')}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {role === 'creator' || role === 'manager' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={fieldClass}
                        style={fieldStyle}
                        placeholder={t('auth.firstNamePh')}
                        autoComplete="given-name"
                      />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={fieldClass}
                        style={fieldStyle}
                        placeholder={t('auth.lastNamePh')}
                        autoComplete="family-name"
                      />
                    </div>
                    {role === 'creator' && (
                      <div>
                        <p className="v-caption v-quiet mb-2">
                          {t('auth.whereBased')}
                        </p>
                        <LocationCascade value={loc} onChange={setLoc} layout="stack" />
                      </div>
                    )}

                    {role === 'manager' && (
                      <>
                        {/* Sectors they want to manage */}
                        <div>
                          <p className="v-caption v-quiet mb-1.5">
                            {t('auth.mgrSectorsQ')}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {NICHES.map((n) => {
                              const active = mgrSectors.has(n);
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() =>
                                    setMgrSectors((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(n)) next.delete(n);
                                      else next.add(n);
                                      return next;
                                    })
                                  }
                                  className="v-niche-chip"
                                  data-active={active || undefined}
                                >
                                  {t(`cats.${n}`, { defaultValue: n })}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <p className="v-caption v-quiet mb-1.5">
                            {t('auth.mgrYearsQ')}
                          </p>
                          <select
                            value={mgrExperience}
                            onChange={(e) => setMgrExperience(e.target.value)}
                            className={fieldClass}
                            style={fieldStyle}
                            aria-label="Years of experience"
                          >
                            <option value="">{t('auth.select')}</option>
                            {EXPERIENCE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {t(o.tKey)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <p className="v-caption v-quiet">
                          {t('auth.mgrInviteNote')}
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {/* Essentials — kept above the fold */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className={fieldClass}
                        style={fieldStyle}
                        placeholder={t('auth.companyPh')}
                      />
                      <SearchSelect
                        aria-label="Brand sector"
                        placeholder={t('auth.sectorPh')}
                        options={NICHES.map((n) => ({ value: n, label: t(`cats.${n}`, { defaultValue: n }) }))}
                        value={brandSector}
                        onChange={setBrandSector}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={brandWebsite}
                        onChange={(e) => setBrandWebsite(e.target.value)}
                        className={fieldClass}
                        style={fieldStyle}
                        placeholder={t('auth.websitePh')}
                      />
                      <input
                        type="text"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        className={fieldClass}
                        style={fieldStyle}
                        placeholder={t('auth.contactPh')}
                      />
                    </div>

                    {/* Ad goals — what they want campaigns to achieve */}
                    <div>
                      <p className="v-caption v-quiet mb-1.5">
                        {t('auth.goalsQ')}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {AD_GOALS.map((g) => {
                          const active = brandGoals.has(g);
                          return (
                            <button
                              key={g}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                setBrandGoals((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(g)) next.delete(g);
                                  else next.add(g);
                                  return next;
                                })
                              }
                              className="v-niche-chip"
                              data-active={active || undefined}
                            >
                              {t(`objectives.${g}`, { defaultValue: g })}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Optional extras stay collapsed so the CTA stays visible */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setBrandExtrasOpen((o) => !o)}
                        aria-expanded={brandExtrasOpen}
                        className="inline-flex items-center gap-1.5 v-caption font-medium"
                        style={{ color: 'var(--color-campaign-purple)' }}
                      >
                        <ChevronDown
                          size={13}
                          style={{
                            transform: brandExtrasOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 160ms',
                          }}
                        />
                        {t('auth.extrasToggle')}
                      </button>

                      {brandExtrasOpen && (
                        <div className="mt-3 space-y-3">
                          <input
                            type="text"
                            value={tinNumber}
                            onChange={(e) => setTinNumber(e.target.value)}
                            className={fieldClass}
                            style={fieldStyle}
                            placeholder={t('auth.tinPh')}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {SIGNUP_SOCIALS.map((p) => (
                              <div key={p.id} className="relative">
                                <span
                                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex"
                                  style={{ color: p.color }}
                                >
                                  <PlatformIcon platform={PLATFORM_ICON_KEY[p.id]} size={14} />
                                </span>
                                <input
                                  type="text"
                                  value={brandSocials[p.id]?.url || ''}
                                  onChange={(e) =>
                                    setBrandSocials((prev) => ({
                                      ...prev,
                                      [p.id]: { url: e.target.value },
                                    }))
                                  }
                                  placeholder={p.placeholder}
                                  aria-label={`${p.label} profile URL`}
                                  className={`${fieldClass} pl-9`}
                                  style={fieldStyle}
                                />
                              </div>
                            ))}
                          </div>
                          <p className="v-caption v-quiet">
                            {t('auth.addMoreLater')}
                          </p>
                        </div>
                      )}
                    </div>
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
                {t('auth.createBtn')} <ArrowRight size={16} />
              </Button>

              <div
                className="mt-3 pt-5 text-center v-body v-muted"
                style={{ borderTop: '1px solid var(--color-cool-gray)' }}
              >
                {t('auth.haveAccount')}{' '}
                <Link
                  to="/login"
                  className="font-medium"
                  style={{ color: 'var(--color-campaign-purple)' }}
                >
                  {t('auth.signInLink')}
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
              <h2 className="v-heading-lg">{t('auth.activeTitle')}</h2>
              <p className="mt-3 v-body-lg v-muted">
                {t('auth.activeSub')}
              </p>

              {telegramToken && botUsername && (
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
                    {t('auth.secureLink')}
                  </p>
                  <a
                    href={buildTelegramLink(botUsername, telegramToken)}
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
                    {t('auth.openTelegram')} <ArrowRight size={14} />
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
                {t('auth.goDashboard')} <ArrowRight size={14} />
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
