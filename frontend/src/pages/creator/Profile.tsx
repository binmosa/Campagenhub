import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle,
  Edit3,
  Link2,
  MapPin,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Separator,
} from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import api from '../../lib/api';
import {
  SOCIAL_PLATFORMS,
  parseSocialLinks,
  serializeSocialLinks,
  socialEntries,
  type SocialMap,
} from '../../lib/socialLinks';
import PlatformIcon from '../landing/mocks/PlatformIcon';
import { PLATFORM_ICON_KEY } from '../talent/shared';
import LocationCascade from '../../components/common/LocationCascade';
import AccountSettings from '../../components/AccountSettings';
import PayoutSettings from '../../components/PayoutSettings';
import { KycCard } from '../../components/common/KycCard';
import { PageShell } from '../../components/ui';

/**
 * Creator Profile — three-tab workspace.
 *
 *   Profile  — identity, niche, bio, social links (view + edit)
 *   Payout   — existing PayoutSettings component (preserved verbatim)
 *   Security — existing AccountSettings component (preserved verbatim)
 *
 * Profile completion meter at the top nudges creators to fill missing
 * fields, which directly increases match quality with brands.
 */

type ProfileShape = {
  first_name: string;
  last_name: string;
  full_name: string;
  username: string;
  category: string;
  location: string;
  country: string;
  country_code: string;
  state: string;
  state_code: string;
  city: string;
  follower_range: string;
  social_links: string;
  bio: string;
  avatar_url: string;
};

const EMPTY_PROFILE: ProfileShape = {
  first_name: '',
  last_name: '',
  full_name: '',
  username: '',
  category: '',
  location: '',
  country: '',
  country_code: '',
  state: '',
  state_code: '',
  city: '',
  follower_range: '',
  social_links: '',
  bio: '',
  avatar_url: '',
};

const FOLLOWER_RANGES = [
  '0-1K',
  '1K-10K',
  '10K-50K',
  '50K-100K',
  '100K-500K',
  '500K+',
];

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm';
const fieldStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  outline: 'none',
};

