import React, { useEffect, useMemo, useState } from 'react';
import { Award, Briefcase, Check, Globe, Languages, MapPin, Pencil, Star, Upload, User, X } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { MANAGER_SERVICES } from '../../lib/catalog';
import { PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { Notice } from '../../components/common/Notice';
import LocationCascade, { EMPTY_LOCATION, type LocationValue } from '../../components/common/LocationCascade';
import AccountSettings from '../../components/AccountSettings';
import PayoutSummary from '../../components/PayoutSummary';
import { KycCard } from '../../components/common/KycCard';
import { NICHES, accentFor, fieldClass } from '../talent/shared';

/**
 * ManagerProfile — the card brands see when they look for someone to run
 * their campaigns: who you are, what industries you know, what you offer,
 * how long you've done it, and where you are. Then getting paid and
 * account & security, on one page — same anatomy as the creator profile.
 */
type Form = {
  first_name: string;
  last_name: string;
  specialties: string[];
  services: string[];
  experience_years: number;
  languages: string;
  website: string;
  bio: string;
  avatar_url: string;
  loc: LocationValue;
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const EMPTY: Form = { first_name: '', last_name: '', specialties: [], services: [], experience_years: 0, languages: '', website: '', bio: '', avatar_url: '', loc: EMPTY_LOCATION };

const splitList = (v: unknown) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

const fromApi = (p: any): Form => {
  const fullParts = String(p?.full_name || '').split(' ');
  return {
    first_name: p?.first_name || fullParts[0] || '',
    last_name: p?.last_name || fullParts.slice(1).join(' ') || '',
    specialties: splitList(p?.specialty),
    services: splitList(p?.services),
    experience_years: Math.max(0, Number(p?.experience_years) || 0),
    languages: p?.languages || '',
    website: p?.website || '',
    bio: p?.bio || '',
    avatar_url: p?.avatar_url || '',
    loc: { country: p?.country || '', countryCode: p?.country_code || '', state: p?.state || '', stateCode: p?.state_code || '', city: p?.city || '' },
  };
};

const toApi = (f: Form) => ({
  first_name: f.first_name.trim(),
  last_name: f.last_name.trim(),
  full_name: `${f.first_name} ${f.last_name}`.trim(),
  specialty: f.specialties.join(', '),
  services: f.services.join(', '),
  experience_years: f.experience_years,
  languages: f.languages.trim(),
  website: f.website.trim(),
  bio: f.bio,
  avatar_url: f.avatar_url,
  country: f.loc.country,
  country_code: f.loc.countryCode,
  state: f.loc.state,
  state_code: f.loc.stateCode,
  city: f.loc.city,
  location: [f.loc.city, f.loc.country].filter(Boolean).join(', '),
});

const Field: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5 gap-2">
      <label className="v-caption v-ink font-medium" style={{ fontSize: 12.5 }}>{label}</label>
      {hint && <span className="v-caption v-quiet" style={{ fontSize: 11 }}>{hint}</span>}
    </div>
    {children}
  </div>
);

const ChipPicker: React.FC<{ options: readonly string[]; value: string[]; onChange: (v: string[]) => void; label: (o: string) => string }> = ({ options, value, onChange, label }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((o) => {
      const on = value.includes(o);
      return (
        <button key={o} type="button" className="v-niche-chip" data-active={on || undefined} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>
          {on && <Check size={11} />} {label(o)}
        </button>
      );
    })}
  </div>
);

const Stars: React.FC<{ value: number }> = ({ value }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} / 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={13} className={i <= Math.round(value) ? 'fill-warning text-warning' : 'text-border'} />
    ))}
  </span>
);

