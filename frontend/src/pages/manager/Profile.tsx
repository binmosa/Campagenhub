import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  Edit3,
  MapPin,
  Star,
  Target,
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
  NumberField,
  Separator,
  TextArea,
  TextField,
} from '@heroui/react';
import { Input } from 'react-aria-components';
import api from '../../lib/api';
import AccountSettings from '../../components/AccountSettings';
import PayoutSettings from '../../components/PayoutSettings';
import { KycCard } from '../../components/common/KycCard';
import { PageShell } from '../../components/ui';

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

const Profile: React.FC = () => {
  const [profile, setProfile] = useState({
    full_name: '',
    bio: '',
    avatar_url: '',
    location: '',
    specialty: '',
    experience_years: 0,
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
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be smaller than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () =>
      setProfile((prev) => ({
        ...prev,
        avatar_url: reader.result as string,
      }));
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetchAuthUser();
    api
      .get('/managers/profile')
      .then((res) => {
        if (res.data) {
          setProfile({
            full_name: res.data.full_name || '',
            bio: res.data.bio || '',
            avatar_url: res.data.avatar_url || '',
            location: res.data.location || '',
            specialty: res.data.specialty || '',
            experience_years: Number(res.data.experience_years || 0),
          });
        }
        setStatus('idle');
      })
      .catch(() => setStatus('idle'));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await api.post('/managers/profile', profile);
      setStatus('success');
      window.dispatchEvent(new Event('profileUpdated'));
      setTimeout(() => {
        setStatus('idle');
        setEditMode(false);
      }, 1200);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  const initial =
    (profile.full_name || 'M')[0]?.toUpperCase() || 'M';

  return (
    <PageShell
      title="Manager profile"
      description="Update your public manager profile."
      icon={<User size={18} />}
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
            <Avatar className="size-24 shrink-0">
              {profile.avatar_url && (
                <Avatar.Image
                  src={profile.avatar_url}
                  alt={profile.full_name}
                />
              )}
              <Avatar.Fallback>{initial}</Avatar.Fallback>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  {profile.full_name || 'Anonymous Manager'}
                </h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {profile.specialty && (
                    <Chip color="accent" variant="soft" size="sm">
                      <Target size={11} />
                      <Chip.Label>{profile.specialty}</Chip.Label>
                    </Chip>
                  )}
                  {profile.location && (
                    <Chip color="default" variant="soft" size="sm">
                      <MapPin size={11} />
                      <Chip.Label>{profile.location}</Chip.Label>
                    </Chip>
                  )}
                  <Chip color="success" variant="soft" size="sm">
                    <Star size={11} />
                    <Chip.Label>
                      {profile.experience_years || 0} yrs experience
                    </Chip.Label>
                  </Chip>
                </div>
              </div>

              <p className="text-foreground text-sm leading-relaxed bg-surface-secondary p-4 rounded-xl border border-border">
                {profile.bio || (
                  <span className="italic text-muted">
                    Add a short bio so brands know your strengths.
                  </span>
                )}
              </p>
            </div>
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title className="text-base">Edit manager profile</Card.Title>
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
              {/* Avatar upload */}
              <div className="flex items-center gap-5">
                <label className="size-24 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-surface-secondary overflow-hidden relative group hover:border-accent cursor-pointer">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera size={24} className="text-muted" />
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
                    Profile photo
                  </Label>
                  <p className="text-muted text-xs mt-1">
                    JPG or PNG, up to 2MB.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  value={profile.full_name}
                  onChange={(v) =>
                    setProfile((prev) => ({ ...prev, full_name: v }))
                  }
                  aria-label="Full name"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                    <User size={11} /> Full name
                  </Label>
                  <Input className={fieldClass} placeholder="Your full name" />
                </TextField>
                <TextField
                  value={profile.location}
                  onChange={(v) =>
                    setProfile((prev) => ({ ...prev, location: v }))
                  }
                  aria-label="Location"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                    <MapPin size={11} /> Location
                  </Label>
                  <Input
                    className={fieldClass}
                    placeholder="e.g. Addis Ababa, Ethiopia"
                  />
                </TextField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  value={profile.specialty}
                  onChange={(v) =>
                    setProfile((prev) => ({ ...prev, specialty: v }))
                  }
                  aria-label="Specialty"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                    <Target size={11} /> Specialty
                  </Label>
                  <Input
                    className={fieldClass}
                    placeholder="e.g. E-commerce, SaaS, FMCG"
                  />
                </TextField>
                <NumberField
                  value={profile.experience_years}
                  onChange={(v) =>
                    setProfile((prev) => ({
                      ...prev,
                      experience_years: Number.isNaN(v) ? 0 : v,
                    }))
                  }
                  minValue={0}
                  step={1}
                  aria-label="Experience (years)"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                    <Star size={11} /> Experience (years)
                  </Label>
                  <NumberField.Group>
                    <NumberField.Input placeholder="0" />
                    <NumberField.DecrementButton />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
              </div>

              <div>
                <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Short bio
                </Label>
                <TextArea
                  value={profile.bio}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setProfile((prev) => ({ ...prev, bio: e.target.value }))
                  }
                  placeholder="Tell brands about your management style and results."
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

      {/* Payout settings */}
      <PayoutSettings />

      {/* Account settings */}
      <AccountSettings />
    </PageShell>
  );
};

export default Profile;
