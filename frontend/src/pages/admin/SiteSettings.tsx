import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  Palette,
  Save,
  Settings2,
  ToggleLeft,
  Type,
  Upload,
} from 'lucide-react';
import {
  Button,
  Card,
  Chip,
  Label,
  Separator,
  Switch,
  TextArea,
  TextField,
} from '@heroui/react';
import { Input } from 'react-aria-components';
import api, { serverOrigin } from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';
import { PageShell } from '../../components/ui';

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

type SettingsMap = Record<string, string>;

/* ── Reusable helpers ─────────────────────────────────────────────── */
const SettingSection: React.FC<{
  title: string;
  description?: string;
  icon: React.ReactNode;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}> = ({ title, description, icon, tone = 'default', children }) => (
  <Card className={tone === 'danger' ? 'border-danger/40' : ''}>
    <Card.Header>
      <Card.Title
        className={`inline-flex items-center gap-2 text-base ${
          tone === 'danger' ? 'text-danger' : ''
        }`}
      >
        {icon} {title}
      </Card.Title>
      {description && <Card.Description>{description}</Card.Description>}
    </Card.Header>
    <Separator />
    <Card.Content className="p-5 space-y-4">{children}</Card.Content>
  </Card>
);

const SettingText: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}> = ({ label, value, onChange, placeholder, type }) => (
  <TextField value={value} onChange={onChange} aria-label={label}>
    <Label className="text-muted text-[10px] font-medium uppercase tracking-wider block mb-1.5">
      {label}
    </Label>
    <Input className={fieldClass} placeholder={placeholder} type={type} />
  </TextField>
);

const SettingTextArea: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ label, value, onChange, placeholder, rows = 3 }) => (
  <div>
    <Label className="text-muted text-[10px] font-medium uppercase tracking-wider block mb-1.5">
      {label}
    </Label>
    <TextArea
      value={value}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
        onChange(e.target.value)
      }
      rows={rows}
      placeholder={placeholder}
      className={`${fieldClass} resize-none`}
    />
  </div>
);

const SettingToggle: React.FC<{
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  tone?: 'default' | 'danger';
}> = ({ label, description, value, onChange, tone }) => (
  <div
    className={`flex items-center justify-between gap-4 p-3 rounded-lg border ${
      tone === 'danger'
        ? 'bg-danger-soft border-danger/40'
        : 'bg-surface-secondary border-border'
    }`}
  >
    <div className="min-w-0">
      <div className="text-foreground text-sm font-semibold">{label}</div>
      <div className="text-muted text-xs mt-0.5">{description}</div>
    </div>
    <Switch isSelected={value} onChange={onChange}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  </div>
);

