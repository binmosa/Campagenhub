import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Globe,
  ImagePlus,
  Languages,
  Link2,
  Plus,
  ScrollText,
  Send,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import {
  AGE_GROUPS,
  CAMPAIGN_PLATFORMS,
  CONTENT_TYPES,
  CURRENCIES,
  EMPTY_TARGETING,
  GENDERS,
  MEDIA_TYPES,
  OBJECTIVES,
  normalizeCampaignStatus,
  parseMediaLinks,
  parseTargeting,
  type MediaLink,
  type Targeting,
} from '../../lib/catalog';
import { formatBudget } from '../../lib/campaignFormat';
import PlatformIcon from '../../pages/landing/mocks/PlatformIcon';
import { fieldClass } from '../../pages/talent/shared';
import { PLATFORM_META } from './CampaignCard';
import { CheckRows, PillChips } from './filters';
import { Notice } from './Notice';
import { useTalentLocations } from './TalentFilters';

/**
 * CampaignWizard — create / edit a brief in five steps. Shared by every
 * role that can post campaigns (brand today, manager-on-behalf later).
 *
 *   1. Basics      title, brief, platforms, format, objective
 *   2. Audience    gender · age groups · countries · cities (ads-manager
 *                  style; the geo lists are the places creators actually
 *                  are, with counts — the brand's own country is default)
 *   3. Assets      reference media (video / images / article) + the script
 *                  creators must follow
 *   4. Budget      currency + amount (USD locked at publish), Telegram
 *   5. Contract    terms (AI-drafted or pasted) + review → draft / publish
 *
 * Authors write in their own language — the backend detects it and
 * machine-translates title + brief for creators in other languages.
 */
export type CampaignFormValues = {
  title: string;
  description: string;
  platforms: string[];
  content_type: string;
  objective: string;
  targeting: Targeting;
  media_links: MediaLink[];
  script: string;
  script_required: boolean;
  deadline: string;
  cover_image: string;
  budget: string;
  currency: string;
  post_to_telegram: boolean;
  contract_template: string;
};

export const EMPTY_CAMPAIGN_FORM: CampaignFormValues = {
  title: '',
  description: '',
  platforms: ['Instagram'],
  content_type: 'Video',
  objective: 'Awareness',
  targeting: EMPTY_TARGETING,
  media_links: [],
  script: '',
  script_required: false,
  deadline: '',
  cover_image: '',
  budget: '',
  currency: 'USD',
  post_to_telegram: false,
  contract_template: '',
};

export const campaignToForm = (c: any): CampaignFormValues => ({
  title: c?.title || '',
  description: c?.description || '',
  platforms: String(c?.platform || '')
    .split(/[,|]+/)
    .map((s: string) => s.trim())
    .filter(Boolean),
  content_type: c?.content_type || 'Video',
  objective: c?.objective || 'Awareness',
  targeting: parseTargeting(c?.targeting),
  media_links: parseMediaLinks(c?.media_links),
  script: c?.script || '',
  script_required: !!c?.script_required,
  deadline: c?.deadline ? String(c.deadline).slice(0, 10) : '',
  cover_image: c?.cover_image || '',
  budget: c?.budget != null && c.budget !== '' ? String(Number(c.budget)) : '',
  currency: (c?.currency || 'USD').toUpperCase(),
  post_to_telegram: !!c?.post_to_telegram,
  contract_template: c?.contract_template || '',
});

const STEPS = ['basics', 'audience', 'assets', 'budget', 'contract'] as const;
type Step = (typeof STEPS)[number];

const ETHIOPIC = /[ሀ-፿]/;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const URL_RE = /^https?:\/\/\S+$/i;

const Field: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; required?: boolean; children: React.ReactNode }> = ({
  label,
  hint,
  required,
  children,
}) => (
  <div>
    <div className="flex items-center justify-between mb-1.5 gap-2">
      <label className="v-caption v-ink font-medium" style={{ fontSize: 12.5 }}>
        {label}
        {required && <span style={{ color: 'var(--color-error-coral)' }}> *</span>}
      </label>
      {hint && <span className="v-caption v-quiet text-right" style={{ fontSize: 11 }}>{hint}</span>}
    </div>
    {children}
  </div>
);