const CreatorProfilePage: React.FC = () => {
  const [tab, setTab] = useState<'profile' | 'payout' | 'security'>('profile');
  const [profile, setProfile] = useState<ProfileShape>(EMPTY_PROFILE);
  const [links, setLinks] = useState<SocialMap>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'loading'
  );
  const [editMode, setEditMode] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);

  const fetchAuthUser = () => {
    api.get('/auth/me').then((r) => setAuthUser(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchAuthUser();
    api
      .get('/creators/profile')
      .then((res) => {
        if (res.data) {
          setProfile({
            first_name: res.data.first_name || '',
            last_name: res.data.last_name || '',
            full_name: res.data.full_name || '',
            username: res.data.username || '',
            category: res.data.category || '',
            location: res.data.location || '',
            country: res.data.country || '',
            country_code: res.data.country_code || '',
            state: res.data.state || '',
            state_code: res.data.state_code || '',
            city: res.data.city || '',
            follower_range: res.data.follower_range || '',
            social_links: res.data.social_links || '',
            bio: res.data.bio || '',
            avatar_url: res.data.avatar_url || '',
          });
          setLinks(parseSocialLinks(res.data.social_links));
        }
        setStatus('idle');
      })
      .catch(() => setStatus('idle'));
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be smaller than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile({ ...profile, avatar_url: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const social_links = serializeSocialLinks(links);
      const full_name =
        `${profile.first_name} ${profile.last_name}`.trim() || profile.full_name;
      const location =
        profile.city && profile.country
          ? `${profile.city}, ${profile.country}`
          : profile.location;
      await api.post('/creators/profile', { ...profile, full_name, location, social_links });
      setProfile((p) => ({ ...p, full_name, location, social_links }));
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

  /* ── Profile completeness (drives the meter + per-field hints) ─ */
  const completion = useMemo(() => {
    const fields: Array<keyof ProfileShape> = [
      'avatar_url',
      'first_name',
      'username',
      'category',
      'location',
      'follower_range',
      'social_links',
      'bio',
    ];
    const filled = fields.filter((f) => !!profile[f]?.toString().trim()).length;
    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  const initials =
    (profile.full_name || profile.username || 'U')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'U';

  return (
    <PageShell
      title="My Profile"
      description="Showcase yourself to brands and configure payout + security settings."
      icon={<User size={18} />}
    >
      {/* ─── Identity verification (admin-gated) ─────────────────── */}
      <KycCard user={authUser} onSubmitted={fetchAuthUser} />

      {/* ─── Header card ─────────────────────────────────────────── */}
      <Card>
        <Card.Content className="p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar size="lg" className="!h-16 !w-16">
              {profile.avatar_url && (
                <Avatar.Image src={profile.avatar_url} alt={profile.full_name} />
              )}
              <Avatar.Fallback>{initials}</Avatar.Fallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Chip color="accent" variant="soft" size="sm">
                  <Sparkles size={11} /> Creator
                </Chip>
                {profile.category && (
                  <Chip variant="secondary" size="sm">
                    <Target size={11} /> {profile.category}
                  </Chip>
                )}
              </div>
              <h1 className="text-foreground text-2xl font-semibold tracking-tight truncate">
                {profile.full_name || 'Anonymous creator'}
              </h1>
              <div className="mt-1 flex items-center gap-3 text-muted text-sm">
                {profile.username && <span>@{profile.username.replace(/^@/, '')}</span>}
                {profile.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} /> {profile.location}
                  </span>
                )}
                {profile.follower_range && (
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} /> {profile.follower_range}
                  </span>
                )}
              </div>
            </div>
          </div>
          {tab === 'profile' && !editMode && (
            <Button
              variant="primary"
              size="md"
              className="!rounded-xl"
              onPress={() => setEditMode(true)}
            >
              <Edit3 size={14} /> Edit profile
            </Button>
          )}
        </Card.Content>

        {/* Completion meter */}
        <Separator />
        <div className="relative px-6 sm:px-7 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-foreground text-sm font-semibold">
                Profile completeness
              </span>
              <span className="text-muted text-xs tabular-nums">{completion}%</span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--surface-secondary)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${completion}%`,
                  background:
                    completion === 100
                      ? 'var(--success)'
                      : 'linear-gradient(90deg, var(--accent) 0%, var(--accent-2, var(--accent)) 100%)',
                }}
              />
            </div>
            <p className="text-muted text-xs mt-1.5">
              {completion === 100
                ? 'Looking good — brands will find you easily.'
                : 'Filled profiles get 3× more campaign invitations.'}
            </p>
          </div>
        </div>
      </Card>

      {/* ─── Tab switcher ────────────────────────────────────────── */}
      <Segment
        selectedKey={tab}
        onSelectionChange={(k) => setTab(k as typeof tab)}
        size="md"
      >
        <Segment.Item id="profile">
          <User className="size-3.5" /> Profile
        </Segment.Item>
        <Segment.Separator />
        <Segment.Item id="payout">
          <Wallet className="size-3.5" /> Payout
        </Segment.Item>
        <Segment.Separator />
        <Segment.Item id="security">
          <ShieldCheck className="size-3.5" /> Security
        </Segment.Item>
      </Segment>

      {/* ─── Profile tab ─────────────────────────────────────────── */}
      {tab === 'profile' && (
        <>
          {!editMode ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left col: Bio */}
              <Card className="lg:col-span-2">
                <Card.Header>
                  <Card.Title className="text-base">About</Card.Title>
                  <Card.Description>
                    What brands see first on your profile.
                  </Card.Description>
                </Card.Header>
                <Separator />
                <Card.Content className="p-6">
                  {profile.bio ? (
                    <p className="text-foreground text-sm leading-relaxed">
                      {profile.bio}
                    </p>
                  ) : (
                    <p className="text-muted text-sm italic">
                      No bio yet. Write a few lines about your niche, audience,
                      and what makes you a great collaboration partner.
                    </p>
                  )}
                </Card.Content>
              </Card>

              {/* Right col: stats */}
              <Card>
                <Card.Header>
                  <Card.Title className="text-base">At a glance</Card.Title>
                </Card.Header>
                <Separator />
                <Card.Content className="p-0">
                  <ul className="divide-y divide-border">
                    {[
                      {
                        icon: Users,
                        label: 'Followers',
                        value: profile.follower_range || 'Not specified',
                      },
                      {
                        icon: Target,
                        label: 'Niche',
                        value: profile.category || 'Not specified',
                      },
                      {
                        icon: MapPin,
                        label: 'Location',
                        value: profile.location || 'Not specified',
                      },
                    ].map((row) => {
                      const Icon = row.icon;
                      return (
                        <li
                          key={row.label}
                          className="flex items-center gap-3 px-5 py-3.5"
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0 bg-accent-soft text-accent">
                            <Icon size={13} />
                          </span>
                          <div className="min-w-0">
                            <div className="text-muted text-xs uppercase tracking-wider font-medium">
                              {row.label}
                            </div>
                            <div className="text-foreground text-sm font-medium truncate">
                              {row.value}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                    {/* Social profiles — brand glyphs linking out */}
                    <li className="flex items-center gap-3 px-5 py-3.5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0 bg-accent-soft text-accent">
                        <Link2 size={13} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-muted text-xs uppercase tracking-wider font-medium mb-1">
                          Platforms
                        </div>
                        {socialEntries(profile.social_links).length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {socialEntries(profile.social_links).map((l) => (
                              <a
                                key={l.id}
                                href={l.url || undefined}
                                target="_blank"
                                rel="noreferrer"
                                title={l.label}
                                aria-label={l.label}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-transform hover:-translate-y-0.5"
                                style={{ background: `${l.color}14`, color: l.color }}
                              >
                                <PlatformIcon platform={PLATFORM_ICON_KEY[l.id]} size={14} />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted text-sm">
                            No platforms linked yet
                          </div>
                        )}
                      </div>
                    </li>
                  </ul>
                </Card.Content>
              </Card>
            </div>
          ) : (
            <Card>
              <Card.Header className="flex-row items-center justify-between">
                <Card.Title className="text-base">Edit profile</Card.Title>
                <Button
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  className="!rounded-full"
                  aria-label="Cancel"
                  onPress={() => setEditMode(false)}
                >
                  <X size={16} />
                </Button>
              </Card.Header>
              <Separator />
              <Card.Content className="p-6">
                <form onSubmit={handleSave} className="space-y-6">
                  {/* Avatar */}
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div
                      className="relative w-24 h-24 rounded-2xl flex items-center justify-center bg-surface overflow-hidden group cursor-pointer shrink-0"
                      style={{
                        border: '2px dashed var(--border)',
                      }}
                    >
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera size={24} className="text-muted" />
                      )}
                      <div
                        className="absolute inset-0 bg-foreground/55 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      >
                        <Upload size={18} className="text-white mb-1" />
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-white">
                          Upload
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-foreground text-sm font-semibold">
                        Profile photo
                      </div>
                      <div className="text-muted text-xs mt-0.5">
                        JPG / PNG · max 2MB · click the tile to upload.
                      </div>
                    </div>
                  </div>

                  {/* Name + username */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                        Name
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={profile.first_name}
                          onChange={(e) =>
                            setProfile({ ...profile, first_name: e.target.value })
                          }
                          placeholder="First"
                          autoComplete="given-name"
                          className={fieldClass}
                          style={fieldStyle}
                        />
                        <input
                          type="text"
                          value={profile.last_name}
                          onChange={(e) =>
                            setProfile({ ...profile, last_name: e.target.value })
                          }
                          placeholder="Last"
                          autoComplete="family-name"
                          className={fieldClass}
                          style={fieldStyle}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                        Username
                      </label>
                      <input
                        type="text"
                        value={profile.username}
                        onChange={(e) =>
                          setProfile({ ...profile, username: e.target.value })
                        }
                        placeholder="@your_username"
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </div>
                  </div>

                  {/* Niche + location */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                        Category / niche
                      </label>
                      <input
                        type="text"
                        value={profile.category}
                        onChange={(e) =>
                          setProfile({ ...profile, category: e.target.value })
                        }
                        placeholder="Fashion · Tech · Fitness · Food"
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </div>
                    <div>
                      <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                        Location
                      </label>
                      {/* Dropdown-only (ISO dataset) — keeps locations filterable */}
                      <LocationCascade
                        layout="stack"
                        value={{
                          country: profile.country,
                          countryCode: profile.country_code,
                          state: profile.state,
                          stateCode: profile.state_code,
                          city: profile.city,
                        }}
                        onChange={(v) =>
                          setProfile({
                            ...profile,
                            country: v.country,
                            country_code: v.countryCode,
                            state: v.state,
                            state_code: v.stateCode,
                            city: v.city,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Follower range + social links */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                        Follower range
                      </label>
                      <select
                        value={profile.follower_range}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            follower_range: e.target.value,
                          })
                        }
                        className={fieldClass}
                        style={fieldStyle}
                      >
                        <option value="">Select range</option>
                        {FOLLOWER_RANGES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Social profiles — one URL per platform */}
                  <div>
                    <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Social profiles
                    </label>
                    <p className="text-muted text-xs mb-3">
                      Add every platform you publish on, with your follower
                      count — brands filter and decide by these numbers.
                    </p>
                    <div className="space-y-2.5">
                      {SOCIAL_PLATFORMS.map((p) => (
                        <div key={p.id} className="flex gap-2">
                          <div className="relative flex-1 min-w-0">
                            <span
                              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex"
                              style={{ color: p.color }}
                            >
                              <PlatformIcon platform={PLATFORM_ICON_KEY[p.id]} size={14} />
                            </span>
                            <input
                              type="text"
                              value={links[p.id]?.url || ''}
                              onChange={(e) =>
                                setLinks((prev) => ({
                                  ...prev,
                                  [p.id]: { ...prev[p.id], url: e.target.value },
                                }))
                              }
                              placeholder={p.placeholder}
                              aria-label={`${p.label} profile URL`}
                              className={`${fieldClass} pl-9`}
                              style={fieldStyle}
                            />
                          </div>
                          <input
                            type="number"
                            min={0}
                            value={links[p.id]?.followers ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLinks((prev) => ({
                                ...prev,
                                [p.id]: {
                                  url: prev[p.id]?.url || '',
                                  followers: v === '' ? undefined : Math.max(0, Math.round(Number(v))),
                                },
                              }));
                            }}
                            placeholder="Followers"
                            aria-label={`${p.label} follower count`}
                            className={`${fieldClass} !w-32 shrink-0`}
                            style={fieldStyle}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Short bio
                    </label>
                    <textarea
                      value={profile.bio}
                      onChange={(e) =>
                        setProfile({ ...profile, bio: e.target.value })
                      }
                      placeholder="Tell brands why they should work with you…"
                      className={`${fieldClass} h-32 resize-none`}
                      style={fieldStyle}
                    />
                  </div>

                  {/* Actions */}
                  <Separator />
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-h-[36px] flex items-center">
                      {status === 'success' && (
                        <Chip color="success" variant="soft" size="sm">
                          <CheckCircle size={11} /> Profile saved
                        </Chip>
                      )}
                      {status === 'error' && (
                        <Chip color="danger" variant="soft" size="sm">
                          <AlertCircle size={11} /> Save failed
                        </Chip>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" onPress={() => setEditMode(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        isPending={status === 'loading'}
                      >
                        <Save size={13} /> Save profile
                      </Button>
                    </div>
                  </div>
                </form>
              </Card.Content>
            </Card>
          )}
        </>
      )}

      {/* ─── Payout tab ──────────────────────────────────────────── */}
      {tab === 'payout' && <PayoutSettings />}

      {/* ─── Security tab ────────────────────────────────────────── */}
      {tab === 'security' && <AccountSettings />}
    </PageShell>
  );
};

export default CreatorProfilePage;