const SettingImageUpload: React.FC<{
  label: string;
  value: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  previewClass?: string;
}> = ({ label, value, onUpload, previewClass = 'h-24' }) => (
  <div>
    <Label className="text-muted text-[10px] font-medium uppercase tracking-wider block mb-1.5">
      {label}
    </Label>
    <div className="flex items-center gap-3 flex-wrap">
      {value && (
        <div
          className={`${previewClass} w-32 rounded-lg overflow-hidden border border-border`}
        >
          <img
            src={value.startsWith('http') ? value : `${serverOrigin}${value}`}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-foreground text-sm font-medium cursor-pointer hover:border-accent/40">
        <Upload size={13} />
        {value ? 'Replace' : 'Upload'}
        <input
          type="file"
          accept="image/*"
          onChange={onUpload}
          className="hidden"
        />
      </label>
    </div>
  </div>
);

const THEMES = [
  { id: 'theme-brand', label: 'CampaignHub Brand', hex: '#5b5cf6', lightHex: '#36d7dc' },
  { id: 'theme-yellow', label: 'Golden Yellow', hex: '#ca8a04', lightHex: '#facc15' },
  { id: 'theme-blue', label: 'Ocean Blue', hex: '#2563eb', lightHex: '#60a5fa' },
  { id: 'theme-green', label: 'Growth Green', hex: '#16a34a', lightHex: '#4ade80' },
  { id: 'theme-purple', label: 'Royal Purple', hex: '#9333ea', lightHex: '#c084fc' },
  { id: 'theme-indigo', label: 'Indigo Aura', hex: '#6366f1', lightHex: '#818cf8' },
];

const SiteSettings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsMap>({
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
  });

  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');

  useEffect(() => {
    api
      .get('/public/settings')
      .then((res) => {
        setSettings((prev) => ({
          ...prev,
          ...res.data,
          ticker_text: res.data.ticker_text || 'Spotify, Epic Games, Gymshark',
        }));
      })
      .catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await api.patch('/admin/settings', settings);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    settingKey: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Data = reader.result as string;
        const response = await api.post('/uploads', {
          file: base64Data,
          filename: file.name,
        });
        if (response.data.url) {
          setSettings((prev) => ({
            ...prev,
            [settingKey]: response.data.url,
          }));
        }
      } catch (error) {
        console.error('File upload failed', error);
      }
    };
    reader.readAsDataURL(file);
  };

  const { applyBrandTheme } = useTheme();

  const set = (key: string, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }));
  const toggle = (key: string, v: boolean) =>
    set(key, v ? 'true' : 'false');

  const setPlatformTheme = (themeId: string) => {
    set('platform_theme', themeId);
    applyBrandTheme(themeId);
  };

  const activeThemeLabel =
    THEMES.find((t) => t.id === settings.platform_theme)?.label || 'Default';

  return (
    <PageShell
      title="Site control"
      description="Configure landing page sections, notifications, and data sources."
      icon={<Settings2 size={18} />}
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Maintenance */}
        <SettingSection
          title="Emergency & maintenance"
          description="Lock the platform for non-admin users."
          icon={<AlertCircle size={15} className="text-danger" />}
          tone="danger"
        >
          <SettingToggle
            label="Enable maintenance mode"
            description="Instantly locks the platform for all non-admin users."
            value={settings.is_maintenance_mode === 'true'}
            onChange={(v) => toggle('is_maintenance_mode', v)}
            tone="danger"
          />
          <SettingTextArea
            label="Maintenance message (public)"
            value={settings.maintenance_message || ''}
            onChange={(v) => set('maintenance_message', v)}
            placeholder="We are currently upgrading the platform…"
          />
        </SettingSection>

        {/* Hero */}
        <SettingSection
          title="Hero section"
          icon={<ToggleLeft size={15} className="text-accent" />}
        >
          <SettingText
            label="Hero title"
            value={settings.hero_title || ''}
            onChange={(v) => set('hero_title', v)}
            placeholder="e.g. Launch campaigns. Find creators. Grow."
          />
          <SettingTextArea
            label="Hero description"
            value={settings.about_text || ''}
            onChange={(v) => set('about_text', v)}
            placeholder="e.g. The easiest way for brands to connect with talented creators."
            rows={2}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SettingText
              label="Primary button"
              value={settings.hero_btn_primary || ''}
              onChange={(v) => set('hero_btn_primary', v)}
              placeholder="Get started free"
            />
            <SettingText
              label="Secondary button"
              value={settings.hero_btn_secondary || ''}
              onChange={(v) => set('hero_btn_secondary', v)}
              placeholder="Log in"
            />
            <SettingText
              label="Dashboard button"
              value={settings.hero_btn_dashboard || ''}
              onChange={(v) => set('hero_btn_dashboard', v)}
              placeholder="Go to dashboard"
            />
          </div>
          <SettingImageUpload
            label="Hero background image"
            value={settings.hero_bg_image || ''}
            onUpload={(e) => handleFileUpload(e, 'hero_bg_image')}
          />
        </SettingSection>

        {/* AI Studio */}
        <SettingSection
          title="AI Studio highlight"
          icon={<ToggleLeft size={15} className="text-accent" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingText
              label="Block title"
              value={settings.ai_studio_title || ''}
              onChange={(v) => set('ai_studio_title', v)}
              placeholder="AI Studio"
            />
            <SettingText
              label="Block subtitle"
              value={settings.ai_studio_subtitle || ''}
              onChange={(v) => set('ai_studio_subtitle', v)}
              placeholder="Your personal growth engine"
            />
          </div>
          <SettingText
            label="Main headline"
            value={settings.ai_studio_main_title || ''}
            onChange={(v) => set('ai_studio_main_title', v)}
            placeholder="Level up with the AI Studio"
          />
          <SettingTextArea
            label="Description"
            value={settings.ai_studio_desc || ''}
            onChange={(v) => set('ai_studio_desc', v)}
            placeholder="We've integrated a powerful…"
            rows={2}
          />
        </SettingSection>

        {/* For Brands + How it Works */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingSection
            title="For brands"
            icon={<ToggleLeft size={15} className="text-accent" />}
          >
            <SettingText
              label="Title"
              value={settings.brands_title || ''}
              onChange={(v) => set('brands_title', v)}
              placeholder="Everything brands need…"
            />
            <SettingTextArea
              label="Description"
              value={settings.brands_desc || ''}
              onChange={(v) => set('brands_desc', v)}
              placeholder="From finding the perfect…"
              rows={2}
            />
          </SettingSection>
          <SettingSection
            title="How it works"
            icon={<ToggleLeft size={15} className="text-accent" />}
          >
            <SettingText
              label="Title"
              value={settings.how_it_works_title || ''}
              onChange={(v) => set('how_it_works_title', v)}
              placeholder="How CampaignHub works"
            />
            <SettingTextArea
              label="Description"
              value={settings.how_it_works_desc || ''}
              onChange={(v) => set('how_it_works_desc', v)}
              placeholder="Four simple steps…"
              rows={2}
            />
            <SettingImageUpload
              label="Section image"
              value={settings.how_it_works_image || ''}
              onUpload={(e) => handleFileUpload(e, 'how_it_works_image')}
            />
          </SettingSection>
        </div>

        {/* For Creators */}
        <SettingSection
          title="For creators"
          icon={<ToggleLeft size={15} className="text-accent" />}
        >
          <SettingText
            label="Headline"
            value={settings.creators_title || ''}
            onChange={(v) => set('creators_title', v)}
            placeholder="Your talent deserves real opportunities."
          />
          <SettingTextArea
            label="Description"
            value={settings.creators_desc || ''}
            onChange={(v) => set('creators_desc', v)}
            placeholder="Stop guessing. CampaignHub connects you…"
            rows={2}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingText
              label="Primary button"
              value={settings.creators_btn_primary || ''}
              onChange={(v) => set('creators_btn_primary', v)}
              placeholder="Join as creator"
            />
            <SettingText
              label="Dashboard button"
              value={settings.creators_btn_dashboard || ''}
              onChange={(v) => set('creators_btn_dashboard', v)}
              placeholder="Go to dashboard"
            />
          </div>
        </SettingSection>

        {/* Active campaigns */}
        <SettingSection
          title="Active campaigns section"
          icon={<ToggleLeft size={15} className="text-accent" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingText
              label="Headline"
              value={settings.active_camp_title || ''}
              onChange={(v) => set('active_camp_title', v)}
              placeholder="Active campaigns"
            />
            <SettingText
              label="Button text"
              value={settings.active_camp_btn || ''}
              onChange={(v) => set('active_camp_btn', v)}
              placeholder="View all campaigns"
            />
          </div>
          <SettingText
            label="Description"
            value={settings.active_camp_desc || ''}
            onChange={(v) => set('active_camp_desc', v)}
            placeholder="Browse open campaigns and start applying."
          />
        </SettingSection>

        {/* Bottom CTA */}
        <SettingSection
          title="Bottom CTA"
          icon={<ToggleLeft size={15} className="text-accent" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingText
              label="CTA headline"
              value={settings.cta_title || ''}
              onChange={(v) => set('cta_title', v)}
              placeholder="Ready to grow your brand?"
            />
            <SettingText
              label="CTA subtext"
              value={settings.cta_desc || ''}
              onChange={(v) => set('cta_desc', v)}
              placeholder="Join thousands of brands…"
            />
          </div>
        </SettingSection>

        {/* Platform stats */}
        <SettingSection
          title="Trusted platform statistics"
          icon={<ToggleLeft size={15} className="text-accent" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <SettingText
                  label={`Stat ${i} value`}
                  value={settings[`stats_val_${i}`] || ''}
                  onChange={(v) => set(`stats_val_${i}`, v)}
                  placeholder="2,800+"
                />
                <SettingText
                  label={`Stat ${i} label`}
                  value={settings[`stats_lbl_${i}`] || ''}
                  onChange={(v) => set(`stats_lbl_${i}`, v)}
                  placeholder="Active creators"
                />
              </div>
            ))}
          </div>
        </SettingSection>

        {/* Contact info */}
        <SettingSection
          title="Contact section"
          icon={<ToggleLeft size={15} className="text-accent" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingText
              label="Section badge"
              value={settings.contact_badge || ''}
              onChange={(v) => set('contact_badge', v)}
              placeholder="Let's talk"
            />
            <SettingText
              label="Headline"
              value={settings.contact_title || ''}
              onChange={(v) => set('contact_title', v)}
              placeholder="Get in touch"
            />
            <SettingText
              label="Company email"
              value={settings.contact_email || ''}
              onChange={(v) => set('contact_email', v)}
              placeholder="info@campaignhub.com"
            />
            <SettingText
              label="Company phone"
              value={settings.contact_phone || ''}
              onChange={(v) => set('contact_phone', v)}
              placeholder="+1 (555) 123-4567"
            />
            <SettingText
              label="Company location"
              value={settings.contact_loc || ''}
              onChange={(v) => set('contact_loc', v)}
              placeholder="San Francisco, CA"
            />
          </div>
        </SettingSection>

        {/* Newsletter */}
        <SettingSection
          title="Newsletter section"
          icon={<ToggleLeft size={15} className="text-accent" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingText
              label="Section badge"
              value={settings.newsletter_badge || ''}
              onChange={(v) => set('newsletter_badge', v)}
              placeholder="Stay in the loop"
            />
            <SettingText
              label="Headline"
              value={settings.newsletter_title || ''}
              onChange={(v) => set('newsletter_title', v)}
              placeholder="Never miss an update"
            />
            <SettingText
              label="Button text"
              value={settings.newsletter_btn || ''}
              onChange={(v) => set('newsletter_btn', v)}
              placeholder="Subscribe"
            />
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((idx) => (
              <div key={`news_${idx}`} className="space-y-2">
                <SettingText
                  label={`Stat ${idx} value`}
                  value={settings[`newsletter_stats_${idx}`] || ''}
                  onChange={(v) => set(`newsletter_stats_${idx}`, v)}
                />
                <SettingText
                  label={`Stat ${idx} label`}
                  value={settings[`newsletter_lbl_${idx}`] || ''}
                  onChange={(v) => set(`newsletter_lbl_${idx}`, v)}
                />
              </div>
            ))}
          </div>
        </SettingSection>

        {/* Landing page sections toggles */}
        <SettingSection
          title="Landing page sections"
          description="Toggle entire sections on/off on the public landing page."
          icon={<ToggleLeft size={15} className="text-accent" />}
        >
          <SettingToggle
            label="For brands section"
            description="Show the 'For brands' feature cards section"
            value={settings.for_brands_enabled === 'true'}
            onChange={(v) => toggle('for_brands_enabled', v)}
          />
          <SettingToggle
            label="For creators section"
            description="Show the 'For creators' feature cards section"
            value={settings.for_creators_enabled === 'true'}
            onChange={(v) => toggle('for_creators_enabled', v)}
          />
          <SettingToggle
            label="Testimonials section"
            description="Show the testimonials / social proof section"
            value={settings.testimonials_enabled === 'true'}
            onChange={(v) => toggle('testimonials_enabled', v)}
          />
          <SettingToggle
            label="Use mock testimonials"
            description="When disabled, testimonials will use real data (when available)"
            value={settings.testimonials_mock_enabled === 'true'}
            onChange={(v) => toggle('testimonials_mock_enabled', v)}
          />
          <SettingToggle
            label="FAQ section"
            description="Show the frequently asked questions accordion"
            value={settings.faq_enabled === 'true'}
            onChange={(v) => toggle('faq_enabled', v)}
          />
          <SettingToggle
            label="Contact section"
            description="Show the contact us section with email and social links"
            value={settings.contact_enabled === 'true'}
            onChange={(v) => toggle('contact_enabled', v)}
          />
        </SettingSection>

        {/* Trusted by */}
        <SettingSection
          title="Trusted by section"
          icon={<Type size={15} className="text-accent" />}
        >
          <SettingToggle
            label="Enable trusted by section"
            description="Show the 'Trusted by industry leaders' banner on the landing page"
            value={settings.ticker_enabled === 'true'}
            onChange={(v) => toggle('ticker_enabled', v)}
          />
          <SettingTextArea
            label="Company names (comma separated)"
            value={settings.ticker_text || ''}
            onChange={(v) => set('ticker_text', v)}
            placeholder="Spotify, Epic Games, Gymshark"
          />
        </SettingSection>

        {/* Notifications */}
        <SettingSection
          title="Live notifications popups"
          icon={<Bell size={15} className="text-accent" />}
        >
          <SettingToggle
            label="Enable home page notifications"
            description="Show live activity popups on the bottom right"
            value={settings.notifications_enabled === 'true'}
            onChange={(v) => toggle('notifications_enabled', v)}
          />
          <SettingToggle
            label="Use mock notifications"
            description="If disabled, popups will pull real recent platform activity"
            value={settings.notifications_mock_enabled === 'true'}
            onChange={(v) => toggle('notifications_mock_enabled', v)}
          />
        </SettingSection>

        {/* Stats real/mock */}
        <SettingSection
          title="Landing page stats"
          icon={<ToggleLeft size={15} className="text-accent" />}
        >
          <SettingToggle
            label="Use real creator count"
            description='Show actual registered creators instead of the mock "2,847" figure'
            value={settings.stats_use_real_data === 'true'}
            onChange={(v) => toggle('stats_use_real_data', v)}
          />
        </SettingSection>

        {/* Platform theme */}
        <SettingSection
          title="Platform brand identity"
          icon={<Palette size={15} className="text-accent" />}
        >
          <div className="flex items-center gap-2">
            <span className="text-muted text-xs font-medium uppercase tracking-wider">
              Active:
            </span>
            <Chip color="accent" variant="soft" size="sm">
              <Chip.Label>{activeThemeLabel}</Chip.Label>
            </Chip>
          </div>
          <p className="text-muted text-sm">
            Select the primary color theme for the entire platform. Changes
            apply instantly.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {THEMES.map((t) => {
              const active = settings.platform_theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPlatformTheme(t.id)}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-border bg-surface hover:border-accent/40'
                  }`}
                >
                  <div
                    className="w-12 h-12 rounded-full shadow-overlay flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${t.lightHex}, ${t.hex})`,
                    }}
                  >
                    {active && (
                      <Check size={20} className="text-white" strokeWidth={3} />
                    )}
                  </div>
                  <span className="text-foreground text-sm font-medium">
                    {t.label}
                  </span>
                  {active && (
                    <Chip color="accent" variant="soft" size="sm">
                      <Chip.Label>Active</Chip.Label>
                    </Chip>
                  )}
                </button>
              );
            })}
          </div>
        </SettingSection>

        {/* Sticky save bar */}
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-background/95 backdrop-blur-sm border-t border-border z-10 flex items-center justify-between gap-3 flex-wrap">
          <div>
            {status === 'success' && (
              <Chip color="success" variant="soft" size="md">
                <Check size={13} />
                <Chip.Label>Settings saved</Chip.Label>
              </Chip>
            )}
            {status === 'error' && (
              <Chip color="danger" variant="soft" size="md">
                <AlertCircle size={13} />
                <Chip.Label>Save failed</Chip.Label>
              </Chip>
            )}
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isPending={status === 'loading'}
          >
            <Save size={15} /> Save settings
          </Button>
        </div>
      </form>
    </PageShell>
  );
};

export default SiteSettings;