export const CampaignWizard: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  /** Existing campaign → edit mode. */
  editing?: any | null;
  brandName?: string;
  /** ISO-2 of the brand's account country — the default geo target. */
  brandCountryCode?: string;
  brandCountryName?: string;
  onSaved: (saved: any, mode: 'created' | 'updated') => void;
}> = ({ isOpen, onClose, editing, brandName, brandCountryCode, brandCountryName, onSaved }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CampaignFormValues>(EMPTY_CAMPAIGN_FORM);
  const [coverTouched, setCoverTouched] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<'idle' | 'draft' | 'publish'>('idle');
  const [generating, setGenerating] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [mediaDraft, setMediaDraft] = useState<MediaLink>({ type: 'video', url: '', label: '' });
  const locations = useTalentLocations();

  const isEdit = !!editing;
  const editingStatus = normalizeCampaignStatus(editing?.status);

  /* Reset whenever the modal (re)opens */
  useEffect(() => {
    if (!isOpen) return;
    const base = editing ? campaignToForm(editing) : EMPTY_CAMPAIGN_FORM;
    // New briefs default to the brand's own country (creators there see it first).
    const withDefault =
      !editing && brandCountryCode
        ? {
            ...base,
            targeting: {
              ...base.targeting,
              countries: [{ code: brandCountryCode.toUpperCase(), name: brandCountryName || brandCountryCode.toUpperCase() }],
            },
          }
        : base;
    setForm(withDefault);
    setStep(0);
    setError('');
    setCoverTouched(false);
    setSaving('idle');
    setMediaDraft({ type: 'video', url: '', label: '' });
  }, [isOpen, editing, brandCountryCode, brandCountryName]);

  /* FX snapshot for the live USD preview (the backend locks the real rate) */
  useEffect(() => {
    if (!isOpen) return;
    api
      .get('/fx/rates')
      .then((res) => setRates({ USD: 1, ...(res.data?.rates || {}) }))
      .catch(() => {});
  }, [isOpen]);

  const set = <K extends keyof CampaignFormValues>(k: K, v: CampaignFormValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setTargeting = (patch: Partial<Targeting>) =>
    setForm((f) => ({ ...f, targeting: { ...f.targeting, ...patch } }));

  /* ── Geo options: where creators actually are (with counts) ───── */
  const countryOptions = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; count: number }>();
    for (const l of locations) {
      const code = (l as any).country_code as string | null;
      if (!code) continue;
      const cur = byCode.get(code) || { code, name: l.country, count: 0 };
      cur.count += l.count;
      byCode.set(code, cur);
    }
    // The brand's own country is always offered, even before creators join there.
    if (brandCountryCode && !byCode.has(brandCountryCode.toUpperCase())) {
      byCode.set(brandCountryCode.toUpperCase(), { code: brandCountryCode.toUpperCase(), name: brandCountryName || brandCountryCode, count: 0 });
    }
    for (const c of form.targeting.countries) if (!byCode.has(c.code)) byCode.set(c.code, { ...c, count: 0 });
    return [...byCode.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [locations, brandCountryCode, brandCountryName, form.targeting.countries]);

  const cityOptions = useMemo(() => {
    const codes = new Set(form.targeting.countries.map((c) => c.code));
    return locations
      .filter((l) => l.city && (l as any).country_code && codes.has((l as any).country_code))
      .map((l) => ({ country_code: (l as any).country_code as string, country: l.country, city: l.city as string, count: l.count }))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
  }, [locations, form.targeting.countries]);

  const selectedCountries = new Set(form.targeting.countries.map((c) => c.code));
  const selectedCities = new Set(form.targeting.cities.map((c) => `${c.country_code}|${c.city}`));

  const toggleCountry = (code: string) => {
    const opt = countryOptions.find((c) => c.code === code);
    if (!opt) return;
    const has = selectedCountries.has(code);
    const countries = has ? form.targeting.countries.filter((c) => c.code !== code) : [...form.targeting.countries, { code: opt.code, name: opt.name }];
    const cities = has ? form.targeting.cities.filter((c) => c.country_code !== code) : form.targeting.cities;
    setTargeting({ countries, cities });
  };
  const toggleCity = (key: string) => {
    const [country_code, city] = key.split('|');
    const has = selectedCities.has(key);
    setTargeting({
      cities: has ? form.targeting.cities.filter((c) => `${c.country_code}|${c.city}` !== key) : [...form.targeting.cities, { country_code, city }],
    });
  };
  const toggleAge = (a: string) =>
    setTargeting({
      age_groups: form.targeting.age_groups.includes(a) ? form.targeting.age_groups.filter((x) => x !== a) : [...form.targeting.age_groups, a],
    });

  const budgetNum = Number(form.budget);
  const perUsd = rates[form.currency] || null;
  const usdApprox =
    form.currency !== 'USD' && perUsd && Number.isFinite(budgetNum) && budgetNum > 0
      ? Math.round((budgetNum / perUsd) * 100) / 100
      : null;
  const writtenInAmharic = ETHIOPIC.test(`${form.title} ${form.description} ${form.script}`);

  /* Per-step validation */
  const stepError = useMemo(() => {
    const s = STEPS[step];
    if (s === 'basics') {
      if (!form.title.trim()) return t('wizard.errTitle');
      if (form.platforms.length === 0) return t('wizard.errPlatform');
    }
    if (s === 'budget') {
      if (!form.budget || !Number.isFinite(budgetNum) || budgetNum <= 0) return t('wizard.errBudget');
    }
    return '';
  }, [step, form, budgetNum, t]);

  const next = () => {
    if (stepError) {
      setError(stepError);
      return;
    }
    setError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 0));
  };

  const togglePlatform = (label: string) =>
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(label) ? f.platforms.filter((p) => p !== label) : [...f.platforms, label],
    }));

  const onCoverFile = (file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_COVER_BYTES) {
      setError(t('wizard.errCoverSize'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set('cover_image', String(reader.result || ''));
      setCoverTouched(true);
    };
    reader.readAsDataURL(file);
  };

  const addMedia = () => {
    const url = mediaDraft.url.trim();
    if (!URL_RE.test(url)) {
      setError(t('wizard.errMediaUrl'));
      return;
    }
    setError('');
    set('media_links', [...form.media_links, { type: mediaDraft.type, url, ...(mediaDraft.label?.trim() ? { label: mediaDraft.label.trim() } : {}) }]);
    setMediaDraft({ type: mediaDraft.type, url: '', label: '' });
  };
  const removeMedia = (i: number) => set('media_links', form.media_links.filter((_, idx) => idx !== i));

  const generateContract = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/ai/contract', {
        brandName: brandName || 'The Brand',
        creatorName: '[Creator name]',
        campaignTitle: form.title,
        deliverables: `${form.content_type} content on ${form.platforms.join(', ')}${form.script ? ' following the brand script' : ''}`,
        budget: form.budget ? `${form.currency} ${form.budget}` : undefined,
        deadline: form.deadline || undefined,
        platform: form.platforms.join(', '),
      });
      const text = res.data?.contract || res.data?.content;
      if (!text) throw new Error('empty');
      set('contract_template', text);
    } catch (e: any) {
      setError(e?.response?.data?.message || t('wizard.errAi'));
    } finally {
      setGenerating(false);
    }
  };

  const fail = (msg: string, goTo: number) => {
    setStep(goTo);
    setError(msg);
  };

  const submit = async (publish: boolean) => {
    // Validate every step before saving (the user may jump around later).
    if (!form.title.trim()) return fail(t('wizard.errTitle'), 0);
    if (form.platforms.length === 0) return fail(t('wizard.errPlatform'), 0);
    if (!form.budget || !Number.isFinite(budgetNum) || budgetNum <= 0) return fail(t('wizard.errBudget'), 3);

    setSaving(publish ? 'publish' : 'draft');
    setError('');
    const payload: any = {
      title: form.title.trim(),
      description: form.description,
      platforms: form.platforms,
      content_type: form.content_type,
      objective: form.objective,
      targeting: form.targeting,
      media_links: form.media_links,
      script: form.script,
      script_required: form.script_required && !!form.script.trim(),
      deadline: form.deadline || null,
      budget: budgetNum,
      currency: form.currency,
      post_to_telegram: form.post_to_telegram,
      contract_template: form.contract_template,
    };
    if (!isEdit || coverTouched) payload.cover_image = form.cover_image;
    try {
      if (isEdit) {
        if (publish && editingStatus === 'draft') payload.status = 'active';
        const res = await api.patch(`/campaigns/${editing.id}`, payload);
        onSaved(res.data, 'updated');
      } else {
        payload.status = publish ? 'active' : 'draft';
        const res = await api.post('/campaigns', payload);
        onSaved(res.data, 'created');
      }
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : msg || t('wizard.saveFailed'));
    } finally {
      setSaving('idle');
    }
  };

  const current: Step = STEPS[step];
  const last = step === STEPS.length - 1;
  const tg = form.targeting;
  const audienceSummary = [
    t(`wizard.genders.${tg.gender}`),
    tg.age_groups.length ? tg.age_groups.join(', ') : t('wizard.anyAge'),
    tg.countries.length ? tg.countries.map((c) => c.name).join(', ') : t('wizard.anywhere'),
    tg.cities.length ? tg.cities.map((c) => c.city).join(', ') : null,
  ].filter(Boolean);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && saving === 'idle' && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-3xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <span className="v-hero-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                  {isEdit ? <FileText size={15} /> : <Sparkles size={15} />}
                </span>
                {isEdit ? t('wizard.editTitle') : t('wizard.newTitle')}
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body>
              {/* Step indicator */}
              <ol className="flex items-center gap-2 mb-5 flex-wrap" aria-label="Steps">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex items-center gap-2">
                    <button
                      type="button"
                      className="v-step"
                      data-state={i < step ? 'done' : i === step ? 'current' : undefined}
                      onClick={() => i < step && setStep(i)}
                      aria-current={i === step ? 'step' : undefined}
                    >
                      {i < step ? <Check size={13} /> : i + 1}
                    </button>
                    <span
                      className={`v-caption hidden sm:inline ${i === step ? 'v-ink font-medium' : 'v-quiet'}`}
                      style={{ fontSize: 12 }}
                    >
                      {t(`wizard.step.${s}`)}
                    </span>
                    {i < STEPS.length - 1 && (
                      <span className="h-px w-4 sm:w-6" style={{ background: 'var(--color-cool-gray)' }} aria-hidden />
                    )}
                  </li>
                ))}
              </ol>

              {error && (
                <Notice tone="error" className="mb-4" onDismiss={() => setError('')}>
                  {error}
                </Notice>
              )}

              {/* ── Step 1: basics ─────────────────────────────────── */}
              {current === 'basics' && (
                <div className="space-y-5 v-fade-in">
                  <Field label={t('wizard.title')} required>
                    <input
                      className={fieldClass}
                      value={form.title}
                      onChange={(e) => set('title', e.target.value)}
                      placeholder={t('wizard.titlePh')}
                      maxLength={140}
                      autoFocus
                    />
                  </Field>

                  <Field
                    label={t('wizard.brief')}
                    hint={
                      <span className="inline-flex items-center gap-1">
                        <Languages size={11} />
                        {writtenInAmharic ? t('wizard.langAm') : t('wizard.langAny')}
                      </span>
                    }
                  >
                    <textarea
                      className={`${fieldClass} resize-y min-h-[120px]`}
                      value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder={t('wizard.briefPh')}
                      rows={5}
                    />
                  </Field>

                  <Field
                    label={t('wizard.platforms')}
                    required
                    hint={form.platforms.length ? t('common.selectedN', { n: form.platforms.length }) : undefined}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CAMPAIGN_PLATFORMS.map((p) => {
                        const meta = PLATFORM_META.find((m) => m.id === p.id)!;
                        const active = form.platforms.includes(p.label);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className="v-option-tile"
                            data-active={active || undefined}
                            aria-pressed={active}
                            onClick={() => togglePlatform(p.label)}
                          >
                            <span className="inline-flex" style={{ color: meta.color }}>
                              {meta.glyph && <PlatformIcon platform={meta.glyph} size={16} />}
                            </span>
                            {p.label}
                            {active && <Check size={14} className="ml-auto" style={{ color: 'var(--color-campaign-purple)' }} />}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field label={t('wizard.format')}>
                      <PillChips
                        options={CONTENT_TYPES.map((c) => ({ id: c, label: t(`contentTypes.${c}`, { defaultValue: c }) }))}
                        value={form.content_type}
                        onSelect={(id) => set('content_type', id || form.content_type)}
                      />
                    </Field>
                    <Field label={t('wizard.objective')}>
                      <PillChips
                        options={OBJECTIVES.map((o) => ({ id: o, label: t(`objectives.${o}`, { defaultValue: o }) }))}
                        value={form.objective}
                        onSelect={(id) => set('objective', id || form.objective)}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* ── Step 2: audience targeting ─────────────────────── */}
              {current === 'audience' && (
                <div className="space-y-5 v-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field label={t('wizard.gender')}>
                      <PillChips
                        options={GENDERS.map((g) => ({ id: g, label: t(`wizard.genders.${g}`) }))}
                        value={tg.gender}
                        onSelect={(id) => setTargeting({ gender: (id || 'all') as Targeting['gender'] })}
                      />
                    </Field>
                    <Field label={t('wizard.ages')} hint={tg.age_groups.length ? t('common.selectedN', { n: tg.age_groups.length }) : t('wizard.anyAge')}>
                      <div className="flex flex-wrap gap-1.5">
                        {AGE_GROUPS.map((a) => {
                          const active = tg.age_groups.includes(a);
                          return (
                            <button key={a} type="button" className="v-niche-chip" data-active={active || undefined} aria-pressed={active} onClick={() => toggleAge(a)}>
                              {a}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field
                      label={
                        <span className="inline-flex items-center gap-1.5">
                          <Globe size={12} /> {t('wizard.countries')}
                        </span>
                      }
                      hint={tg.countries.length ? t('common.selectedN', { n: tg.countries.length }) : t('wizard.anywhere')}
                    >
                      {countryOptions.length === 0 ? (
                        <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('wizard.noLocations')}</p>
                      ) : (
                        <div className="max-h-64 overflow-y-auto pr-1">
                          <CheckRows
                            options={countryOptions.map((c) => ({
                              id: c.code,
                              label: c.name,
                              hint: t('wizard.creatorsN', { n: c.count }),
                              icon: <span className="v-caption font-medium" style={{ fontSize: 10.5 }}>{c.code}</span>,
                              color: 'var(--color-campaign-purple)',
                            }))}
                            selected={selectedCountries}
                            onToggle={toggleCountry}
                          />
                        </div>
                      )}
                      <p className="v-caption v-quiet mt-2" style={{ fontSize: 11 }}>{t('wizard.countriesHint')}</p>
                    </Field>

                    <Field
                      label={t('wizard.cities')}
                      hint={tg.cities.length ? t('common.selectedN', { n: tg.cities.length }) : t('wizard.allCities')}
                    >
                      {tg.countries.length === 0 ? (
                        <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('wizard.pickCountryFirst')}</p>
                      ) : cityOptions.length === 0 ? (
                        <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('wizard.noCities')}</p>
                      ) : (
                        <div className="max-h-64 overflow-y-auto pr-1">
                          <CheckRows
                            options={cityOptions.map((c) => ({
                              id: `${c.country_code}|${c.city}`,
                              label: tg.countries.length > 1 ? `${c.city} · ${c.country_code}` : c.city,
                              hint: t('wizard.creatorsN', { n: c.count }),
                            }))}
                            selected={selectedCities}
                            onToggle={toggleCity}
                          />
                        </div>
                      )}
                    </Field>
                  </div>

                  <div className="rounded-xl p-3.5 flex items-start gap-2.5" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }}>
                    <Users size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--color-campaign-purple)' }} />
                    <div className="v-caption" style={{ fontSize: 12 }}>
                      <span className="v-quiet">{t('wizard.audienceSummary')}: </span>
                      <span className="v-ink font-medium">{audienceSummary.join(' · ')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 3: assets — media + script ────────────────── */}
              {current === 'assets' && (
                <div className="space-y-5 v-fade-in">
                  <Field label={t('wizard.media')} hint={t('wizard.mediaHint')}>
                    {form.media_links.length > 0 && (
                      <ul className="space-y-1.5 mb-2.5">
                        {form.media_links.map((m, i) => (
                          <li key={`${m.url}-${i}`} className="flex items-center gap-2 rounded-lg px-3 py-2 v-hairline">
                            <Chip size="sm" variant="soft" color="accent">
                              <Chip.Label>{t(`wizard.mediaType.${m.type}`)}</Chip.Label>
                            </Chip>
                            <a href={m.url} target="_blank" rel="noreferrer" className="v-body truncate flex-1 hover:underline" style={{ fontSize: 12.5, color: 'var(--color-campaign-purple)' }}>
                              {m.label || m.url}
                            </a>
                            <button type="button" onClick={() => removeMedia(i)} aria-label={t('wizard.removeCover')} className="v-quiet hover:text-danger">
                              <Trash2 size={13} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[110px_1fr_1fr_auto] gap-2 items-center">
                      <select className={fieldClass} value={mediaDraft.type} onChange={(e) => setMediaDraft({ ...mediaDraft, type: e.target.value as MediaLink['type'] })} aria-label={t('wizard.mediaTypeLbl')}>
                        {MEDIA_TYPES.map((m) => (
                          <option key={m} value={m}>{t(`wizard.mediaType.${m}`)}</option>
                        ))}
                      </select>
                      <input
                        className={fieldClass}
                        value={mediaDraft.url}
                        onChange={(e) => setMediaDraft({ ...mediaDraft, url: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addMedia();
                          }
                        }}
                        placeholder={t('wizard.mediaUrlPh')}
                        inputMode="url"
                      />
                      <input className={fieldClass} value={mediaDraft.label || ''} onChange={(e) => setMediaDraft({ ...mediaDraft, label: e.target.value })} placeholder={t('wizard.mediaLabelPh')} />
                      <Button variant="tertiary" size="md" onPress={addMedia} className="sm:col-auto col-span-2">
                        <Plus size={13} /> {t('wizard.addMedia')}
                      </Button>
                    </div>
                  </Field>

                  <Field
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        <ScrollText size={12} /> {t('wizard.script')}
                      </span>
                    }
                    hint={t('wizard.scriptHint')}
                  >
                    <textarea
                      className={`${fieldClass} resize-y min-h-[150px]`}
                      value={form.script}
                      onChange={(e) => set('script', e.target.value)}
                      placeholder={t('wizard.scriptPh')}
                      rows={6}
                    />
                  </Field>

                  <button
                    type="button"
                    className="v-option-tile"
                    data-active={form.script_required || undefined}
                    aria-pressed={form.script_required}
                    disabled={!form.script.trim()}
                    onClick={() => set('script_required', !form.script_required)}
                    style={!form.script.trim() ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                  >
                    <ScrollText size={15} style={{ color: 'var(--color-campaign-purple)' }} />
                    <span className="flex-1">
                      <span className="block">{t('wizard.scriptRequired')}</span>
                      <span className="block v-caption v-quiet font-normal" style={{ fontSize: 11 }}>{t('wizard.scriptRequiredHint')}</span>
                    </span>
                    <span
                      className="size-4 rounded-full border-2 shrink-0"
                      style={{
                        borderColor: form.script_required ? 'var(--color-campaign-purple)' : 'var(--color-fog)',
                        background: form.script_required ? 'var(--color-campaign-purple)' : 'transparent',
                      }}
                    />
                  </button>

                  <Field label={t('wizard.cover')} hint={t('wizard.coverHint')}>
                    {form.cover_image ? (
                      <div className="relative rounded-xl overflow-hidden v-hairline" style={{ maxHeight: 200 }}>
                        <img src={form.cover_image} alt="" className="w-full object-cover" style={{ maxHeight: 200 }} />
                        <button
                          type="button"
                          onClick={() => {
                            set('cover_image', '');
                            setCoverTouched(true);
                          }}
                          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium"
                          style={{ background: 'rgba(11,23,54,0.75)', color: '#fff' }}
                        >
                          <Trash2 size={12} /> {t('wizard.removeCover')}
                        </button>
                      </div>
                    ) : (
                      <label
                        className="flex items-center justify-center gap-3 rounded-xl cursor-pointer py-5 text-center"
                        style={{ border: '1px dashed #d6dbe8', background: 'rgba(244,242,255,0.45)' }}
                      >
                        <span className="v-empty-orb" style={{ padding: 2.5 }}>
                          <span style={{ width: 36, height: 36 }}>
                            <ImagePlus size={15} />
                          </span>
                        </span>
                        <span className="text-left">
                          <span className="block v-body v-ink font-medium" style={{ fontSize: 13 }}>{t('wizard.coverDrop')}</span>
                          <span className="block v-caption v-quiet" style={{ fontSize: 11 }}>{t('wizard.coverAuto')}</span>
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => onCoverFile(e.target.files?.[0])} />
                      </label>
                    )}
                  </Field>
                </div>
              )}

              {/* ── Step 4: budget + timeline ──────────────────────── */}
              {current === 'budget' && (
                <div className="space-y-5 v-fade-in">
                  <div className="grid grid-cols-[130px_1fr] gap-3 items-end">
                    <Field label={t('wizard.currency')}>
                      <select className={fieldClass} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('wizard.budget')} required>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        className={fieldClass}
                        value={form.budget}
                        onChange={(e) => set('budget', e.target.value)}
                        placeholder="5000"
                      />
                    </Field>
                  </div>

                  <div
                    className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
                    style={{
                      background: 'linear-gradient(135deg, rgba(22,199,132,0.10) 0%, rgba(0,212,199,0.12) 100%)',
                      border: '1px solid rgba(22,199,132,0.20)',
                    }}
                  >
                    <div>
                      <div className="v-caption font-medium" style={{ color: '#0b6e3e', fontSize: 11.5 }}>{t('wizard.creatorsSee')}</div>
                      <div className="font-semibold tabular-nums" style={{ color: '#0b6e3e', fontSize: 22, letterSpacing: '-0.018em' }}>
                        {budgetNum > 0 ? formatBudget(budgetNum, form.currency) : '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="v-caption v-quiet" style={{ fontSize: 11 }}>
                        {form.currency === 'USD' ? t('wizard.usdCanonical') : t('wizard.usdApprox')}
                      </div>
                      <div className="v-ink font-medium tabular-nums" style={{ fontSize: 15 }}>
                        {form.currency === 'USD'
                          ? budgetNum > 0
                            ? formatBudget(budgetNum, 'USD')
                            : '—'
                          : usdApprox
                            ? `≈ ${formatBudget(usdApprox, 'USD')}`
                            : perUsd
                              ? '—'
                              : t('wizard.noRate')}
                      </div>
                    </div>
                  </div>
                  <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('wizard.fxNote')}</p>

                  <Field label={t('wizard.deadline')} hint={t('wizard.deadlineHint')}>
                    <input
                      type="date"
                      className={`${fieldClass} sm:max-w-xs`}
                      value={form.deadline}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => set('deadline', e.target.value)}
                    />
                  </Field>

                  <button
                    type="button"
                    className="v-option-tile"
                    data-active={form.post_to_telegram || undefined}
                    aria-pressed={form.post_to_telegram}
                    onClick={() => set('post_to_telegram', !form.post_to_telegram)}
                  >
                    <Send size={15} style={{ color: '#229ED9' }} />
                    <span className="flex-1">
                      <span className="block">{t('wizard.telegram')}</span>
                      <span className="block v-caption v-quiet font-normal" style={{ fontSize: 11 }}>{t('wizard.telegramHint')}</span>
                    </span>
                    <span
                      className="size-4 rounded-full border-2 shrink-0"
                      style={{
                        borderColor: form.post_to_telegram ? 'var(--color-campaign-purple)' : 'var(--color-fog)',
                        background: form.post_to_telegram ? 'var(--color-campaign-purple)' : 'transparent',
                      }}
                    />
                  </button>
                </div>
              )}

              {/* ── Step 5: contract + review ──────────────────────── */}
              {current === 'contract' && (
                <div className="space-y-5 v-fade-in">
                  <Field
                    label={t('wizard.contract')}
                    hint={
                      <button
                        type="button"
                        onClick={generateContract}
                        disabled={generating || !form.title.trim()}
                        className="inline-flex items-center gap-1 font-medium disabled:opacity-50"
                        style={{ color: 'var(--color-campaign-purple)' }}
                      >
                        <Sparkles size={11} /> {generating ? t('wizard.generating') : t('wizard.generateAi')}
                      </button>
                    }
                  >
                    <textarea
                      className={`${fieldClass} resize-y min-h-[140px] font-mono`}
                      style={{ fontSize: 12.5, lineHeight: 1.55 }}
                      value={form.contract_template}
                      onChange={(e) => set('contract_template', e.target.value)}
                      placeholder={t('wizard.contractPh')}
                      rows={6}
                    />
                  </Field>

                  {/* Review summary */}
                  <div className="rounded-xl p-4" style={{ background: 'rgba(244,242,255,0.5)', border: '1px solid var(--color-cool-gray)' }}>
                    <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2" style={{ fontSize: 10.5 }}>{t('wizard.review')}</div>
                    <div className="v-ink font-medium" style={{ fontSize: 15 }}>{form.title || '—'}</div>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {form.platforms.map((p) => (
                        <Chip key={p} size="sm" variant="soft" color="default">
                          <Chip.Label>{p}</Chip.Label>
                        </Chip>
                      ))}
                      <Chip size="sm" variant="soft" color="accent">
                        <Chip.Label>{t(`contentTypes.${form.content_type}`, { defaultValue: form.content_type })}</Chip.Label>
                      </Chip>
                      <Chip size="sm" variant="soft" color="accent">
                        <Chip.Label>{t(`objectives.${form.objective}`, { defaultValue: form.objective })}</Chip.Label>
                      </Chip>
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 v-caption" style={{ fontSize: 12 }}>
                      <div className="col-span-2 sm:col-span-3">
                        <div className="v-quiet">{t('wizard.targeting')}</div>
                        <div className="v-ink font-medium">{audienceSummary.join(' · ')}</div>
                      </div>
                      <div>
                        <div className="v-quiet">{t('wizard.assets')}</div>
                        <div className="v-ink font-medium">
                          {t('wizard.mediaN', { n: form.media_links.length })} · {form.script.trim() ? (form.script_required ? t('wizard.scriptMust') : t('wizard.scriptGuide')) : t('wizard.noScript')}
                        </div>
                      </div>
                      <div>
                        <div className="v-quiet">{t('wizard.budget')}</div>
                        <div className="v-ink font-medium tabular-nums">
                          {budgetNum > 0 ? formatBudget(budgetNum, form.currency) : '—'}
                          {usdApprox ? <span className="v-quiet font-normal"> ≈ {formatBudget(usdApprox, 'USD')}</span> : null}
                        </div>
                      </div>
                      <div>
                        <div className="v-quiet">{t('wizard.deadline')}</div>
                        <div className="v-ink font-medium">{form.deadline || t('wizard.noDeadline')}</div>
                      </div>
                    </div>
                    {writtenInAmharic && (
                      <p className="mt-3 v-caption inline-flex items-center gap-1" style={{ fontSize: 11.5, color: 'var(--color-campaign-purple)' }}>
                        <Languages size={12} /> {t('wizard.willTranslate')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Modal.Body>

            <Modal.Footer>
              <div className="flex items-center justify-between w-full gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onPress={onClose} isDisabled={saving !== 'idle'}>
                    {t('common.cancel')}
                  </Button>
                  {step > 0 && (
                    <Button variant="tertiary" onPress={back} isDisabled={saving !== 'idle'}>
                      <ArrowLeft size={13} /> {t('wizard.back')}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!last ? (
                    <Button variant="primary" onPress={next}>
                      {t('wizard.next')} <ArrowRight size={13} />
                    </Button>
                  ) : isEdit ? (
                    <>
                      {editingStatus === 'draft' && (
                        <Button variant="tertiary" onPress={() => submit(false)} isPending={saving === 'draft'} isDisabled={saving === 'publish'}>
                          {t('wizard.saveDraft')}
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        onPress={() => submit(editingStatus === 'draft')}
                        isPending={saving === 'publish'}
                        isDisabled={saving === 'draft'}
                      >
                        {editingStatus === 'draft' ? (
                          <>
                            <Send size={13} /> {t('wizard.publish')}
                          </>
                        ) : (
                          <>
                            <Check size={13} /> {t('wizard.saveChanges')}
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="tertiary" onPress={() => submit(false)} isPending={saving === 'draft'} isDisabled={saving === 'publish'}>
                        {t('wizard.saveDraft')}
                      </Button>
                      <Button variant="primary" onPress={() => submit(true)} isPending={saving === 'publish'} isDisabled={saving === 'draft'}>
                        <Send size={13} /> {t('wizard.publish')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

export default CampaignWizard;
