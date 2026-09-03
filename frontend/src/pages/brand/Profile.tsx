import React, { useEffect, useState } from 'react';
import { Building2, Check, Globe, Link2, MapPin, Pencil, Target, Upload, X } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { OBJECTIVES } from '../../lib/catalog';
import {
  SOCIAL_PLATFORMS,
  normalizeUrl,
  parseSocialLinks,
  serializeSocialLinks,
  type SocialMap,
  type SocialPlatformId,
} from '../../lib/socialLinks';
import { PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { Notice } from '../../components/common/Notice';
import LocationCascade, { EMPTY_LOCATION, type LocationValue } from '../../components/common/LocationCascade';
import AccountSettings from '../../components/AccountSettings';
import TeamManager from '../../components/TeamManager';
import { KycCard } from '../../components/common/KycCard';
import PlatformIcon from '../landing/mocks/PlatformIcon';
import { PLATFORM_ICON_KEY, accentFor, fieldClass } from '../talent/shared';

/**
 * BrandProfile — the company card creators see, plus KYC, account and
 * team settings. Now edits everything registration captured: website,
 * social handles and campaign objectives were saved but never editable.
 */
type Form = {
  company_name: string;
  industry: string;
  website: string;
  contact_person: string;
  contact_email: string;
  description: string;
  logo_url: string;
  objectives: string[];
  socials: Partial<Record<SocialPlatformId, string>>;
  loc: LocationValue;
};

const EMPTY: Form = {
  company_name: '',
  industry: '',
  website: '',
  contact_person: '',
  contact_email: '',
  description: '',
  logo_url: '',
  objectives: [],
  socials: {},
  loc: EMPTY_LOCATION,
};

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const fromApi = (p: any): Form => {
  const socials: Form['socials'] = {};
  const map = parseSocialLinks(p?.social_links);
  for (const [k, v] of Object.entries(map)) if (v?.url) socials[k as SocialPlatformId] = v.url;
  return {
    company_name: p?.company_name || '',
    industry: p?.industry || '',
    website: p?.website || '',
    contact_person: p?.contact_person || '',
    contact_email: p?.contact_email || '',
    description: p?.description || '',
    logo_url: p?.logo_url || '',
    objectives: String(p?.objectives || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    socials,
    loc: {
      country: p?.country || '',
      countryCode: p?.country_code || '',
      state: p?.state || '',
      stateCode: p?.state_code || '',
      city: p?.city || '',
    },
  };
};

const toApi = (f: Form) => {
  const map: SocialMap = {};
  for (const [k, url] of Object.entries(f.socials)) if (url && url.trim()) map[k as SocialPlatformId] = { url: normalizeUrl(url) };
  const location = f.loc.city && f.loc.country ? `${f.loc.city}, ${f.loc.country}` : f.loc.country || '';
  return {
    company_name: f.company_name.trim(),
    industry: f.industry.trim(),
    website: f.website.trim() ? normalizeUrl(f.website) : '',
    contact_person: f.contact_person.trim(),
    contact_email: f.contact_email.trim(),
    description: f.description,
    logo_url: f.logo_url,
    objectives: f.objectives.join(', '),
    social_links: serializeSocialLinks(map),
    country: f.loc.country,
    country_code: f.loc.countryCode,
    state: f.loc.state,
    state_code: f.loc.stateCode,
    city: f.loc.city,
    location,
  };
};

const Field: React.FC<{ label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode }> = ({ label, children, hint }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="v-caption v-ink font-medium" style={{ fontSize: 12.5 }}>{label}</label>
      {hint && <span className="v-caption v-quiet" style={{ fontSize: 11 }}>{hint}</span>}
    </div>
    {children}
  </div>
);

const BrandProfile: React.FC = () => {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<Form | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);

  const fetchAuthUser = () => api.get('/auth/me').then((r) => setAuthUser(r.data)).catch(() => {});

  useEffect(() => {
    fetchAuthUser();
    api
      .get('/brands/profile')
      .then((res) => {
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

  const onLogo = (file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setNotice({ tone: 'error', text: t('profile.logoTooBig') });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('logo_url', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const cancel = () => {
    setForm(saved || EMPTY);
    setEditing(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/brands/profile', toApi(form));
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
  const name = view.company_name || t('profile.unnamed');
  const accent = accentFor(name);
  const socials = Object.entries(view.socials).filter(([, url]) => !!url);
  const locationLabel = [view.loc.city, view.loc.state, view.loc.country].filter(Boolean).join(', ');
  const complete = [view.company_name, view.industry, view.description, view.logo_url, view.loc.country, view.website || socials.length].filter(Boolean).length;

  return (
    <PageShell
      hero
      title={t('profile.title')}
      titleAccent={t('profile.titleAccent')}
      description={t('profile.desc')}
      icon={<Building2 size={18} />}
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
              {view.logo_url ? (
                <img src={view.logo_url} alt="" className="h-16 w-16 object-cover" />
              ) : (
                <span className="inline-flex h-16 w-16 items-center justify-center text-xl font-medium text-white" style={{ background: accent.from }}>
                  {name[0]?.toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="v-ink font-medium" style={{ fontSize: 20, letterSpacing: '-0.018em' }}>{name}</div>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                {view.industry && (
                  <Chip color="accent" variant="soft" size="sm"><Chip.Label>{view.industry}</Chip.Label></Chip>
                )}
                {locationLabel && (
                  <span className="v-caption v-muted inline-flex items-center gap-1" style={{ fontSize: 12 }}>
                    <MapPin size={11} /> {locationLabel}
                  </span>
                )}
                {view.website && (
                  <a href={normalizeUrl(view.website)} target="_blank" rel="noreferrer" className="v-caption inline-flex items-center gap-1 hover:underline" style={{ fontSize: 12, color: 'var(--color-campaign-purple)' }}>
                    <Globe size={11} /> {view.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {socials.map(([id, url]) => {
                  const meta = SOCIAL_PLATFORMS.find((p) => p.id === id);
                  return (
                    <a key={id} href={normalizeUrl(url!)} target="_blank" rel="noreferrer" className="v-social-tile" title={meta?.label} style={{ color: meta?.color, width: 26, height: 26 }}>
                      <PlatformIcon platform={PLATFORM_ICON_KEY[id]} size={13} />
                    </a>
                  );
                })}
              </div>
            </div>
            <div className="text-right">
              <div className="v-caption v-quiet" style={{ fontSize: 11 }}>{t('profile.completeness')}</div>
              <div className="v-ink font-medium tabular-nums" style={{ fontSize: 18 }}>{Math.round((complete / 6) * 100)}%</div>
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
        ) : !view.description && !view.objectives.length && !view.contact_person ? (
          <EmptyPanel
            icon={<Building2 size={22} />}
            title={t('profile.emptyTitle')}
            description={t('profile.emptyDesc')}
            actions={<Button variant="primary" onPress={() => setEditing(true)}><Pencil size={13} /> {t('profile.edit')}</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="v-talent-card p-5 lg:col-span-2">
              <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2" style={{ fontSize: 10.5 }}>{t('profile.about')}</div>
              <p className="v-body v-ink whitespace-pre-wrap" style={{ fontSize: 14, lineHeight: 1.65 }}>
                {view.description || <span className="v-quiet italic">{t('profile.noDescription')}</span>}
              </p>
              {view.objectives.length > 0 && (
                <>
                  <div className="v-caption v-quiet font-medium uppercase tracking-wider mt-5 mb-2 inline-flex items-center gap-1" style={{ fontSize: 10.5 }}>
                    <Target size={11} /> {t('profile.objectives')}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {view.objectives.map((o) => (
                      <span key={o} className="v-niche-chip" data-active style={{ cursor: 'default' }}>
                        {t(`objectives.${o}`, { defaultValue: o })}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="v-talent-card p-5">
              <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-3" style={{ fontSize: 10.5 }}>{t('profile.contact')}</div>
              <dl className="space-y-3 v-body" style={{ fontSize: 13 }}>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('profile.contactPerson')}</dt>
                  <dd className="v-ink font-medium">{view.contact_person || '—'}</dd>
                </div>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('profile.contactEmail')}</dt>
                  <dd className="v-ink font-medium break-all">{view.contact_email || '—'}</dd>
                </div>
                <div>
                  <dt className="v-quiet v-caption" style={{ fontSize: 11 }}>{t('profile.location')}</dt>
                  <dd className="v-ink font-medium">{locationLabel || '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        )
      ) : (
        <form onSubmit={save} className="v-talent-card p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="v-ink font-medium" style={{ fontSize: 16 }}>{t('profile.editTitle')}</h2>
            <Button isIconOnly variant="ghost" size="sm" aria-label={t('common.cancel')} onPress={cancel}><X size={15} /></Button>
          </div>

          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
            <label className="relative cursor-pointer group self-start">
              <span className="v-story-ring" style={{ padding: 3 }}>
                {form.logo_url ? (
                  <img src={form.logo_url} alt="" className="h-20 w-20 object-cover" />
                ) : (
                  <span className="inline-flex h-20 w-20 items-center justify-center text-2xl font-medium text-white" style={{ background: accent.from }}>
                    {(form.company_name || 'B')[0]?.toUpperCase()}
                  </span>
                )}
              </span>
              <span className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(11,23,54,0.55)', color: '#fff' }}>
                <Upload size={18} />
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('profile.companyName')}>
                <input className={fieldClass} value={form.company_name} onChange={(e) => set('company_name', e.target.value)} required />
              </Field>
              <Field label={t('profile.industry')}>
                <input className={fieldClass} value={form.industry} onChange={(e) => set('industry', e.target.value)} placeholder={t('profile.industryPh')} />
              </Field>
              <Field label={t('profile.website')} hint={t('wizard.optional')}>
                <input className={fieldClass} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="yourbrand.com" />
              </Field>
              <Field label={t('profile.contactEmail')}>
                <input type="email" className={fieldClass} value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
              </Field>
              <Field label={t('profile.contactPerson')}>
                <input className={fieldClass} value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} />
              </Field>
            </div>
          </div>

          <Field label={t('profile.location')}>
            <LocationCascade value={form.loc} onChange={(loc) => set('loc', loc)} layout="row" />
          </Field>

          <Field label={t('profile.about')} hint={t('profile.aboutHint')}>
            <textarea className={`${fieldClass} resize-y min-h-[120px]`} rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={t('profile.aboutPh')} />
          </Field>

          <Field label={t('profile.objectives')} hint={t('profile.objectivesHint')}>
            <div className="flex flex-wrap gap-1.5">
              {OBJECTIVES.map((o) => {
                const active = form.objectives.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    className="v-niche-chip"
                    data-active={active || undefined}
                    aria-pressed={active}
                    onClick={() => set('objectives', active ? form.objectives.filter((x) => x !== o) : [...form.objectives, o])}
                  >
                    {active && <Check size={11} />} {t(`objectives.${o}`, { defaultValue: o })}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={t('profile.socials')} hint={t('wizard.optional')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SOCIAL_PLATFORMS.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="v-social-tile shrink-0" style={{ color: p.color }}>
                    <PlatformIcon platform={PLATFORM_ICON_KEY[p.id]} size={14} />
                  </span>
                  <input
                    className={fieldClass}
                    value={form.socials[p.id] || ''}
                    onChange={(e) => set('socials', { ...form.socials, [p.id]: e.target.value })}
                    placeholder={p.placeholder}
                  />
                </div>
              ))}
            </div>
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onPress={cancel} isDisabled={saving}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" isPending={saving}>
              <Check size={13} /> {t('profile.save')}
            </Button>
          </div>
        </form>
      )}

      <div>
        <h2 className="v-ink font-medium mb-3 inline-flex items-center gap-2" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
          {t('profile.accountSection')}
        </h2>
        <AccountSettings email={authUser?.email} />
      </div>
      <div>
        <h2 className="v-ink font-medium mb-3 inline-flex items-center gap-2" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
          {t('profile.teamSection')}
        </h2>
        <TeamManager />
      </div>
    </PageShell>
  );
};

export default BrandProfile;
