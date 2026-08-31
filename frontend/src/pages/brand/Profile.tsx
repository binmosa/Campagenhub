import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Building,
  Check,
  Edit3,
  FileText,
  Globe,
  Mail,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  Separator,
  TextField,
  TextArea,
} from '@heroui/react';
import { Input } from 'react-aria-components';
import api from '../../lib/api';
import AccountSettings from '../../components/AccountSettings';
import TeamManager from '../../components/TeamManager';
import { KycCard } from '../../components/common/KycCard';
import { PageShell } from '../../components/ui';

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

const BrandProfile: React.FC = () => {
  const [profile, setProfile] = useState({
    company_name: '',
    industry: '',
    contact_person: '',
    contact_email: '',
    description: '',
    logo_url: '',
  });

  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('loading');
  const [editMode, setEditMode] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);
  const fetchAuthUser = () =>
    api.get('/auth/me').then((r) => setAuthUser(r.data)).catch(() => {});

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Image must be smaller than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile({ ...profile, logo_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    fetchAuthUser();
    api
      .get('/brands/profile')
      .then((res) => {
        if (res.data)
          setProfile({
            company_name: res.data.company_name || '',
            industry: res.data.industry || '',
            contact_person: res.data.contact_person || '',
            contact_email: res.data.contact_email || '',
            description: res.data.description || '',
            logo_url: res.data.logo_url || '',
          });
        setStatus('idle');
      })
      .catch(() => setStatus('idle'));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await api.post('/brands/profile', profile);
      setStatus('success');
      window.dispatchEvent(new Event('profileUpdated'));
      setTimeout(() => {
        setStatus('idle');
        setEditMode(false);
      }, 1500);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <PageShell
      title="Company profile"
      description="Manage your brand presence and company details."
      icon={<Building size={18} />}
      containerSize="narrow"
      actions={
        !editMode ? (
          <Button variant="primary" size="md" onPress={() => setEditMode(true)}>
            <Edit3 size={14} /> Edit profile
          </Button>
        ) : null
      }
    >
      <KycCard user={authUser} onSubmitted={fetchAuthUser} />

      {!editMode ? (
        <Card>
          <Card.Content className="p-6 flex flex-col md:flex-row gap-6 items-start">
            <Avatar className="size-24 shrink-0 rounded-2xl">
              {profile.logo_url ? (
                <Avatar.Image
                  src={profile.logo_url}
                  alt={profile.company_name}
                />
              ) : null}
              <Avatar.Fallback>
                <Building size={32} className="text-muted" />
              </Avatar.Fallback>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  {profile.company_name || 'Anonymous Brand'}
                </h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {profile.industry && (
                    <Chip color="accent" variant="soft" size="sm">
                      <Briefcase size={11} />
                      <Chip.Label>{profile.industry}</Chip.Label>
                    </Chip>
                  )}
                  {profile.contact_email && (
                    <Chip color="default" variant="soft" size="sm">
                      <Mail size={11} />
                      <Chip.Label>{profile.contact_email}</Chip.Label>
                    </Chip>
                  )}
                </div>
              </div>

              <p className="text-foreground text-sm leading-relaxed bg-surface-secondary p-4 rounded-xl border border-border">
                {profile.description || (
                  <span className="italic text-muted">
                    No company description provided.
                  </span>
                )}
              </p>

              <Separator />

              <div>
                <div className="text-muted text-xs font-medium uppercase tracking-wider mb-1 inline-flex items-center gap-1.5">
                  <User size={11} /> Primary contact
                </div>
                <div className="text-foreground text-sm font-semibold">
                  {profile.contact_person || 'Not specified'}
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title className="text-base">Edit details</Card.Title>
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label="Close edit"
              onPress={() => setEditMode(false)}
            >
              <X size={16} />
            </Button>
          </Card.Header>
          <Separator />
          <Card.Content className="p-6">
            <form onSubmit={handleSave} className="space-y-6">
              {/* Logo upload */}
              <div className="flex items-center gap-5">
                <label className="size-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center bg-surface-secondary overflow-hidden relative group hover:border-accent cursor-pointer">
                  {profile.logo_url ? (
                    <img
                      src={profile.logo_url}
                      alt="Brand logo"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <Globe size={24} className="text-muted" />
                  )}
                  <div className="absolute inset-0 bg-overlay/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload size={20} className="text-overlay-foreground mb-1" />
                    <span className="text-[10px] uppercase font-semibold text-overlay-foreground">
                      Upload
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
                <div className="flex-1">
                  <Label className="text-foreground text-sm font-semibold">
                    Brand logo
                  </Label>
                  <p className="text-muted text-xs mt-1">
                    JPG or PNG, up to 2MB.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  value={profile.company_name}
                  onChange={(v) => setProfile({ ...profile, company_name: v })}
                  aria-label="Company name"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                    <Building size={11} /> Company name
                  </Label>
                  <Input
                    className={fieldClass}
                    placeholder="e.g. Nike, Spotify"
                  />
                </TextField>
                <TextField
                  value={profile.industry}
                  onChange={(v) => setProfile({ ...profile, industry: v })}
                  aria-label="Industry"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                    <Briefcase size={11} /> Industry
                  </Label>
                  <Input
                    className={fieldClass}
                    placeholder="e.g. Tech, Fashion"
                  />
                </TextField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  value={profile.contact_person}
                  onChange={(v) =>
                    setProfile({ ...profile, contact_person: v })
                  }
                  aria-label="Contact person"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                    <User size={11} /> Contact person
                  </Label>
                  <Input className={fieldClass} placeholder="Manager name" />
                </TextField>
                <TextField
                  value={profile.contact_email}
                  onChange={(v) => setProfile({ ...profile, contact_email: v })}
                  type="email"
                  aria-label="Contact email"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                    <Mail size={11} /> Contact email
                  </Label>
                  <Input className={fieldClass} placeholder="hello@brand.com" />
                </TextField>
              </div>

              <div>
                <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                  <FileText size={11} /> Company description
                </Label>
                <TextArea
                  value={profile.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setProfile({ ...profile, description: e.target.value })
                  }
                  placeholder="Tell creators about your brand…"
                  rows={5}
                  className={`${fieldClass} resize-none`}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  {status === 'success' && (
                    <Chip color="success" variant="soft" size="md">
                      <Check size={13} />
                      <Chip.Label>Profile saved</Chip.Label>
                    </Chip>
                  )}
                  {status === 'error' && (
                    <Chip color="danger" variant="soft" size="md">
                      <AlertCircle size={13} />
                      <Chip.Label>Save failed</Chip.Label>
                    </Chip>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onPress={() => setEditMode(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isPending={status === 'loading'}
                  >
                    Save profile
                  </Button>
                </div>
              </div>
            </form>
          </Card.Content>
        </Card>
      )}

      {/* Account Security Settings */}
      <AccountSettings />

      {/* Brand Team Management */}
      <TeamManager />
    </PageShell>
  );
};

export default BrandProfile;
