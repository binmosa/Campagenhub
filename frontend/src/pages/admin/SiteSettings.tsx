import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Check,
  Contact,
  Handshake,
  LayoutList,
  Mail,
  Megaphone,
  Palette,
  Radio,
  Rocket,
  Save,
  Settings2,
  Sparkles,
  Star,
  ToggleLeft,
  Upload,
  Users,
  Wrench,
} from 'lucide-react';
import { Button, Chip, Switch } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api, { serverOrigin } from '../../lib/api';
import { toast } from '../../lib/toast';
import { useTheme } from '../../contexts/ThemeContext';
import { fieldClass } from '../talent/shared';
import { MetricCard, PageShell } from '../../components/ui';
import { Field, Panel } from './shared';

/**
 * SiteSettings — everything an admin can change on the public site
 * without a deploy: maintenance lock, landing copy per section, section
 * toggles, live-activity popups, stats source and the platform accent.
 * Values are the same string map the landing reads from /public/settings.
 */
type SettingsMap = Record<string, string>;

const DEFAULTS: SettingsMap = {
  ticker_enabled: 'true',
  ticker_text: '',
  notifications_enabled: 'true',
  notifications_mock_enabled: 'true',
  stats_use_real_data: 'false',
  for_brands_enabled: 'true',
  for_creators_enabled: 'true',
  testimonials_enabled: 'true',
  testimonials_mock_enabled: 'true',
  faq_enabled: 'true',
  contact_enabled: 'true',
  platform_theme: 'theme-brand',
  is_maintenance_mode: 'false',
  maintenance_message: '',
  hero_title: '',
  hero_subtitle: '',
  about_text: '',
};

const THEMES = [
  { id: 'theme-brand', label: 'Campgains Hub', hex: '#5b5cf6', lightHex: '#36d7dc' },
  { id: 'theme-yellow', label: 'Golden Yellow', hex: '#ca8a04', lightHex: '#facc15' },
  { id: 'theme-blue', label: 'Ocean Blue', hex: '#2563eb', lightHex: '#60a5fa' },
  { id: 'theme-green', label: 'Growth Green', hex: '#16a34a', lightHex: '#4ade80' },
  { id: 'theme-purple', label: 'Royal Purple', hex: '#9333ea', lightHex: '#c084fc' },
  { id: 'theme-indigo', label: 'Indigo Aura', hex: '#6366f1', lightHex: '#818cf8' },
];

const SECTION_TOGGLES = ['for_brands_enabled', 'for_creators_enabled', 'testimonials_enabled', 'faq_enabled', 'contact_enabled', 'ticker_enabled'] as const;

const Toggle: React.FC<{ label: React.ReactNode; desc?: React.ReactNode; value: boolean; onChange: (v: boolean) => void; tone?: 'default' | 'danger' }> = ({ label, desc, value, onChange, tone }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl px-3.5 py-3" style={{ background: tone === 'danger' ? 'rgba(255,90,95,0.08)' : 'var(--color-cool-gray)' }}>
    <div className="min-w-0">
      <div className="v-ink font-medium" style={{ fontSize: 13.5 }}>{label}</div>
      {desc && <div className="v-caption v-quiet mt-0.5" style={{ fontSize: 12 }}>{desc}</div>}
    </div>
    <Switch isSelected={value} onChange={onChange} aria-label={typeof label === 'string' ? label : undefined}>
      <Switch.Control><Switch.Thumb /></Switch.Control>
    </Switch>
  </div>
);

