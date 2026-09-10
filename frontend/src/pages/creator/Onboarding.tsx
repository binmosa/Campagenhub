import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  LogOut,
  Megaphone,
  Phone,
  Search,
  Send,
  Wallet,
  Wand2,
  XCircle,
} from 'lucide-react';
import { Button, Checkbox } from '@heroui/react';
import { Stepper } from '@heroui-pro/react';
import { Trans, useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { track } from '../../lib/analytics';
import { useNoIndex } from '../../lib/seo';
import { getCountries, type GeoCountry } from '../../lib/geo';
import { CREATOR_AGREEMENT, CREATOR_AGREEMENT_EFFECTIVE, CREATOR_AGREEMENT_VERSION } from '../../lib/creatorAgreement';
import { buildTelegramLink, getTelegramBotUsername } from '../../lib/telegram';
import { BrandLogo } from '../../components/ui/BrandLogo';
import LocationCascade, { EMPTY_LOCATION, type LocationValue } from '../../components/common/LocationCascade';
import { SearchSelect } from '../../components/common/SearchSelect';
import PlatformIcon from '../landing/mocks/PlatformIcon';
import { NICHES, PLATFORM_ICON_KEY, fieldClass } from '../talent/shared';
import { SOCIAL_PLATFORMS, parseSocialLinks, serializeSocialLinks, type SocialMap } from '../../lib/socialLinks';
import { PlatformPicker } from '../../components/creator/PlatformPicker';

/**
 * CreatorOnboarding — the creator's first session. Signup asked only for
 * email + password; everything else is collected here in short steps:
 *
 *   1. About you        name · handle (checked live) · country/state/city ·
 *                       phone with the country's dial code picked for them
 *   2. Agreement        the Creator Agreement (lib/creatorAgreement) with one
 *                       "I agree to all" tick — version, time, IP and user
 *                       agent are stored on the user as the legal record. A
 *                       creator who finished onboarding under an older version
 *                       is sent back here for just this step.
 *   3. Your platforms   what they create about · tap the platforms they are
 *                       on · type just the name after the platform's prefix
 *                       ("tiktok.com/@", "linkedin.com/in/") · a tick reuses
 *                       the first handle typed on every platform switched on
 *                       afterwards. No follower numbers —
 *                       our team verifies every account.
 *   4. Follow & share   only when an admin turned it on in Site control
 *                       (Campaign Hubz's own channels · optional post)
 *   5. All set          what happens next · optional Telegram alerts → home
 *
 * The portal sends creators here until `onboarding_completed_at` is set
 * (see Layout). Every step saves as it goes.
 */
type StepKey = 'about' | 'terms' | 'platforms' | 'share' | 'done';
const MAX_NICHES = 3;

/** Platforms a creator can follow us on, keyed like the `social_<id>` settings. */
const FOLLOW_ORDER = ['telegram', 'instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin'] as const;
const FOLLOW_META: Record<(typeof FOLLOW_ORDER)[number], { label: string; color: string }> = {
  telegram: { label: 'Telegram', color: '#229ED9' },
  instagram: { label: 'Instagram', color: '#E1306C' },
  tiktok: { label: 'TikTok', color: '#0b1736' },
  youtube: { label: 'YouTube', color: '#FF0000' },
  facebook: { label: 'Facebook', color: '#1877F2' },
  twitter: { label: 'X / Twitter', color: '#0b1736' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
};

const TelegramGlyph: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M21.5 3.5 2.8 10.7c-1 .4-1 1 0 1.3l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.8-.8l3.2-15c.3-1.3-.5-1.9-1.4-1.4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

type HandleState = { status: 'idle' | 'checking' | 'ok' | 'bad'; reason?: 'format' | 'reserved' | 'taken' };

const CreatorOnboarding: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useNoIndex();

  const [ready, setReady] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* Step 1 */
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [savedUsername, setSavedUsername] = useState('');
  const [handle, setHandle] = useState<HandleState>({ status: 'idle' });
  const [loc, setLoc] = useState<LocationValue>(EMPTY_LOCATION);
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [dialIso, setDialIso] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');

  /* Agreement */
  const [agreed, setAgreed] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [termsOnly, setTermsOnly] = useState(false);

  /* Platforms — `existing` is what is saved; `socialMap` is what the picker currently shows. */
  const [niches, setNiches] = useState<string[]>([]);
  const [existing, setExisting] = useState<SocialMap>({});
  const [socialMap, setSocialMap] = useState<SocialMap>({});

  /* Step 3 */
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [postUrl, setPostUrl] = useState('');
  const [postSaved, setPostSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  /* Step 4 */
  const [tgConnected, setTgConnected] = useState(false);
  const [tgLink, setTgLink] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get('/auth/me'),
      api.get('/creators/profile').catch(() => ({ data: null })),
      api.get('/public/settings').catch(() => ({ data: {} })),
      getCountries().catch(() => [] as GeoCountry[]),
    ])
      .then(([me, prof, pub, cs]) => {
        if (!alive) return;
        if (String(me.data?.role || '').toLowerCase() !== 'creator') {
          navigate('/dashboard', { replace: true });
          return;
        }
        const acceptedCurrent = me.data?.terms_version === CREATOR_AGREEMENT_VERSION || me.data?.terms_version === 'seed';
        if (me.data?.onboarding_completed_at && acceptedCurrent) {
          navigate('/dashboard', { replace: true });
          return;
        }
        // Finished before, but the agreement changed: only the agreement step.
        setTermsOnly(!!me.data?.onboarding_completed_at);
        setTermsAcceptedAt(acceptedCurrent ? me.data?.terms_accepted_at || null : null);
        setTermsVersion(me.data?.terms_version || null);
        setAgreed(acceptedCurrent);
        const p = prof.data || {};
        setFirstName(p.first_name || '');
        setLastName(p.last_name || '');
        setUsername(p.username || '');
        setSavedUsername(p.username || '');
        if (p.username) setHandle({ status: 'ok' });
        setNiches(String(p.category || '').split(',').map((s: string) => s.trim()).filter(Boolean).slice(0, MAX_NICHES));
        setCountries(cs);
        const iso = p.country_code || cs.find((c) => c.name === p.country)?.iso2 || '';
        setLoc({ country: p.country || '', countryCode: iso, state: p.state || '', stateCode: p.state_code || '', city: p.city || '' });
        // Phone: split a stored E.164 number back into dial code + local part.
        const stored = String(p.phone || '');
        if (stored) {
          const match = cs
            .filter((c) => c.dial && stored.startsWith(`+${c.dial.replace(/-/g, '')}`))
            .sort((a, b) => (b.dial || '').length - (a.dial || '').length)[0];
          if (match) {
            setDialIso(match.iso2);
            setPhoneLocal(stored.slice(1 + match.dial!.replace(/-/g, '').length));
          } else setPhoneLocal(stored.replace(/^\+/, ''));
        } else if (iso) setDialIso(iso);
        const map = parseSocialLinks(p.social_links);
        setExisting(map);
        setSocialMap(map);
        setSettings(pub.data || {});
        const onb = me.data?.onboarding || {};
        setFollowed(new Set<string>(Array.isArray(onb.followed) ? onb.followed : []));
        if (onb.post_url) {
          setPostUrl(onb.post_url);
          setPostSaved(true);
        }
        setTgConnected(!!me.data?.telegram_connected);
        setReady(true);
      })
      .catch(() => navigate('/login', { replace: true }));
    return () => {
      alive = false;
    };
  }, [navigate]);

  /* Country picked in the cascade → same country's dial code, unless the creator already chose one. */
  useEffect(() => {
    if (loc.countryCode && !phoneLocal) setDialIso(loc.countryCode);
  }, [loc.countryCode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Live handle check, debounced. */
  const checkSeq = useRef(0);
  useEffect(() => {
    const u = username.trim();
    if (!u) return setHandle({ status: 'idle' });
    if (u === savedUsername) return setHandle({ status: 'ok' });
    if (!/^[a-z0-9](?:[a-z0-9_.]{1,28})[a-z0-9]$/.test(u)) return setHandle({ status: 'bad', reason: 'format' });
    setHandle({ status: 'checking' });
    const seq = ++checkSeq.current;
    const timer = setTimeout(() => {
      api
        .get('/creators/handle-check', { params: { u } })
        .then((r) => {
          if (seq !== checkSeq.current) return;
          setHandle(r.data?.available ? { status: 'ok' } : { status: 'bad', reason: r.data?.reason || 'taken' });
        })
        .catch(() => seq === checkSeq.current && setHandle({ status: 'idle' }));
    }, 350);
    return () => clearTimeout(timer);
  }, [username, savedUsername]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  /* ── derived ─────────────────────────────────────────────────────── */
  const followLinks = useMemo(
    () => FOLLOW_ORDER.map((id) => ({ id, url: (settings[`social_${id}`] || '').trim(), ...FOLLOW_META[id] })).filter((x) => x.url),
    [settings],
  );
  const followOn = settings.onboarding_follow_enabled === 'true' && followLinks.length > 0;
  const postOn = settings.onboarding_post_enabled === 'true';
  const steps: StepKey[] = useMemo(
    () => (termsOnly ? ['terms'] : followOn || postOn ? ['about', 'terms', 'platforms', 'share', 'done'] : ['about', 'terms', 'platforms', 'done']),
    [termsOnly, followOn, postOn],
  );
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const caption = (settings.onboarding_post_text || '').trim() || t('onb.postCaptionDefault');

  const dialCountry = countries.find((c) => c.iso2 === dialIso);
  const dial = (dialCountry?.dial || '').replace(/-/g, '');
  const dialOptions = useMemo(
    () => countries.filter((c) => c.dial).map((c) => ({ value: c.iso2, label: `${c.flag || ''} ${c.name} (+${c.dial})`.trim() })),
    [countries],
  );

  const channelCount = Object.keys(socialMap).length;

  /* ── saves ───────────────────────────────────────────────────────── */
  const fail = (e: any, fallback: string) => {
    const msg = e?.response?.data?.message;
    setError(Array.isArray(msg) ? msg.join(' ') : msg || fallback);
  };

  const saveAbout = async () => {
    if (!firstName.trim()) return setError(t('onb.errName')), false;
    const u = username.trim();
    if (!u) return setError(t('onb.errUsername')), false;
    if (handle.status === 'bad') return setError(handle.reason === 'taken' ? t('onb.errUsernameTaken') : t(`onb.handle${handle.reason === 'reserved' ? 'Reserved' : 'Format'}`)), false;
    if (!loc.country || !loc.city) return setError(t('onb.errLocation')), false;
    const local = phoneLocal.replace(/\D/g, '');
    if (!local || !dial) return setError(t('onb.errPhone')), false;
    try {
      await api.post('/creators/profile', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: u,
        country: loc.country,
        country_code: loc.countryCode,
        state: loc.state,
        state_code: loc.stateCode,
        city: loc.city,
        location: `${loc.city}, ${loc.country}`,
        phone: `+${dial}${local}`,
      });
      setSavedUsername(u);
      return true;
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setHandle({ status: 'bad', reason: 'taken' });
        setError(t('onb.errUsernameTaken'));
      } else fail(e, t('onb.errGeneric'));
      return false;
    }
  };

  const saveTerms = async () => {
    if (!agreed) return setError(t('onb.errTerms')), false;
    if (termsVersion === CREATOR_AGREEMENT_VERSION && termsAcceptedAt) return true;
    try {
      const res = await api.post('/creators/onboarding/accept-terms', { version: CREATOR_AGREEMENT_VERSION });
      setTermsAcceptedAt(res.data?.terms_accepted_at || new Date().toISOString());
      setTermsVersion(CREATOR_AGREEMENT_VERSION);
      if (termsOnly) navigate('/dashboard', { replace: true });
      return true;
    } catch (e) {
      fail(e, t('onb.errGeneric'));
      return false;
    }
  };

  const savePlatforms = async () => {
    if (channelCount === 0) return setError(t('onb.errChannels')), false;
    try {
      const res = await api.post('/creators/profile', { category: niches.join(', '), social_links: serializeSocialLinks(socialMap) });
      setExisting(parseSocialLinks(res.data?.social_links));
      return true;
    } catch (e) {
      fail(e, t('onb.errGeneric'));
      return false;
    }
  };

  const saveShare = async (skipPost: boolean) => {
    try {
      if (followOn) await api.post('/creators/onboarding/followed', { platforms: [...followed] });
      const url = postUrl.trim();
      if (postOn && !skipPost && url && !postSaved) {
        await api.post('/creators/onboarding/welcome-post', { url });
        setPostSaved(true);
      }
      return true;
    } catch (e) {
      fail(e, t('onb.errPost'));
      return false;
    }
  };

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/creators/onboarding/complete');
      track('onboarding_complete', { role: 'creator', channels: channelCount });
      navigate('/dashboard', { replace: true });
    } catch (e) {
      fail(e, t('onb.errGeneric'));
      setBusy(false);
    }
  };

  const next = async (opts?: { skipPost?: boolean }) => {
    setBusy(true);
    setError('');
    const ok =
      step === 'about' ? await saveAbout() : step === 'terms' ? await saveTerms() : step === 'platforms' ? await savePlatforms() : step === 'share' ? await saveShare(!!opts?.skipPost) : true;
    setBusy(false);
    if (ok) {
      if (opts?.skipPost) setPostUrl('');
      setStepIdx((i) => Math.min(steps.length - 1, i + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const back = () => {
    setError('');
    setStepIdx((i) => Math.max(0, i - 1));
  };

  const openTelegram = async () => {
    try {
      const res = await api.post('/telegram/generate-token');
      const bot = await getTelegramBotUsername();
      const link = res.data?.botLink || buildTelegramLink(bot, res.data?.token);
      if (link) {
        setTgLink(link);
        window.open(link, '_blank', 'noopener');
      }
    } catch {
      /* bot not configured locally — button simply does nothing */
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the text is selectable anyway */
    }
  };

  const toggleNiche = (n: string) =>
    setNiches((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : prev.length >= MAX_NICHES ? prev : [...prev, n]));
  const toggleFollowed = (id: string) =>
    setFollowed((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const TITLES: Record<StepKey, string> = {
    about: t('onb.stepAbout'),
    terms: t('onb.stepTerms'),
    platforms: t('onb.stepChannels'),
    share: t('onb.stepShare'),
    done: t('onb.stepDone'),
  };
  const HEADINGS: Record<StepKey, { title: string; sub: string }> = {
    about: { title: t('onb.aboutTitle'), sub: t('onb.aboutSub') },
    terms: termsOnly ? { title: t('onb.termsUpdatedTitle'), sub: t('onb.termsUpdatedSub') } : { title: t('onb.termsTitle'), sub: t('onb.termsSub') },
    platforms: { title: t('onb.platformsTitle'), sub: t('onb.platformsSub') },
    share: { title: t('onb.shareTitle'), sub: t('onb.shareSub') },
    done: { title: t('onb.doneTitle', { name: firstName || t('cdash.you') }), sub: t('onb.doneSub') },
  };

  if (!ready) {
    return (
      <div className="landing-visitors min-h-screen v-bg-dawn-subtle flex items-center justify-center">
        <span className="v-story-ring" style={{ padding: 3 }}>
          <img src="/logo.png" alt="" className="h-10 w-10 object-contain" />
        </span>
      </div>
    );
  }

  const handleHint =
    handle.status === 'checking'
      ? { icon: <Loader2 size={12} className="animate-spin" />, text: t('onb.handleChecking'), color: 'var(--color-graphite)' }
      : handle.status === 'ok' && username.trim()
      ? { icon: <BadgeCheck size={12} />, text: t('onb.handleAvailable', { u: username.trim() }), color: 'var(--color-signal-green)' }
      : handle.status === 'bad'
      ? {
          icon: <XCircle size={12} />,
          text: handle.reason === 'taken' ? t('onb.handleTaken', { u: username.trim() }) : handle.reason === 'reserved' ? t('onb.handleReserved') : t('onb.handleFormat'),
          color: '#b3261e',
        }
      : { icon: null, text: t('onb.usernameHint', { u: username || 'yourname' }), color: undefined };

  return (
    <div className="landing-visitors min-h-screen v-bg-dawn-subtle flex flex-col">
      <header className="flex items-center justify-between px-5 sm:px-8 py-4">
        <BrandLogo size="md" />
        <Button variant="ghost" size="sm" onPress={logout} data-testid="onb-logout">
          {t('onb.logout')} <LogOut size={13} />
        </Button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <Stepper currentStep={stepIdx} size="md" className="w-full mt-2 mb-8" aria-label={t('auth.onboardingProgress')} data-testid="onb-stepper">
          {steps.map((k, i) => (
            <Stepper.Step key={k}>
              <Stepper.Indicator />
              <Stepper.Content className="hidden sm:flex">
                <Stepper.Title>{TITLES[k]}</Stepper.Title>
              </Stepper.Content>
              {i < steps.length - 1 && <Stepper.Separator />}
            </Stepper.Step>
          ))}
        </Stepper>
        <p className="sm:hidden text-center v-caption v-quiet -mt-4 mb-6" style={{ fontSize: 12 }}>
          {stepIdx + 1} / {steps.length} · {TITLES[step]}
        </p>

        <div className="text-center mb-7">
          <h1 className="v-heading-lg v-ink" style={{ letterSpacing: '-0.02em' }}>
            {HEADINGS[step].title}
          </h1>
          <p className="v-body v-muted mt-2 max-w-xl mx-auto" style={{ fontSize: 15.5 }}>
            {HEADINGS[step].sub}
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.section
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="v-talent-card p-5 sm:p-8"
            data-testid={`onb-step-${step}`}
          >
            {/* ── About you ─────────────────────────────────────────── */}
            {step === 'about' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="v-caption v-muted font-medium mb-1.5 block">{t('onb.firstName')} *</span>
                    <input className={fieldClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" data-testid="onb-first" />
                  </label>
                  <label className="block">
                    <span className="v-caption v-muted font-medium mb-1.5 block">{t('onb.lastName')}</span>
                    <input className={fieldClass} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                  </label>
                </div>

                <label className="block">
                  <span className="v-caption v-muted font-medium mb-1.5 block">{t('onb.username')} *</span>
                  <div className="relative">
                    <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet pointer-events-none" />
                    <input
                      className={`${fieldClass} !pl-9 !pr-9`}
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase())}
                      placeholder="yourname"
                      autoCapitalize="none"
                      aria-invalid={handle.status === 'bad'}
                      data-testid="onb-username"
                    />
                    {handle.status !== 'idle' && username.trim() && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: handleHint.color }}>
                        {handleHint.icon}
                      </span>
                    )}
                  </div>
                  <span className="v-caption mt-1.5 flex items-center gap-1" style={{ fontSize: 12, color: handleHint.color || 'var(--color-graphite)' }} data-testid="onb-handle-hint" data-status={handle.status}>
                    {handleHint.text}
                  </span>
                </label>

                <div>
                  <span className="v-caption v-muted font-medium mb-1.5 block">{t('onb.location')} *</span>
                  <LocationCascade value={loc} onChange={setLoc} layout="row" />
                  <span className="v-caption v-quiet mt-1.5 block" style={{ fontSize: 12 }}>
                    {t('onb.locationHint')}
                  </span>
                </div>

                <div>
                  <span className="v-caption v-muted font-medium mb-1.5 block">{t('onb.phone')} *</span>
                  <div className="grid grid-cols-[minmax(150px,200px)_1fr] gap-2">
                    <div data-testid="onb-dial">
                      <SearchSelect options={dialOptions} value={dialIso} onChange={setDialIso} placeholder={t('onb.dialCode')} allowClear={false} aria-label={t('onb.dialCode')} />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 v-ink tabular-nums flex items-center gap-1 pointer-events-none" style={{ fontSize: 14 }}>
                        <Phone size={13} className="v-quiet" /> {dial ? `+${dial}` : ''}
                      </span>
                      <input
                        className={`${fieldClass} tabular-nums`}
                        style={{ paddingLeft: dial ? 44 + dial.length * 9 : 36 }}
                        value={phoneLocal}
                        onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d\s]/g, ''))}
                        placeholder={t('onb.phonePh')}
                        inputMode="tel"
                        autoComplete="tel-national"
                        data-testid="onb-phone"
                      />
                    </div>
                  </div>
                  <span className="v-caption v-quiet mt-1.5 block" style={{ fontSize: 12 }}>
                    {t('onb.phoneHint')}
                  </span>
                </div>
              </div>
            )}

            {/* ── Agreement ─────────────────────────────────────────── */}
            {step === 'terms' && (
              <div className="space-y-4">
                <div className="rounded-xl v-hairline overflow-hidden" style={{ background: '#fff' }}>
                  <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--color-cool-gray)', background: 'var(--color-paper)' }}>
                    <div className="flex items-center gap-2 v-ink font-medium" style={{ fontSize: 14 }}>
                      <FileText size={15} className="v-quiet" /> {t('onb.termsBoxTitle')}
                    </div>
                    <span className="v-caption v-quiet" style={{ fontSize: 11.5 }}>
                      {t('onb.termsEffective', { v: CREATOR_AGREEMENT_VERSION, date: CREATOR_AGREEMENT_EFFECTIVE })}
                    </span>
                  </div>
                  <div className="px-4 sm:px-6 py-4 overflow-y-auto" style={{ maxHeight: 420 }} data-testid="onb-terms-text" tabIndex={0}>
                    {CREATOR_AGREEMENT.map((sec) => (
                      <section key={sec.title} className="mb-5 last:mb-0">
                        <h3 className="v-ink font-medium mb-1.5" style={{ fontSize: 14.5, letterSpacing: '-0.01em' }}>
                          {sec.title}
                        </h3>
                        {sec.intro?.map((para, i) => (
                          <p key={i} className="v-muted mb-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
                            {para}
                          </p>
                        ))}
                        {sec.bullets && (
                          <ul className="list-disc pl-5 space-y-1.5">
                            {sec.bullets.map((b, i) => {
                              const dash = b.indexOf(' — ');
                              return (
                                <li key={i} className="v-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                                  {dash > 0 && dash < 40 ? (
                                    <>
                                      <strong className="v-ink font-medium">{b.slice(0, dash)}</strong>
                                      {' — '}
                                      {b.slice(dash + 3)}
                                    </>
                                  ) : (
                                    b
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </section>
                    ))}
                  </div>
                </div>
                <p className="v-caption v-quiet text-center" style={{ fontSize: 12 }}>
                  <Trans
                    i18nKey="onb.termsLinks"
                    components={{
                      terms: <Link to="/legal/terms" target="_blank" rel="noopener noreferrer" className="font-medium" style={{ color: 'var(--color-campaign-purple)' }} />,
                      privacy: <Link to="/legal/privacy" target="_blank" rel="noopener noreferrer" className="font-medium" style={{ color: 'var(--color-campaign-purple)' }} />,
                    }}
                  />
                </p>
                <label className="flex items-start gap-3 rounded-xl px-4 py-3.5 cursor-pointer v-hairline" style={{ background: agreed ? 'var(--color-soft-lavender)' : 'var(--color-paper)' }} data-testid="onb-terms-agree">
                  <Checkbox isSelected={agreed} onChange={(v) => setAgreed(!!v)} aria-label={t('onb.termsAgree')} isDisabled={!!termsAcceptedAt && termsVersion === CREATOR_AGREEMENT_VERSION}>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox>
                  <span className="v-ink font-medium" style={{ fontSize: 14 }}>
                    {t('onb.termsAgree')}
                    {termsAcceptedAt && termsVersion === CREATOR_AGREEMENT_VERSION && (
                      <span className="block v-caption font-normal" style={{ fontSize: 12, color: 'var(--color-signal-green)' }}>
                        {t('onb.termsAccepted', { date: new Date(termsAcceptedAt).toLocaleDateString() })}
                      </span>
                    )}
                  </span>
                </label>
              </div>
            )}

            {/* ── Your platforms ────────────────────────────────────── */}
            {step === 'platforms' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="v-caption v-muted font-medium">{t('onb.nichesQ')}</span>
                    <span className="v-caption v-quiet" style={{ fontSize: 12 }}>
                      {t('onb.nichesHint')} · {niches.length}/{MAX_NICHES}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {NICHES.map((n) => {
                      const on = niches.includes(n);
                      return (
                        <button key={n} type="button" onClick={() => toggleNiche(n)} className="v-niche-chip" data-active={on || undefined} aria-pressed={on}>
                          {t(`cats.${n}`, { defaultValue: n })}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2 gap-3">
                    <span className="v-caption v-muted font-medium">{t('onb.platformsQ')} *</span>
                    <span className="v-caption v-quiet" style={{ fontSize: 12 }}>
                      {t('onb.platformsNote')}
                    </span>
                  </div>
                  <PlatformPicker value={existing} onChange={setSocialMap} />
                </div>
              </div>
            )}

            {/* ── Follow & share (admin-enabled) ────────────────────── */}
            {step === 'share' && (
              <div className="space-y-7">
                {followOn && (
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="v-hero-icon" style={{ width: 34, height: 34, borderRadius: 10 }}>
                        <Megaphone size={15} />
                      </span>
                      <h2 className="v-subheading v-ink">{t('onb.followTitle')}</h2>
                    </div>
                    <p className="v-caption v-muted mb-3" style={{ fontSize: 13 }}>
                      {t('onb.followSub')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {followLinks.map((f) => {
                        const done = followed.has(f.id);
                        return (
                          <div key={f.id} className="rounded-xl p-3 v-hairline flex items-center gap-2.5" style={{ background: done ? 'var(--color-soft-lavender)' : 'var(--color-paper)' }} data-testid={`onb-follow-${f.id}`}>
                            <span className="v-social-tile shrink-0" style={{ color: f.color }}>
                              {f.id === 'telegram' ? <TelegramGlyph /> : <PlatformIcon platform={PLATFORM_ICON_KEY[f.id] || 'instagram'} size={14} />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="v-ink font-medium truncate" style={{ fontSize: 13 }}>{f.label}</div>
                              <div className="v-caption v-quiet truncate" style={{ fontSize: 11 }}>{f.url.replace(/^https?:\/\/(www\.)?/, '')}</div>
                            </div>
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="v-social-chip !h-8 shrink-0" onClick={() => setFollowed((s) => new Set(s).add(f.id))}>
                              {t('onb.followOpen')} <ExternalLink size={10} />
                            </a>
                            <button type="button" className="v-niche-chip !py-1.5 !px-2.5 shrink-0" data-active={done || undefined} onClick={() => toggleFollowed(f.id)} aria-pressed={done} style={{ fontSize: 12 }}>
                              {done ? <Check size={12} /> : null} {done ? t('onb.followMarked') : t('onb.followMark')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {postOn && (
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="v-hero-icon" style={{ width: 34, height: 34, borderRadius: 10 }}>
                        <Send size={15} />
                      </span>
                      <h2 className="v-subheading v-ink">{t('onb.postTitle')}</h2>
                    </div>
                    <p className="v-caption v-muted mb-3" style={{ fontSize: 13 }}>
                      {t('onb.postSub')}
                    </p>
                    <div className="rounded-xl p-3.5 v-hairline mb-3" style={{ background: 'var(--color-paper)' }}>
                      <p className="v-ink" style={{ fontSize: 13.5, lineHeight: 1.55 }} data-testid="onb-caption">
                        {caption}
                      </p>
                      <div className="mt-2.5">
                        <Button variant="tertiary" size="sm" onPress={copyCaption}>
                          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('onb.copied') : t('onb.copyCaption')}
                        </Button>
                      </div>
                    </div>
                    <div className="relative">
                      <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet pointer-events-none" />
                      <input
                        className={`${fieldClass} !pl-9`}
                        value={postUrl}
                        onChange={(e) => {
                          setPostUrl(e.target.value);
                          setPostSaved(false);
                        }}
                        placeholder={t('onb.postLinkPh')}
                        inputMode="url"
                        data-testid="onb-post-url"
                      />
                    </div>
                    {postSaved && postUrl && (
                      <p className="mt-1.5 v-caption flex items-center gap-1" style={{ fontSize: 12, color: 'var(--color-signal-green)' }}>
                        <BadgeCheck size={12} /> {t('onb.postSaved')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── All set ───────────────────────────────────────────── */}
            {step === 'done' && (
              <div className="space-y-6">
                <div className="rounded-xl p-3.5 v-hairline" style={{ background: 'var(--color-paper)' }}>
                  <div className="v-caption v-quiet mb-1" style={{ fontSize: 11.5 }}>{t('onb.summaryChannels')}</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {SOCIAL_PLATFORMS.filter((p) => socialMap[p.id]).map((p) => (
                      <span key={p.id} className="v-social-tile" style={{ color: p.color }} title={p.label}>
                        <PlatformIcon platform={PLATFORM_ICON_KEY[p.id]} size={14} />
                      </span>
                    ))}
                    <span className="v-ink font-medium ml-1" style={{ fontSize: 14 }}>{channelCount}</span>
                    {postOn && (
                      <span className="v-caption v-quiet ml-3" style={{ fontSize: 12 }}>
                        {t('onb.summaryPost')}: {postSaved && postUrl ? t('onb.summaryPostPending') : t('onb.summaryPostNone')}
                      </span>
                    )}
                  </div>
                </div>

                <ol className="space-y-3">
                  {[
                    { icon: <BadgeCheck size={16} />, title: t('onb.nextVerify'), desc: t('onb.nextVerifyDesc') },
                    { icon: <Search size={16} />, title: t('onb.nextBrowse'), desc: t('onb.nextBrowseDesc') },
                    { icon: <Wallet size={16} />, title: t('onb.nextEarn'), desc: t('onb.nextEarnDesc') },
                  ].map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="v-hero-icon shrink-0" style={{ width: 36, height: 36, borderRadius: 11 }}>{s.icon}</span>
                      <div>
                        <div className="v-ink font-medium" style={{ fontSize: 14 }}>{s.title}</div>
                        <div className="v-caption v-muted" style={{ fontSize: 12.5 }}>{s.desc}</div>
                      </div>
                    </li>
                  ))}
                </ol>

                {/* optional Telegram alerts — the one company bot, linked to this account */}
                <div className="rounded-xl p-4 v-hairline flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: tgConnected ? 'var(--color-soft-lavender)' : 'var(--color-paper)' }} data-testid="onb-telegram">
                  <span className="v-social-tile shrink-0" style={{ color: '#229ED9', width: 36, height: 36 }}>
                    <TelegramGlyph size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="v-ink font-medium" style={{ fontSize: 13.5 }}>{t('onb.tgTitle')}</div>
                    <div className="v-caption v-muted" style={{ fontSize: 12 }}>{t('onb.tgDesc')}</div>
                  </div>
                  {tgConnected ? (
                    <span className="inline-flex items-center gap-1 v-caption font-medium shrink-0" style={{ fontSize: 12.5, color: 'var(--color-signal-green)' }}>
                      <BadgeCheck size={13} /> {t('onb.tgConnected')}
                    </span>
                  ) : tgLink ? (
                    <a href={tgLink} target="_blank" rel="noopener noreferrer" className="v-social-chip !h-9 shrink-0">
                      {t('onb.tgOpen')} <ExternalLink size={11} />
                    </a>
                  ) : (
                    <Button variant="tertiary" size="sm" onPress={openTelegram} className="shrink-0">
                      {t('onb.tgOpen')} <ExternalLink size={11} />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4 v-caption" style={{ fontSize: 12.5, color: '#b3261e' }} data-testid="onb-error">
                {error}
              </p>
            )}

            <div className="mt-7 flex flex-col-reverse sm:flex-row sm:items-center gap-3">
              {stepIdx > 0 && step !== 'done' && !termsOnly && (
                <Button variant="ghost" size="md" onPress={back} isDisabled={busy}>
                  <ArrowLeft size={13} /> {t('onb.back')}
                </Button>
              )}
              <div className="flex-1" />
              {step === 'share' && postOn && !postUrl.trim() && (
                <Button variant="tertiary" size="md" onPress={() => next({ skipPost: true })} isDisabled={busy} data-testid="onb-post-later">
                  {t('onb.postLater')}
                </Button>
              )}
              {step !== 'done' ? (
                <Button variant="primary" size="md" onPress={() => next()} isPending={busy} isDisabled={step === 'terms' && !agreed} data-testid="onb-next">
                  {busy ? t('onb.saving') : step === 'terms' && !agreed ? t('onb.termsAgreeHint') : t('onb.next')} <ArrowRight size={13} />
                </Button>
              ) : (
                <Button variant="primary" size="lg" onPress={finish} isPending={busy} data-testid="onb-finish">
                  {t('onb.finish')} <ArrowRight size={14} />
                </Button>
              )}
            </div>
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default CreatorOnboarding;
