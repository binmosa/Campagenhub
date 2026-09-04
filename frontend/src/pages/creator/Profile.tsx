import React, { useEffect, useMemo, useState } from 'react';
import { AtSign, BadgeCheck, Check, MapPin, Pencil, Upload, User, X } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import {
  formatCompact,
  parseSocialLinks,
  serializeSocialLinks,
  socialEntries,
  verifiedFollowers,
  type SocialMap,
} from '../../lib/socialLinks';
import { SocialLinksEditor } from '../../components/common/SocialLinksEditor';
import { PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { Notice } from '../../components/common/Notice';
import LocationCascade, { EMPTY_LOCATION, type LocationValue } from '../../components/common/LocationCascade';
import AccountSettings from '../../components/AccountSettings';
import PayoutSummary from '../../components/PayoutSummary';
import { KycCard } from '../../components/common/KycCard';
import PlatformIcon from '../landing/mocks/PlatformIcon';
import { NICHES, PLATFORM_ICON_KEY, accentFor, fieldClass } from '../talent/shared';

/**
 * CreatorProfile — the card brands see in the directory and on applications:
 * identity, niches (from the same list the directory filters on), platforms
 * with real follower counts, location. Then account & security and the
 * payout account, on one page.
 */
type Form = {
  first_name: string;
  last_name: string;
  username: string;
  niches: string[];
  follower_range: string;
  bio: string;
  avatar_url: string;
  loc: LocationValue;
  socials: SocialMap;
};

const FOLLOWER_RANGES = ['0-1K', '1K-10K', '10K-50K', '50K-100K', '100K-500K', '500K+'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const EMPTY: Form = { first_name: '', last_name: '', username: '', niches: [], follower_range: '', bio: '', avatar_url: '', loc: EMPTY_LOCATION, socials: {} };

const fromApi = (p: any): Form => {
  const socials: Form['socials'] = parseSocialLinks(p?.social_links);
  const fullParts = String(p?.full_name || '').split(' ');
  return {
    first_name: p?.first_name || fullParts[0] || '',
    last_name: p?.last_name || fullParts.slice(1).join(' ') || '',
    username: String(p?.username || '').replace(/^@/, ''),
    niches: String(p?.category || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    follower_range: p?.follower_range || '',
    bio: p?.bio || '',
    avatar_url: p?.avatar_url || '',
    loc: { country: p?.country || '', countryCode: p?.country_code || '', state: p?.state || '', stateCode: p?.state_code || '', city: p?.city || '' },
    socials,
  };
};

const toApi = (f: Form) => {
  const full_name = `${f.first_name} ${f.last_name}`.trim();
  return {
    first_name: f.first_name.trim(),
    last_name: f.last_name.trim(),
    full_name,
    username: f.username.trim().replace(/^@/, ''),
    category: f.niches.join(', '),
    follower_range: f.follower_range,
    bio: f.bio,
    avatar_url: f.avatar_url,
    country: f.loc.country,
    country_code: f.loc.countryCode,
    state: f.loc.state,
    state_code: f.loc.stateCode,
    city: f.loc.city,
    location: [f.loc.city, f.loc.country].filter(Boolean).join(', '),
    social_links: serializeSocialLinks(f.socials),
  };
};

const Field: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5 gap-2">
      <label className="v-caption v-ink font-medium" style={{ fontSize: 12.5 }}>{label}</label>
      {hint && <span className="v-caption v-quiet" style={{ fontSize: 11 }}>{hint}</span>}
    </div>
    {children}
  </div>
);

const CreatorProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<Form | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [raw, setRaw] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);

  const fetchAuthUser = () => api.get('/auth/me').then((r) => setAuthUser(r.data)).catch(() => {});

  useEffect(() => {
    fetchAuthUser();
    api
      .get('/creators/profile')
      .then((res) => {
        setRaw(res.data || {});
        const f = fromApi(res.data || {});
        setSaved(f);
        setForm(f);
      })
      .catch(() => setNotice({ tone: 'error', text: t('profile.loadFailed') }))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onAvatar = (file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) return setNotice({ tone: 'error', text: t('profile.logoTooBig') });
    const reader = new FileReader();
    reader.onload = () => set('avatar_url', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim()) return setNotice({ tone: 'error', text: t('cprof.errName') });
    setSaving(true);
    try {
      const res = await api.post('/creators/profile', toApi(form));
      setRaw(res.data || raw);
      setSaved(form);
      setEditing(false);
      setNotice({ tone: 'success', text: t('profile.saved') });
      window.dispatchEvent(new Event('profileUpdated'));
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setNotice({ tone: 'error', text: /unique|duplicate|username/i.test(String(msg)) ? t('cprof.errUsername') : msg || t('profile.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const view = saved || EMPTY;
  const name = `${view.first_name} ${view.last_name}`.trim() || t('talent.creatorFallback');
  const accent = accentFor(name);
  const links = useMemo(() => socialEntries(raw?.social_links), [raw]);
  const platformTotal = links.reduce((s, l) => s + (l.followers || 0), 0);
  const verifiedTotal = verifiedFollowers(raw?.social_links);
  const locationLabel = [view.loc.city, view.loc.state, view.loc.country].filter(Boolean).join(', ');
  const checks = [view.first_name, view.username, view.bio, view.avatar_url, view.niches.length, view.loc.country, links.length];
  const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return (
    <PageShell
      hero
      title={t('cprof.title')}
      titleAccent={t('cprof.titleAccent')}
      description={t('cprof.desc')}
      icon={<User size={18} />}
      actions={
        !editing && !loading ? (
          <Button variant="primary" size="md" onPress={() => setEditing(true)}>
            <Pencil size={13} /> {t('profile.edit')}
          </Button>
        ) : undefined
      }
      stats={
        loading ? (
          <div className="flex items-center gap-4">
            <div className="v-skel h-16 w-16 !rounded-full" />
            <div className="flex-1">
              <div className="v-skel h-5 w-48 mb-2" />
              <div className="v-skel h-3 w-72" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="v-story-ring" style={{ padding: 3 }}>
              {view.avatar_url ? (
                <img src={view.avatar_url} alt="" className="h-16 w-16 object-cover" />
              ) : (
                <span className="inline-flex h-16 w-16 items-center justify-center text-xl font-medium text-white" style={{ background: accent.from }}>
                  {name[0]?.toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="v-ink font-medium" style={{ fontSize: 20, letterSpacing: '-0.018em' }}>{name}</div>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                {view.username && (
                  <span className="v-caption v-muted inline-flex items-center gap-0.5" style={{ fontSize: 12 }}>
                    <AtSign size={11} /> {view.username}
                  </span>
                )}
                {locationLabel && (
                  <span className="v-caption v-muted inline-flex items-center gap-1" style={{ fontSize: 12 }}>
                    <MapPin size={11} /> {locationLabel}
                  </span>
                )}
                {view.niches.map((n) => (
                  <Chip key={n} color="accent" variant="soft" size="sm">
                    <Chip.Label>{t(`cats.${n}`, { defaultValue: n })}</Chip.Label>
                  </Chip>
                ))}
                {links.slice(0, 5).map((l) => (
                  <a key={l.id} href={l.url || undefined} target="_blank" rel="noreferrer" className="v-social-chip" title={`${l.label}${l.verified ? ' · ' + t('social.status.verified') : ''}`}>
                    <span className="inline-flex" style={{ color: l.color }}>
                      <PlatformIcon platform={PLATFORM_ICON_KEY[l.id]} size={13} />
                    </span>
                    {l.followers ? <span className="v-ink font-medium tabular-nums" style={{ fontSize: 11 }}>{formatCompact(l.followers)}</span> : null}
                    {l.verified && <BadgeCheck size={11} style={{ color: 'var(--color-signal-green)' }} />}
                  </a>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="v-caption v-quiet" style={{ fontSize: 11 }}>{platformTotal ? t('talent.totalFollowers') : t('profile.completeness')}</div>
              <div className="v-ink font-medium tabular-nums" style={{ fontSize: 18 }}>{platformTotal ? formatCompact(platformTotal) : `${completeness}%`}</div>
              {platformTotal > 0 && (
                <div className="v-caption inline-flex items-center gap-1 justify-end" style={{ fontSize: 11, color: verifiedTotal ? 'var(--color-signal-green)' : 'var(--color-ash)' }}>
                  <BadgeCheck size={11} /> {verifiedTotal ? t('social.verifiedTotal', { n: formatCompact(verifiedTotal) }) : t('social.noneVerified')}
                </div>
              )}
            </div>
          </div>
        )
      }
    >
      {notice && <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice>}

      <KycCard user={authUser} onSubmitted={fetchAuthUser} />

      {!editing ? (
        loading ? (
          <div className="v-talent-card p-5">
            <div className="v-skel h-4 w-1/3 mb-3" />
            <div className="v-skel h-3 w-full mb-1.5" />
            <div className="v-skel h-3 w-5/6" />
          </div>
        ) : !view.bio && !view.niches.length && !links.length ? (
          <EmptyPanel
            icon={<User size={22} />}
            title={t('cprof.emptyTitle')}
            description={t('cprof.emptyDesc')}
            actions={<Button variant="primary" onPress={() => setEditing(true)}><Pencil size={13} /> {t('profile.edit')}</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="v-talent-card p-5 lg:col-span-2">
              <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2" style={{ fontSize: 10.5 }}>{t('profile.about')}</div>
              <p className="v-body v-ink whitespace-pre-wrap" style={{ fontSize: 14, lineHeight: 1.65 }}>
                {view.bio || <span className="v-quiet italic">{t('cprof.noBio')}</span>}
              </p>
            </div>
            <div className="v-talent-card p-5">
              <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-3" style={{ fontSize: 10.5 }}>{t('cprof.glance')}</div>
              <dl className="space-y-3 v-body" style={{ fontSize: 13 }}>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('cprof.audience')}</dt>
                  <dd className="v-ink font-medium tabular-nums">{platformTotal ? formatCompact(platformTotal) : view.follower_range || '—'}</dd>
                </div>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('cprof.niches')}</dt>
                  <dd className="v-ink font-medium">{view.niches.map((n) => t(`cats.${n}`, { defaultValue: n })).join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('profile.location')}</dt>
                  <dd className="v-ink font-medium">{locationLabel || '—'}</dd>
                </div>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('cprof.platforms')}</dt>
                  <dd className="flex items-center gap-1.5 flex-wrap mt-1">
                    {links.length ? links.map((l) => (
                      <a key={l.id} href={l.url || undefined} target="_blank" rel="noreferrer" className="v-social-chip" title={l.label}>
                        <span className="inline-flex" style={{ color: l.color }}><PlatformIcon platform={PLATFORM_ICON_KEY[l.id]} size={13} /></span>
                        {l.followers ? <span className="v-ink font-medium tabular-nums" style={{ fontSize: 11 }}>{formatCompact(l.followers)}</span> : null}
                        {l.verified && <BadgeCheck size={11} style={{ color: 'var(--color-signal-green)' }} />}
                      </a>
                    )) : <span className="v-quiet">{t('talent.socialsNotLinked')}</span>}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )
      ) : (
        <form onSubmit={save} className="v-talent-card p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="v-ink font-medium" style={{ fontSize: 16 }}>{t('cprof.editTitle')}</h2>
            <Button isIconOnly variant="ghost" size="sm" aria-label={t('common.cancel')} onPress={() => { setForm(saved || EMPTY); setEditing(false); }}><X size={15} /></Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
            <label className="relative cursor-pointer group self-start">
              <span className="v-story-ring" style={{ padding: 3 }}>
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="" className="h-20 w-20 object-cover" />
                ) : (
                  <span className="inline-flex h-20 w-20 items-center justify-center text-2xl font-medium text-white" style={{ background: accent.from }}>
                    {(form.first_name || 'C')[0]?.toUpperCase()}
                  </span>
                )}
              </span>
              <span className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(11,23,54,0.55)', color: '#fff' }}>
                <Upload size={18} />
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0])} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('cprof.firstName')}>
                <input className={fieldClass} value={form.first_name} onChange={(e) => set('first_name', e.target.value)} autoComplete="given-name" required />
              </Field>
              <Field label={t('cprof.lastName')}>
                <input className={fieldClass} value={form.last_name} onChange={(e) => set('last_name', e.target.value)} autoComplete="family-name" />
              </Field>
              <Field label={t('cprof.username')} hint={t('cprof.usernameHint')}>
                <div className="relative">
                  <AtSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet pointer-events-none" />
                  <input className={`${fieldClass} !pl-8`} value={form.username} onChange={(e) => set('username', e.target.value.replace(/^@/, '').replace(/\s+/g, ''))} placeholder="yourhandle" />
                </div>
              </Field>
              <Field label={t('cprof.followerRange')} hint={t('cprof.followerRangeHint')}>
                <select className={fieldClass} value={form.follower_range} onChange={(e) => set('follower_range', e.target.value)}>
                  <option value="">{t('cprof.pickRange')}</option>
                  {FOLLOWER_RANGES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <Field label={t('cprof.niches')} hint={t('cprof.nichesHint')}>
            <div className="flex flex-wrap gap-1.5">
              {NICHES.map((n) => {
                const active = form.niches.includes(n);
                return (
                  <button key={n} type="button" className="v-niche-chip" data-active={active || undefined} aria-pressed={active} onClick={() => set('niches', active ? form.niches.filter((x) => x !== n) : [...form.niches, n])}>
                    {active && <Check size={11} />} {t(`cats.${n}`, { defaultValue: n })}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={t('profile.location')}>
            <LocationCascade value={form.loc} onChange={(loc) => set('loc', loc)} layout="row" />
          </Field>

          <Field label={t('profile.about')} hint={t('cprof.bioHint')}>
            <textarea className={`${fieldClass} resize-y min-h-[120px]`} rows={5} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder={t('cprof.bioPh')} />
          </Field>

          <Field label={t('cprof.platforms')} hint={t('cprof.platformsHint')}>
            <SocialLinksEditor key={editing ? 'edit' : 'view'} value={form.socials} onChange={(socials) => set('socials', socials)} />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onPress={() => { setForm(saved || EMPTY); setEditing(false); }} isDisabled={saving}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" isPending={saving}>
              <Check size={13} /> {t('profile.save')}
            </Button>
          </div>
        </form>
      )}

      <div>
        <h2 className="v-ink font-medium mb-3 inline-flex items-center gap-2" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>{t('cprof.payoutSection')}</h2>
        <PayoutSummary />
      </div>
      <div>
        <h2 className="v-ink font-medium mb-3 inline-flex items-center gap-2" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>{t('profile.accountSection')}</h2>
        <AccountSettings email={authUser?.email} />
      </div>
    </PageShell>
  );
};

export default CreatorProfilePage;