const SiteSettings: React.FC = () => {
  const { t } = useTranslation();
  const { applyBrandTheme } = useTheme();
  const [settings, setSettings] = useState<SettingsMap>(DEFAULTS);
  const [saved, setSaved] = useState<SettingsMap>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/public/settings')
      .then((res) => {
        const next = { ...DEFAULTS, ...(res.data || {}), ticker_text: res.data?.ticker_text || 'Spotify, Epic Games, Gymshark' };
        setSettings(next);
        setSaved(next);
      })
      .catch(() => toast.error(t('adm.site.loadFailed')));
  }, [t]);

  const set = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));
  const toggle = (key: string, v: boolean) => set(key, v ? 'true' : 'false');
  const on = (key: string) => settings[key] === 'true';
  const dirty = useMemo(() => Object.keys({ ...settings, ...saved }).filter((k) => (settings[k] || '') !== (saved[k] || '')).length, [settings, saved]);
  const sectionsOn = SECTION_TOGGLES.filter((k) => on(k)).length;

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await api.patch('/admin/settings', settings);
      setSaved(settings);
      toast.success(t('adm.site.saved'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('adm.site.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const upload = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast.error(t('adm.site.fileTooBig'));
    const reader = new FileReader();
    reader.onloadend = async () => {
      setUploading(key);
      try {
        const res = await api.post('/uploads', { file: reader.result, filename: file.name });
        if (res.data?.url) set(key, res.data.url);
      } catch {
        toast.error(t('adm.site.uploadFailed'));
      } finally {
        setUploading(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const Text: React.FC<{ k: string; label: string; ph?: string; type?: string }> = ({ k, label, ph, type = 'text' }) => (
    <Field label={label}>
      <input type={type} value={settings[k] || ''} onChange={(e) => set(k, e.target.value)} className={fieldClass} placeholder={ph} />
    </Field>
  );
  const Area: React.FC<{ k: string; label: string; ph?: string; rows?: number }> = ({ k, label, ph, rows = 2 }) => (
    <Field label={label}>
      <textarea value={settings[k] || ''} onChange={(e) => set(k, e.target.value)} rows={rows} className={`${fieldClass} resize-y`} placeholder={ph} />
    </Field>
  );
  const Image: React.FC<{ k: string; label: string }> = ({ k, label }) => {
    const v = settings[k] || '';
    return (
      <div>
        <span className="v-caption v-ink font-medium block mb-1" style={{ fontSize: 12 }}>{label}</span>
        <div className="flex items-center gap-3 flex-wrap">
          {v && (
            <div className="h-20 w-32 rounded-lg overflow-hidden v-hairline">
              <img src={v.startsWith('http') ? v : `${serverOrigin}${v}`} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <label className="v-facet-btn !px-3 !py-2 cursor-pointer inline-flex items-center gap-2">
            <Upload size={13} /> {uploading === k ? t('adm.site.uploading') : v ? t('adm.site.replace') : t('adm.site.upload')}
            <input type="file" accept="image/*" onChange={upload(k)} className="hidden" />
          </label>
          {v && <Button variant="ghost" size="sm" onPress={() => set(k, '')}>{t('adm.site.remove')}</Button>}
        </div>
      </div>
    );
  };

  const NAV: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: 'maintenance', label: t('adm.site.nMaintenance'), icon: <Wrench size={13} /> },
    { id: 'hero', label: t('adm.site.nHero'), icon: <Rocket size={13} /> },
    { id: 'sections', label: t('adm.site.nSections'), icon: <LayoutList size={13} /> },
    { id: 'copy', label: t('adm.site.nCopy'), icon: <Megaphone size={13} /> },
    { id: 'proof', label: t('adm.site.nProof'), icon: <Star size={13} /> },
    { id: 'contact', label: t('adm.site.nContact'), icon: <Contact size={13} /> },
    { id: 'theme', label: t('adm.site.nTheme'), icon: <Palette size={13} /> },
  ];

  const stats = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        label={t('adm.site.kpiMode')}
        value={<span style={{ fontSize: 20 }}>{on('is_maintenance_mode') ? t('adm.site.locked') : t('adm.site.live')}</span>}
        hint={on('is_maintenance_mode') ? t('adm.site.lockedHint') : t('adm.site.liveHint')}
        icon={on('is_maintenance_mode') ? AlertTriangle : Radio}
        iconStatus={on('is_maintenance_mode') ? 'danger' : 'success'}
      />
      <MetricCard label={t('adm.site.kpiSections')} value={`${sectionsOn}/${SECTION_TOGGLES.length}`} hint={t('adm.site.kpiSectionsHint')} icon={LayoutList} />
      <MetricCard label={t('adm.site.kpiStats')} value={<span style={{ fontSize: 20 }}>{on('stats_use_real_data') ? t('adm.site.realData') : t('adm.site.mockData')}</span>} hint={t('adm.site.kpiStatsHint')} icon={BarChart3} iconStatus={on('stats_use_real_data') ? 'success' : 'warning'} />
      <MetricCard label={t('adm.site.kpiUnsaved')} value={dirty} hint={dirty ? t('adm.site.kpiUnsavedHint') : t('adm.site.allSaved')} icon={Save} iconStatus={dirty ? 'warning' : undefined} />
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('adm.site.title')}
      titleAccent={t('adm.site.titleAccent')}
      description={t('adm.site.desc')}
      icon={<Settings2 size={18} />}
      actions={
        <Button variant="primary" size="md" isPending={saving} isDisabled={!dirty} onPress={() => save()}>
          <Save size={14} /> {t('adm.site.save')}
        </Button>
      }
      stats={stats}
    >
      <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5 items-start">
        {/* Jump nav */}
        <nav className="hidden lg:block sticky top-20 v-talent-card p-2" aria-label={t('adm.site.jump')}>
          {NAV.map((n) => (
            <a key={n.id} href={`#site-${n.id}`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 v-body v-ink hover:bg-[color:var(--color-cool-gray)]" style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--color-campaign-purple)' }}>{n.icon}</span> {n.label}
            </a>
          ))}
        </nav>

        <div className="space-y-5 min-w-0">
          {/* Maintenance */}
          <div id="site-maintenance">
            <Panel icon={<Wrench size={15} />} title={t('adm.site.maintenance')} desc={t('adm.site.maintenanceDesc')} tone={on('is_maintenance_mode') ? 'danger' : 'default'}>
              <div className="space-y-3">
                <Toggle label={t('adm.site.maintenanceOn')} desc={t('adm.site.maintenanceOnDesc')} value={on('is_maintenance_mode')} onChange={(v) => toggle('is_maintenance_mode', v)} tone={on('is_maintenance_mode') ? 'danger' : undefined} />
                <Area k="maintenance_message" label={t('adm.site.maintenanceMsg')} ph={t('adm.site.maintenanceMsgPh')} />
              </div>
            </Panel>
          </div>

          {/* Hero */}
          <div id="site-hero">
            <Panel icon={<Rocket size={15} />} title={t('adm.site.hero')} desc={t('adm.site.heroDesc')}>
              <div className="space-y-3">
                <Text k="hero_title" label={t('adm.site.heroTitle')} ph="Launch campaigns. Find creators. Grow." />
                <Area k="about_text" label={t('adm.site.heroSub')} ph="The easiest way for brands to connect with talented creators." />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Text k="hero_btn_primary" label={t('adm.site.btnPrimary')} ph="Get started free" />
                  <Text k="hero_btn_secondary" label={t('adm.site.btnSecondary')} ph="Log in" />
                  <Text k="hero_btn_dashboard" label={t('adm.site.btnDashboard')} ph="Go to dashboard" />
                </div>
                <Image k="hero_bg_image" label={t('adm.site.heroImage')} />
              </div>
            </Panel>
          </div>

          {/* Section toggles */}
          <div id="site-sections">
            <Panel icon={<LayoutList size={15} />} title={t('adm.site.sections')} desc={t('adm.site.sectionsDesc')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Toggle label={t('adm.site.secBrands')} desc={t('adm.site.secBrandsDesc')} value={on('for_brands_enabled')} onChange={(v) => toggle('for_brands_enabled', v)} />
                <Toggle label={t('adm.site.secCreators')} desc={t('adm.site.secCreatorsDesc')} value={on('for_creators_enabled')} onChange={(v) => toggle('for_creators_enabled', v)} />
                <Toggle label={t('adm.site.secTesti')} desc={t('adm.site.secTestiDesc')} value={on('testimonials_enabled')} onChange={(v) => toggle('testimonials_enabled', v)} />
                <Toggle label={t('adm.site.secFaq')} desc={t('adm.site.secFaqDesc')} value={on('faq_enabled')} onChange={(v) => toggle('faq_enabled', v)} />
                <Toggle label={t('adm.site.secContact')} desc={t('adm.site.secContactDesc')} value={on('contact_enabled')} onChange={(v) => toggle('contact_enabled', v)} />
                <Toggle label={t('adm.site.secTicker')} desc={t('adm.site.secTickerDesc')} value={on('ticker_enabled')} onChange={(v) => toggle('ticker_enabled', v)} />
              </div>
              <div className="mt-3">
                <Area k="ticker_text" label={t('adm.site.tickerText')} ph="Spotify, Epic Games, Gymshark" rows={2} />
              </div>
            </Panel>
          </div>

          {/* Section copy */}
          <div id="site-copy" className="space-y-5">
            <Panel icon={<Sparkles size={15} />} title={t('adm.site.aiStudio')} desc={t('adm.site.aiStudioDesc')}>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Text k="ai_studio_title" label={t('adm.site.blockTitle')} ph="AI Studio" />
                  <Text k="ai_studio_subtitle" label={t('adm.site.blockSubtitle')} ph="Your personal growth engine" />
                </div>
                <Text k="ai_studio_main_title" label={t('adm.site.headline')} ph="Level up with the AI Studio" />
                <Area k="ai_studio_desc" label={t('adm.site.description')} />
              </div>
            </Panel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Panel icon={<Handshake size={15} />} title={t('adm.site.forBrands')}>
                <div className="space-y-3">
                  <Text k="brands_title" label={t('adm.site.headline')} ph="Everything brands need…" />
                  <Area k="brands_desc" label={t('adm.site.description')} />
                </div>
              </Panel>
              <Panel icon={<Bot size={15} />} title={t('adm.site.howItWorks')}>
                <div className="space-y-3">
                  <Text k="how_it_works_title" label={t('adm.site.headline')} ph="How Campgains Hub works" />
                  <Area k="how_it_works_desc" label={t('adm.site.description')} />
                  <Image k="how_it_works_image" label={t('adm.site.sectionImage')} />
                </div>
              </Panel>
            </div>
            <Panel icon={<Users size={15} />} title={t('adm.site.forCreators')}>
              <div className="space-y-3">
                <Text k="creators_title" label={t('adm.site.headline')} ph="Your talent deserves real opportunities." />
                <Area k="creators_desc" label={t('adm.site.description')} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Text k="creators_btn_primary" label={t('adm.site.btnPrimary')} ph="Join as creator" />
                  <Text k="creators_btn_dashboard" label={t('adm.site.btnDashboard')} ph="Go to dashboard" />
                </div>
              </div>
            </Panel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Panel icon={<Megaphone size={15} />} title={t('adm.site.activeCampaigns')}>
                <div className="space-y-3">
                  <Text k="active_camp_title" label={t('adm.site.headline')} ph="Active campaigns" />
                  <Text k="active_camp_desc" label={t('adm.site.description')} ph="Browse open campaigns and start applying." />
                  <Text k="active_camp_btn" label={t('adm.site.buttonText')} ph="View all campaigns" />
                </div>
              </Panel>
              <Panel icon={<Rocket size={15} />} title={t('adm.site.bottomCta')}>
                <div className="space-y-3">
                  <Text k="cta_title" label={t('adm.site.headline')} ph="Ready to grow your brand?" />
                  <Text k="cta_desc" label={t('adm.site.description')} ph="Join thousands of brands…" />
                </div>
              </Panel>
            </div>
          </div>

          {/* Social proof + stats */}
          <div id="site-proof" className="space-y-5">
            <Panel icon={<BarChart3 size={15} />} title={t('adm.site.platformStats')} desc={t('adm.site.platformStatsDesc')}>
              <div className="space-y-3">
                <Toggle label={t('adm.site.realCount')} desc={t('adm.site.realCountDesc')} value={on('stats_use_real_data')} onChange={(v) => toggle('stats_use_real_data', v)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2 rounded-xl p-3" style={{ background: 'var(--color-cool-gray)' }}>
                      <Text k={`stats_val_${i}`} label={t('adm.site.statValue', { n: i })} ph="2,800+" />
                      <Text k={`stats_lbl_${i}`} label={t('adm.site.statLabel', { n: i })} ph="Active creators" />
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel icon={<Star size={15} />} title={t('adm.site.testimonials')} desc={t('adm.site.testimonialsDesc')}>
              <Toggle label={t('adm.site.mockTesti')} desc={t('adm.site.mockTestiDesc')} value={on('testimonials_mock_enabled')} onChange={(v) => toggle('testimonials_mock_enabled', v)} />
            </Panel>
            <Panel icon={<Bell size={15} />} title={t('adm.site.popups')} desc={t('adm.site.popupsDesc')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Toggle label={t('adm.site.popupsOn')} desc={t('adm.site.popupsOnDesc')} value={on('notifications_enabled')} onChange={(v) => toggle('notifications_enabled', v)} />
                <Toggle label={t('adm.site.popupsMock')} desc={t('adm.site.popupsMockDesc')} value={on('notifications_mock_enabled')} onChange={(v) => toggle('notifications_mock_enabled', v)} />
              </div>
            </Panel>
          </div>

          {/* Contact + newsletter */}
          <div id="site-contact" className="space-y-5">
            <Panel icon={<Contact size={15} />} title={t('adm.site.contact')} desc={t('adm.site.contactDesc')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Text k="contact_badge" label={t('adm.site.badge')} ph="Let's talk" />
                <Text k="contact_title" label={t('adm.site.headline')} ph="Get in touch" />
                <Text k="contact_email" label={t('adm.site.companyEmail')} ph="hello@campgainshub.com" type="email" />
                <Text k="contact_phone" label={t('adm.site.companyPhone')} ph="+251 …" />
                <Text k="contact_loc" label={t('adm.site.companyLocation')} ph="Addis Ababa, Ethiopia" />
              </div>
            </Panel>
            <Panel icon={<Mail size={15} />} title={t('adm.site.newsletter')}>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Text k="newsletter_badge" label={t('adm.site.badge')} ph="Stay in the loop" />
                  <Text k="newsletter_title" label={t('adm.site.headline')} ph="Never miss an update" />
                  <Text k="newsletter_btn" label={t('adm.site.buttonText')} ph="Subscribe" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2 rounded-xl p-3" style={{ background: 'var(--color-cool-gray)' }}>
                      <Text k={`newsletter_stats_${i}`} label={t('adm.site.statValue', { n: i })} />
                      <Text k={`newsletter_lbl_${i}`} label={t('adm.site.statLabel', { n: i })} />
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          {/* Theme */}
          <div id="site-theme">
            <Panel
              icon={<Palette size={15} />}
              title={t('adm.site.theme')}
              desc={t('adm.site.themeDesc')}
              action={<Chip color="accent" variant="soft" size="sm"><Chip.Label>{THEMES.find((x) => x.id === settings.platform_theme)?.label || 'Default'}</Chip.Label></Chip>}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {THEMES.map((th) => {
                  const active = settings.platform_theme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => { set('platform_theme', th.id); applyBrandTheme(th.id); }}
                      className="v-option-tile flex items-center gap-3 p-3 text-left"
                      data-active={active || undefined}
                      aria-pressed={active}
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${th.lightHex}, ${th.hex})` }}>
                        {active && <Check size={16} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="v-ink font-medium" style={{ fontSize: 13 }}>{th.label}</span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          {/* Sticky save bar */}
          <div className="sticky bottom-3 z-10">
            <div className="v-talent-card px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ backdropFilter: 'blur(8px)' }}>
              <div className="v-caption v-quiet inline-flex items-center gap-2" style={{ fontSize: 12.5 }}>
                <ToggleLeft size={13} />
                {dirty ? t('adm.site.unsavedN', { n: dirty }) : t('adm.site.allSaved')}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="md" isDisabled={!dirty || saving} onPress={() => setSettings(saved)}>{t('adm.site.discard')}</Button>
                <Button type="submit" variant="primary" size="md" isPending={saving} isDisabled={!dirty}>
                  <Save size={14} /> {t('adm.site.save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </PageShell>
  );
};

export default SiteSettings;