const ManagerProfilePage: React.FC = () => {
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
      .get('/managers/profile')
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
      const res = await api.post('/managers/profile', toApi(form));
      setRaw(res.data || raw);
      setSaved(form);
      setEditing(false);
      setNotice({ tone: 'success', text: t('profile.saved') });
      window.dispatchEvent(new Event('profileUpdated'));
    } catch (err: any) {
      setNotice({ tone: 'error', text: err?.response?.data?.message || t('profile.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const view = saved || EMPTY;
  const name = `${view.first_name} ${view.last_name}`.trim() || t('talent.managerFallback');
  const accent = accentFor(name);
  const rating = Math.min(5, Math.max(0, Number(raw?.rating) || 5));
  const locationLabel = [view.loc.city, view.loc.state, view.loc.country].filter(Boolean).join(', ');
  const website = view.website ? (/^https?:\/\//i.test(view.website) ? view.website : `https://${view.website}`) : '';
  const completeness = useMemo(() => {
    const checks = [view.first_name, view.avatar_url, view.bio, view.specialties.length, view.services.length, view.loc.country, view.experience_years > 0];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [view]);
  const isEmpty = !view.bio && !view.specialties.length && !view.services.length;

  return (
    <PageShell
      hero
      title={t('mprof.title')}
      titleAccent={t('mprof.titleAccent')}
      description={t('mprof.desc')}
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
                <span className="inline-flex items-center gap-1 v-caption" style={{ fontSize: 12 }}>
                  <Stars value={rating} />
                  <span className="v-ink font-medium tabular-nums">{rating.toFixed(1)}</span>
                </span>
                {view.experience_years > 0 && (
                  <span className="v-caption v-muted inline-flex items-center gap-1" style={{ fontSize: 12 }}>
                    <Award size={11} /> {t('talent.years', { n: view.experience_years })}
                  </span>
                )}
                {locationLabel && (
                  <span className="v-caption v-muted inline-flex items-center gap-1" style={{ fontSize: 12 }}>
                    <MapPin size={11} /> {locationLabel}
                  </span>
                )}
                {view.specialties.slice(0, 4).map((n) => (
                  <Chip key={n} color="accent" variant="soft" size="sm">
                    <Chip.Label>{t(`cats.${n}`, { defaultValue: n })}</Chip.Label>
                  </Chip>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="v-caption v-quiet" style={{ fontSize: 11 }}>{t('profile.completeness')}</div>
              <div className="v-ink font-medium tabular-nums" style={{ fontSize: 18 }}>{completeness}%</div>
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
        ) : isEmpty ? (
          <EmptyPanel
            icon={<User size={22} />}
            title={t('mprof.emptyTitle')}
            description={t('mprof.emptyDesc')}
            actions={<Button variant="primary" onPress={() => setEditing(true)}><Pencil size={13} /> {t('profile.edit')}</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="v-talent-card p-5 lg:col-span-2 space-y-5">
              <div>
                <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2" style={{ fontSize: 10.5 }}>{t('profile.about')}</div>
                <p className="v-body v-ink whitespace-pre-wrap" style={{ fontSize: 14, lineHeight: 1.65 }}>
                  {view.bio || <span className="v-quiet italic">{t('mprof.noBio')}</span>}
                </p>
              </div>
              <div>
                <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2" style={{ fontSize: 10.5 }}>{t('mprof.services')}</div>
                {view.services.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {view.services.map((s) => (
                      <Chip key={s} variant="soft" size="sm">
                        <Briefcase size={11} />
                        <Chip.Label>{s}</Chip.Label>
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <span className="v-quiet v-caption" style={{ fontSize: 12.5 }}>—</span>
                )}
              </div>
            </div>
            <div className="v-talent-card p-5">
              <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-3" style={{ fontSize: 10.5 }}>{t('cprof.glance')}</div>
              <dl className="space-y-3 v-body" style={{ fontSize: 13 }}>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('mprof.rating')}</dt>
                  <dd className="v-ink font-medium inline-flex items-center gap-1.5"><Stars value={rating} /> {rating.toFixed(1)}</dd>
                </div>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('mprof.experience')}</dt>
                  <dd className="v-ink font-medium">{view.experience_years > 0 ? t('talent.years', { n: view.experience_years }) : '—'}</dd>
                </div>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('mprof.specialty')}</dt>
                  <dd className="v-ink font-medium">{view.specialties.map((n) => t(`cats.${n}`, { defaultValue: n })).join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('profile.location')}</dt>
                  <dd className="v-ink font-medium">{locationLabel || '—'}</dd>
                </div>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('mprof.languages')}</dt>
                  <dd className="v-ink font-medium">{view.languages || '—'}</dd>
                </div>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('profile.website')}</dt>
                  <dd className="v-ink font-medium truncate">
                    {website ? (
                      <a href={website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--color-campaign-purple)' }}>
                        <Globe size={11} /> {website.replace(/^https?:\/\/(www\.)?/, '')}
                      </a>
                    ) : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )
      ) : (
        <form onSubmit={save} className="v-talent-card p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="v-ink font-medium" style={{ fontSize: 16 }}>{t('mprof.editTitle')}</h2>
            <Button isIconOnly variant="ghost" size="sm" aria-label={t('common.cancel')} onPress={() => { setForm(saved || EMPTY); setEditing(false); }}><X size={15} /></Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
            <label className="relative cursor-pointer group self-start">
              <span className="v-story-ring" style={{ padding: 3 }}>
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="" className="h-20 w-20 object-cover" />
                ) : (
                  <span className="inline-flex h-20 w-20 items-center justify-center text-2xl font-medium text-white" style={{ background: accent.from }}>
                    {(form.first_name || 'M')[0]?.toUpperCase()}
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
              <Field label={t('mprof.experience')} hint={t('mprof.experienceHint')}>
                <select className={fieldClass} value={String(form.experience_years)} onChange={(e) => set('experience_years', Number(e.target.value))}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((n) => (
                    <option key={n} value={n}>{n === 0 ? t('mprof.newToThis') : t('talent.years', { n })}{n === 20 ? '+' : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('profile.website')}>
                <div className="relative">
                  <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet pointer-events-none" />
                  <input className={`${fieldClass} !pl-8`} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="yourstudio.com" inputMode="url" />
                </div>
              </Field>
            </div>
          </div>

          <Field label={t('mprof.specialty')} hint={t('mprof.specialtyHint')}>
            <ChipPicker options={NICHES} value={form.specialties} onChange={(v) => set('specialties', v)} label={(o) => t(`cats.${o}`, { defaultValue: o })} />
          </Field>

          <Field label={t('mprof.services')} hint={t('mprof.servicesHint')}>
            <ChipPicker options={MANAGER_SERVICES} value={form.services} onChange={(v) => set('services', v)} label={(o) => o} />
          </Field>

          <Field label={t('profile.location')}>
            <LocationCascade value={form.loc} onChange={(loc) => set('loc', loc)} layout="row" />
          </Field>

          <Field label={t('mprof.languages')} hint={t('mprof.languagesHint')}>
            <div className="relative">
              <Languages size={13} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet pointer-events-none" />
              <input className={`${fieldClass} !pl-8`} value={form.languages} onChange={(e) => set('languages', e.target.value)} placeholder={t('mprof.languagesPh')} />
            </div>
          </Field>

          <Field label={t('profile.about')} hint={t('mprof.bioHint')}>
            <textarea className={`${fieldClass} resize-y min-h-[120px]`} rows={5} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder={t('mprof.bioPh')} />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onPress={() => { setForm(saved || EMPTY); setEditing(false); }}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" isPending={saving}>{t('profile.save')}</Button>
          </div>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="v-ink font-medium" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>{t('cprof.payoutSection')}</h2>
        <PayoutSummary />
      </section>

      <section className="space-y-3">
        <h2 className="v-ink font-medium" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>{t('profile.accountSection')}</h2>
        <AccountSettings email={authUser?.email} />
      </section>
    </PageShell>
  );
};

export default ManagerProfilePage;
