import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AtSign,
  Award,
  Camera,
  CheckCircle,
  DollarSign,
  FileText,
  Filter,
  Gamepad2,
  Image as ImageIcon,
  Lock,
  MapPin,
  Music2,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  Modal,
  SearchField,
  Separator,
  Switch,
  TextArea,
  TextField,
} from '@heroui/react';
import {
  EmptyState,
  RadioButtonGroup,
  Segment,
  Sheet,
} from '@heroui-pro/react';
import { Input } from 'react-aria-components';
import api from '../lib/api';
import LandingNav from './landing/sections/LandingNav';
import Footer from './landing/sections/Footer';

const CURRENCIES = ['NGN', 'USD', 'KES', 'GHS', 'ZAR', 'UGX', 'EUR', 'GBP'];

const NICHES = [
  'Fashion',
  'Tech',
  'Food',
  'Fitness',
  'Beauty',
  'Travel',
  'Gaming',
  'Lifestyle',
  'Music',
  'Education',
  'Business',
  'Finance',
  'Sports',
  'Comedy',
  'E-commerce',
  'SaaS',
  'Healthcare',
];

const FOLLOWER_RANGES = [
  { id: 'any', label: 'Any', min: 0, max: 0 },
  { id: 'nano', label: 'Nano · 1K–10K', min: 1000, max: 10000 },
  { id: 'micro', label: 'Micro · 10K–100K', min: 10000, max: 100000 },
  { id: 'mid', label: 'Mid · 100K–1M', min: 100000, max: 1_000_000 },
  { id: 'macro', label: 'Macro · 1M+', min: 1_000_000, max: 0 },
];

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', Icon: ImageIcon, color: '#d6409f' },
  { id: 'tiktok', label: 'TikTok', Icon: Music2, color: '#ff5a5f' },
  { id: 'youtube', label: 'YouTube', Icon: Video, color: '#ef3a40' },
  { id: 'twitter', label: 'X / Twitter', Icon: AtSign, color: '#0b1736' },
  { id: 'twitch', label: 'Twitch', Icon: Gamepad2, color: '#7b61ff' },
];

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

const formatFollowers = (n: number): string => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
};

const parseFollowerCount = (range: string | null): number => {
  if (!range) return 0;
  return parseInt(range.replace(/[^0-9]/g, '')) || 0;
};

const getEngagementRate = (followers: number): string => {
  if (!followers) return 'N/A';
  if (followers >= 1_000_000) return '1.0–2.5%';
  if (followers >= 500_000) return '2.0–3.5%';
  if (followers >= 100_000) return '3.5–5.0%';
  if (followers >= 10_000) return '5.0–8.0%';
  return '8.0–15.0%';
};

const detectPlatforms = (talent: Talent): string[] => {
  const raw = (talent.social_links || '').toLowerCase();
  const bio = (talent.bio || '').toLowerCase();
  const haystack = `${raw} ${bio}`;
  return PLATFORMS.filter(({ id, label }) => {
    if (haystack.includes(id)) return true;
    if (haystack.includes(label.toLowerCase().split(' ')[0])) return true;
    if (id === 'twitter' && /\btwitter\b|\bx\.com\b/.test(haystack)) return true;
    return false;
  }).map((p) => p.id);
};

type Talent = {
  id: string;
  _type: 'creator' | 'manager';
  full_name?: string;
  username?: string;
  avatar_url?: string;
  category?: string;
  specialty?: string;
  location?: string;
  bio?: string;
  social_links?: string;
  follower_count?: number;
  follower_range?: string;
  rating?: number;
  experience_years?: number;
  user?: { id?: string };
  user_id?: string;
};

/* ── Invitation Modal ─────────────────────────────────────────────── */
const InvitationModal: React.FC<{
  talent: Talent;
  isOpen: boolean;
  type: 'creator_collab' | 'manager_assign';
  onClose: () => void;
}> = ({ talent, isOpen, type, onClose }) => {
  const role = localStorage.getItem('role') || '';
  const [message, setMessage] = useState(
    `Hi ${talent.full_name || 'there'}, I'd love to collaborate with you on an upcoming campaign. Let's work together!`
  );
  const [videoLink, setVideoLink] = useState('');
  const [contractContent, setContractContent] = useState('');
  const [contractMode, setContractMode] = useState<'ai' | 'manual'>('manual');
  const [generating, setGenerating] = useState(false);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [day, setDay] = useState(1);
  const [currency, setCurrency] = useState('NGN');
  const [perms, setPerms] = useState({
    can_add_campaigns: false,
    can_view_analytics: false,
    can_manage_applications: false,
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const generateContract = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/contracts/generate', {
        type,
        talent_name: talent.full_name,
        amount,
        frequency,
        currency,
      });
      setContractContent(res.data?.content || res.data?.contract || '');
    } catch {
      setContractContent(
        `COLLABORATION AGREEMENT\n\nThis agreement is between the Brand and ${
          talent.full_name || 'the Talent'
        } for professional content collaboration services.\n\nPayment: ${currency} ${amount} per ${frequency}, paid on day ${day} of each ${
          frequency === 'monthly' ? 'month' : 'year'
        }.\n\nBoth parties agree to maintain professionalism, deliver agreed deliverables on time, and treat all shared information as confidential.\n\nThis agreement is enforceable from the date of acceptance on CampaignHub.`
      );
    }
    setGenerating(false);
  };

  const send = async () => {
    setSending(true);
    try {
      await api.post('/invitations', {
        receiver_id: talent.user?.id || talent.user_id || talent.id,
        type,
        message,
        contract_content: contractContent,
        payment_amount: amount ? Number(amount) : undefined,
        payment_frequency: frequency,
        payment_day: day,
        currency,
        permissions: type === 'creator_collab' ? perms : undefined,
        video_link: videoLink,
        ...(role === 'manager' ? { payment_approved: false } : {}),
      });
      setSent(true);
      setTimeout(onClose, 1500);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const togglePerm = (key: keyof typeof perms, v: boolean) =>
    setPerms((p) => ({ ...p, [key]: v }));

  const initial = (talent.full_name || 'T')[0].toUpperCase();

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="!max-w-xl">
            <Modal.Header>
              <div className="flex items-center gap-3">
                <Avatar size="md">
                  {talent.avatar_url && (
                    <Avatar.Image
                      src={talent.avatar_url}
                      alt={talent.full_name}
                    />
                  )}
                  <Avatar.Fallback>{initial}</Avatar.Fallback>
                </Avatar>
                <div>
                  <Modal.Heading>
                    {talent.full_name || talent.username || 'Talent'}
                  </Modal.Heading>
                  <p className="text-muted text-xs mt-0.5">
                    {type === 'creator_collab'
                      ? 'Creator collaboration'
                      : 'Manager invitation'}
                  </p>
                </div>
              </div>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-5">
                <div>
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Personal message
                  </Label>
                  <TextArea
                    value={message}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setMessage(e.target.value)
                    }
                    rows={3}
                    className={`${fieldClass} resize-none`}
                  />
                </div>

                <TextField
                  value={videoLink}
                  onChange={setVideoLink}
                  aria-label="Video pitch link"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Video pitch link (optional)
                  </Label>
                  <Input
                    className={fieldClass}
                    type="url"
                    placeholder="e.g. https://loom.com/share/…"
                  />
                </TextField>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider inline-flex items-center gap-1.5">
                      <FileText size={11} /> Contract
                    </Label>
                    <Segment
                      selectedKey={contractMode}
                      onSelectionChange={(k) =>
                        setContractMode(k as typeof contractMode)
                      }
                      size="sm"
                    >
                      <Segment.Item id="ai">AI generate</Segment.Item>
                      <Segment.Item id="manual">Write</Segment.Item>
                    </Segment>
                  </div>
                  {contractMode === 'ai' && (
                    <Button
                      variant="outline"
                      size="md"
                      fullWidth
                      className="!mb-3"
                      isPending={generating}
                      onPress={generateContract}
                    >
                      <Sparkles size={13} /> Generate contract with AI
                    </Button>
                  )}
                  <TextArea
                    value={contractContent}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setContractContent(e.target.value)
                    }
                    rows={5}
                    placeholder="Enter or generate contract terms…"
                    className={`${fieldClass} font-mono text-xs resize-none`}
                  />
                </div>

                <div>
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-2 inline-flex items-center gap-1.5">
                    <DollarSign size={11} /> Payment terms
                  </Label>
                  {role === 'manager' && (
                    <Card className="bg-warning-soft border-warning/40 mb-3">
                      <Card.Content className="p-3 text-xs text-warning-soft-foreground font-medium">
                        Payment terms you set require brand approval before the
                        recipient can accept.
                      </Card.Content>
                    </Card>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      value={amount}
                      onChange={setAmount}
                      aria-label="Amount"
                    >
                      <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                        Amount
                      </Label>
                      <Input
                        className={fieldClass}
                        type="number"
                        placeholder="0"
                      />
                    </TextField>
                    <div>
                      <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                        Currency
                      </Label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className={fieldClass}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                        Frequency
                      </Label>
                      <select
                        value={frequency}
                        onChange={(e) =>
                          setFrequency(e.target.value as 'monthly' | 'yearly')
                        }
                        className={fieldClass}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                        Payment day (1–28)
                      </Label>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={day}
                        onChange={(e) => setDay(Number(e.target.value))}
                        className={fieldClass}
                      />
                    </div>
                  </div>
                </div>

                {type === 'creator_collab' && (
                  <div>
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-2">
                      Permissions to grant
                    </Label>
                    <div className="flex flex-col gap-2">
                      {(
                        [
                          ['can_add_campaigns', 'Can add campaigns'],
                          ['can_view_analytics', 'Can view analytics'],
                          ['can_manage_applications', 'Can manage applications'],
                        ] as const
                      ).map(([key, label]) => (
                        <Switch
                          key={key}
                          isSelected={perms[key]}
                          onChange={(v) => togglePerm(key, v)}
                        >
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                          <Switch.Content>
                            <Label className="text-sm">{label}</Label>
                          </Switch.Content>
                        </Switch>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              {sent ? (
                <Chip color="success" variant="soft" size="md">
                  <CheckCircle size={13} />
                  <Chip.Label>Invitation & contract sent</Chip.Label>
                </Chip>
              ) : (
                <>
                  <Button variant="ghost" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    isPending={sending}
                    onPress={send}
                  >
                    <Send size={13} /> Send invitation & contract
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Filter section wrapper ──────────────────────────────────────── */
const FilterSection: React.FC<{
  title: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}> = ({ title, children, hint }) => (
  <div className="pb-4 mb-4 border-b border-border last:border-0 last:mb-0 last:pb-0">
    <div className="flex items-center justify-between mb-2.5">
      <Label className="text-foreground text-xs font-semibold">
        {title}
      </Label>
      {hint && (
        <span className="text-muted text-[10px] font-medium">{hint}</span>
      )}
    </div>
    {children}
  </div>
);

/* ── Filter panel (shared between desktop sidebar and mobile sheet) ── */
type FilterState = {
  profession: 'all' | 'creator' | 'manager';
  search: string;
  country: string;
  city: string;
  niche: string;
  followerRangeId: string;
  platforms: Set<string>;
  verifiedOnly: boolean;
};

const FilterPanel: React.FC<{
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onReset: () => void;
}> = ({ filters, setFilters, onReset }) => {
  const togglePlatform = (id: string) => {
    setFilters((prev) => {
      const next = new Set(prev.platforms);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, platforms: next };
    });
  };

  return (
    <div>
      {/* Search */}
      <FilterSection title="Search">
        <SearchField
          aria-label="Search talent"
          value={filters.search}
          onChange={(v) => setFilters({ ...filters, search: v })}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Name or @handle…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </FilterSection>

      {/* Location */}
      <FilterSection title="Location">
        <div className="space-y-2">
          <div className="relative">
            <MapPin
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              value={filters.country}
              onChange={(e) =>
                setFilters({ ...filters, country: e.target.value })
              }
              placeholder="Country"
              className={`${fieldClass} pl-9`}
            />
          </div>
          <div className="relative">
            <MapPin
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              value={filters.city}
              onChange={(e) =>
                setFilters({ ...filters, city: e.target.value })
              }
              placeholder="City"
              className={`${fieldClass} pl-9`}
            />
          </div>
        </div>
      </FilterSection>

      {/* Platforms — single column toggle rows with brand icon + Switch on the right */}
      <FilterSection
        title="Platforms"
        hint={
          filters.platforms.size > 0
            ? `${filters.platforms.size} selected`
            : null
        }
      >
        <div className="space-y-1">
          {PLATFORMS.map((p) => {
            const active = filters.platforms.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent-soft border-accent/40 text-foreground'
                    : 'bg-surface border-border text-foreground hover:border-accent/40'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md"
                    style={{
                      background: active ? `${p.color}22` : 'transparent',
                    }}
                  >
                    <p.Icon size={13} style={{ color: p.color }} />
                  </span>
                  {p.label}
                </span>
                <span
                  className={`size-4 rounded-full border-2 transition-colors ${
                    active
                      ? 'border-accent bg-accent'
                      : 'border-border bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Niche / category — chips wrapping naturally */}
      <FilterSection
        title="Category"
        hint={filters.niche || null}
      >
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilters({ ...filters, niche: '' })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filters.niche === ''
                ? 'bg-accent border-accent text-accent-foreground'
                : 'bg-surface border-border text-foreground hover:border-accent/40'
            }`}
          >
            Any
          </button>
          {NICHES.map((n) => {
            const active = filters.niche === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() =>
                  setFilters({ ...filters, niche: active ? '' : n })
                }
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-accent border-accent text-accent-foreground'
                    : 'bg-surface border-border text-foreground hover:border-accent/40'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Followers — vertical radio stack */}
      <FilterSection title="Followers">
        <div className="space-y-1">
          {FOLLOWER_RANGES.map((r) => {
            const active = filters.followerRangeId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() =>
                  setFilters({ ...filters, followerRangeId: r.id })
                }
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent-soft border-accent/40 text-foreground'
                    : 'bg-surface border-border text-foreground hover:border-accent/40'
                }`}
              >
                {r.label}
                <span
                  className={`size-4 rounded-full border-2 transition-colors ${
                    active
                      ? 'border-accent bg-accent'
                      : 'border-border bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Verified only */}
      <FilterSection title="Quality">
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-surface">
          <Label className="text-foreground text-sm">
            Verified profiles only
          </Label>
          <Switch
            isSelected={filters.verifiedOnly}
            onChange={(v) => setFilters({ ...filters, verifiedOnly: v })}
            aria-label="Verified profiles only"
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>
      </FilterSection>

      <Button variant="ghost" size="sm" fullWidth onPress={onReset}>
        Reset all filters
      </Button>
    </div>
  );
};

/* ── Talent card ──────────────────────────────────────────────────── */
const TalentCard: React.FC<{
  talent: Talent;
  canInvite: boolean;
  loggedIn: boolean;
  onInvite: () => void;
}> = ({ talent, canInvite, loggedIn, onInvite }) => {
  const isCreator = talent._type === 'creator';
  const name =
    talent.full_name ||
    talent.username ||
    (isCreator ? 'Creator' : 'Manager');
  const initial = name[0]?.toUpperCase() || 'T';
  const followers = talent.follower_count || 0;
  const eng = getEngagementRate(followers);
  const talentPlatforms = useMemo(() => detectPlatforms(talent), [talent]);

  return (
    <Card className="flex flex-col h-full transition-shadow hover:shadow-overlay">
      <Card.Content className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex items-center justify-between">
          <Chip
            color={isCreator ? 'accent' : 'default'}
            variant="soft"
            size="sm"
          >
            {isCreator ? <Camera size={10} /> : <Award size={10} />}
            <Chip.Label className="capitalize">{talent._type}</Chip.Label>
          </Chip>
          <ShieldCheck size={14} className="text-accent" />
        </div>

        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {talent.avatar_url && (
              <Avatar.Image src={talent.avatar_url} alt={name} />
            )}
            <Avatar.Fallback>{initial}</Avatar.Fallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="text-foreground text-sm font-semibold truncate">
              {name}
            </h3>
            <div className="flex items-center gap-2 text-muted text-[10px] flex-wrap">
              {talent.username && <span>@{talent.username}</span>}
              {!isCreator && (
                <span className="inline-flex items-center gap-0.5">
                  <Star
                    size={9}
                    className="fill-warning text-warning"
                  />
                  {Number(talent.rating || 5).toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(talent.category || talent.specialty) && (
            <Chip color="accent" variant="soft" size="sm">
              <Chip.Label>{talent.category || talent.specialty}</Chip.Label>
            </Chip>
          )}
          {talent.location && (
            <Chip color="default" variant="soft" size="sm">
              <MapPin size={9} />
              <Chip.Label>{talent.location}</Chip.Label>
            </Chip>
          )}
        </div>

        {/* Platform icons */}
        {talentPlatforms.length > 0 && (
          <div className="flex items-center gap-1.5">
            {talentPlatforms.map((id) => {
              const p = PLATFORMS.find((x) => x.id === id);
              if (!p) return null;
              return (
                <span
                  key={id}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-surface-secondary"
                  title={p.label}
                >
                  <p.Icon size={11} style={{ color: p.color }} />
                </span>
              );
            })}
          </div>
        )}

        <p className="text-muted text-xs leading-relaxed line-clamp-2 flex-1">
          {talent.bio ||
            (isCreator
              ? 'Verified content creator ready to collaborate on premium brand campaigns.'
              : 'Verified campaign manager ready to drive measurable ROI for enterprise brands.')}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {isCreator ? (
            <>
              <div className="bg-surface-secondary rounded-lg p-2 text-center">
                <div className="text-foreground text-sm font-semibold inline-flex items-center justify-center gap-1 tabular-nums">
                  <Users size={11} className="text-accent" />
                  {formatFollowers(followers)}
                </div>
                <div className="text-muted text-[10px] font-medium uppercase">
                  Followers
                </div>
              </div>
              <div className="bg-surface-secondary rounded-lg p-2 text-center">
                <div className="text-foreground text-sm font-semibold inline-flex items-center justify-center gap-1 tabular-nums">
                  <TrendingUp size={11} className="text-success" />
                  {eng.split('–')[0]}
                </div>
                <div className="text-muted text-[10px] font-medium uppercase">
                  Eng. rate
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-surface-secondary rounded-lg p-2 text-center">
                <div className="text-foreground text-sm font-semibold inline-flex items-center justify-center gap-1">
                  <Star
                    size={11}
                    className="fill-warning text-warning"
                  />
                  {Number(talent.rating || 5).toFixed(1)}
                </div>
                <div className="text-muted text-[10px] font-medium uppercase">
                  Rating
                </div>
              </div>
              <div className="bg-surface-secondary rounded-lg p-2 text-center">
                <div className="text-foreground text-sm font-semibold tabular-nums">
                  {talent.experience_years
                    ? `${talent.experience_years}yr`
                    : '5yr+'}
                </div>
                <div className="text-muted text-[10px] font-medium uppercase">
                  Experience
                </div>
              </div>
            </>
          )}
        </div>

        {/* CTA */}
        {!loggedIn ? (
          <Link to="/login" className="w-full">
            <Button variant="outline" size="sm" fullWidth>
              <Lock size={12} /> Login to{' '}
              {isCreator ? 'collaborate' : 'hire'}
            </Button>
          </Link>
        ) : !canInvite ? (
          <Chip
            color="default"
            variant="soft"
            size="md"
            className="self-center"
          >
            <CheckCircle size={11} />
            <Chip.Label>Viewing as creator</Chip.Label>
          </Chip>
        ) : (
          <Button variant="primary" size="sm" fullWidth onPress={onInvite}>
            <Send size={12} /> Invite & send contract
          </Button>
        )}
      </Card.Content>
    </Card>
  );
};

/* ── Main page ────────────────────────────────────────────────────── */
const INITIAL_FILTERS: FilterState = {
  profession: 'all',
  search: '',
  country: '',
  city: '',
  niche: '',
  followerRangeId: 'any',
  platforms: new Set<string>(),
  verifiedOnly: false,
};

const TalentNetwork: React.FC = () => {
  const loggedIn = !!localStorage.getItem('token');
  const userRole = localStorage.getItem('role') || '';
  const canInvite =
    loggedIn && (userRole === 'brand' || userRole === 'manager');

  const [creators, setCreators] = useState<Talent[]>([]);
  const [managers, setManagers] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);

  const [invModal, setInvModal] = useState<{
    talent: Talent;
    type: 'creator_collab' | 'manager_assign';
  } | null>(null);

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [sort, setSort] = useState<'followers' | 'name' | 'newest'>('followers');
  const [sheetOpen, setSheetOpen] = useState(false);

  // Reset all
  const resetAll = () => setFilters(INITIAL_FILTERS);

  // Backend fetch — server filters by search, category, location string, follower min/max
  const fetchAll = useCallback(() => {
    setLoading(true);
    const range = FOLLOWER_RANGES.find((r) => r.id === filters.followerRangeId);
    const creatorParams: any = {
      sort: sort === 'name' ? 'name' : 'followers_desc',
    };
    if (filters.search) creatorParams.search = filters.search;
    if (filters.niche) creatorParams.category = filters.niche;
    const loc = [filters.city, filters.country].filter(Boolean).join(' ');
    if (loc) creatorParams.location = loc;
    if (range?.min) creatorParams.minFollowers = String(range.min);
    if (range?.max) creatorParams.maxFollowers = String(range.max);

    const managerParams: any = {
      sort: sort === 'name' ? 'name' : 'rating_desc',
    };
    if (filters.search) managerParams.search = filters.search;

    Promise.all([
      api.get('/creators/public-list', { params: creatorParams }),
      api.get('/managers/public', { params: managerParams }),
    ])
      .then(([crRes, mgRes]) => {
        setCreators(
          (crRes.data || []).map((c: any) => ({
            ...c,
            _type: 'creator' as const,
            follower_count: parseFollowerCount(c.follower_range),
          }))
        );
        setManagers(
          (mgRes.data || []).map((m: any) => ({
            ...m,
            _type: 'manager' as const,
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filters, sort]);

  useEffect(() => {
    const t = setTimeout(fetchAll, 280);
    return () => clearTimeout(t);
  }, [fetchAll]);

  // Client-side post-filter: platforms (parsed from social_links/bio), city/country
  // also re-checked client-side to cover manager rows the backend doesn't filter.
  const filtered = useMemo(() => {
    const list: Talent[] = [
      ...(filters.profession !== 'manager' ? creators : []),
      ...(filters.profession !== 'creator' ? managers : []),
    ];

    return list.filter((t) => {
      // City / country match against location string
      const locLower = (t.location || '').toLowerCase();
      if (
        filters.country.trim() &&
        !locLower.includes(filters.country.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        filters.city.trim() &&
        !locLower.includes(filters.city.trim().toLowerCase())
      ) {
        return false;
      }
      // Niche for managers (backend filter is creator-only)
      if (filters.niche && t._type === 'manager') {
        if (
          !(t.specialty || '')
            .toLowerCase()
            .includes(filters.niche.toLowerCase())
        )
          return false;
      }
      // Platforms — parse from social_links/bio
      if (filters.platforms.size > 0) {
        const tp = new Set(detectPlatforms(t));
        let any = false;
        filters.platforms.forEach((p) => {
          if (tp.has(p)) any = true;
        });
        if (!any) return false;
      }
      return true;
    });
  }, [creators, managers, filters]);

  const counts = useMemo(
    () => ({
      all: creators.length + managers.length,
      creators: creators.length,
      managers: managers.length,
    }),
    [creators, managers]
  );

  // Active-filter chips for the toolbar above the grid
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (filters.search)
      chips.push({
        key: 'search',
        label: `Search: ${filters.search}`,
        onClear: () => setFilters({ ...filters, search: '' }),
      });
    if (filters.country)
      chips.push({
        key: 'country',
        label: filters.country,
        onClear: () => setFilters({ ...filters, country: '' }),
      });
    if (filters.city)
      chips.push({
        key: 'city',
        label: filters.city,
        onClear: () => setFilters({ ...filters, city: '' }),
      });
    if (filters.niche)
      chips.push({
        key: 'niche',
        label: filters.niche,
        onClear: () => setFilters({ ...filters, niche: '' }),
      });
    if (filters.followerRangeId !== 'any')
      chips.push({
        key: 'followers',
        label: FOLLOWER_RANGES.find((r) => r.id === filters.followerRangeId)
          ?.label || 'Followers',
        onClear: () => setFilters({ ...filters, followerRangeId: 'any' }),
      });
    filters.platforms.forEach((id) => {
      const p = PLATFORMS.find((x) => x.id === id);
      if (p)
        chips.push({
          key: `platform-${id}`,
          label: p.label,
          onClear: () => {
            const next = new Set(filters.platforms);
            next.delete(id);
            setFilters({ ...filters, platforms: next });
          },
        });
    });
    if (filters.verifiedOnly)
      chips.push({
        key: 'verified',
        label: 'Verified only',
        onClear: () => setFilters({ ...filters, verifiedOnly: false }),
      });
    return chips;
  }, [filters]);

  return (
    <div className="landing-visitors min-h-screen flex flex-col">
      <LandingNav />

      <main className="flex-1">
        {/* Hero (compact) */}
        <section className="px-6 lg:px-10 pt-10 pb-6">
          <div className="max-w-[1200px] mx-auto text-center">
            <Chip color="accent" variant="soft" size="md" className="!mb-4">
              <Zap size={12} />
              <Chip.Label>Verified talent network</Chip.Label>
            </Chip>
            <h1 className="text-3xl md:text-4xl font-medium text-foreground tracking-tight mb-2">
              Find your perfect{' '}
              <span className="bg-gradient-to-r from-accent to-accent bg-clip-text text-transparent">
                collaborator
              </span>
            </h1>
            <p className="text-muted text-base max-w-2xl mx-auto">
              Browse verified creators and managers. Filter by location,
              platform, category, and follower size.
            </p>
          </div>
        </section>

        {/* Body: sidebar + results */}
        <section className="px-6 lg:px-10 pb-12">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
            {/* Sidebar (desktop) */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <Card>
                  <Card.Header className="flex-row items-center justify-between !py-3">
                    <Card.Title className="inline-flex items-center gap-2 text-sm">
                      <Filter size={14} className="text-accent" /> Filters
                    </Card.Title>
                    {activeChips.length > 0 && (
                      <Chip color="accent" variant="soft" size="sm">
                        <Chip.Label>{activeChips.length}</Chip.Label>
                      </Chip>
                    )}
                  </Card.Header>
                  <Separator />
                  <Card.Content className="p-4 max-h-[calc(100vh-140px)] overflow-y-auto">
                    <FilterPanel
                      filters={filters}
                      setFilters={setFilters}
                      onReset={resetAll}
                    />
                  </Card.Content>
                </Card>
              </div>
            </aside>

            {/* Results */}
            <div>
              {/* Toolbar:
                 - Mobile: profession Segment (left) + Filters button (right).
                   Count and sort move into the Sheet to keep the row clean.
                 - Desktop (lg+): adds the count and sort Segment on the right. */}
              <div className="flex items-center gap-x-3 gap-y-2 mb-3 flex-wrap">
                <Segment
                  size="sm"
                  selectedKey={filters.profession}
                  onSelectionChange={(k) =>
                    setFilters({
                      ...filters,
                      profession: k as FilterState['profession'],
                    })
                  }
                >
                  <Segment.Item id="all">All · {counts.all}</Segment.Item>
                  <Segment.Item id="creator">
                    Creators · {counts.creators}
                  </Segment.Item>
                  <Segment.Item id="manager">
                    Managers · {counts.managers}
                  </Segment.Item>
                </Segment>

                <p className="hidden lg:block text-muted text-xs whitespace-nowrap">
                  {loading ? (
                    'Searching…'
                  ) : (
                    <>
                      <span className="text-foreground font-semibold tabular-nums">
                        {filtered.length}
                      </span>{' '}
                      profiles
                    </>
                  )}
                </p>

                {/* Right cluster: mobile shows only Filters; desktop shows Sort */}
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="lg:!hidden"
                    onPress={() => setSheetOpen(true)}
                  >
                    <Filter size={13} /> Filters
                    {activeChips.length > 0 && (
                      <Chip color="accent" variant="soft" size="sm">
                        <Chip.Label>{activeChips.length}</Chip.Label>
                      </Chip>
                    )}
                  </Button>
                  <Segment
                    size="sm"
                    className="hidden lg:flex"
                    selectedKey={sort}
                    onSelectionChange={(k) => setSort(k as typeof sort)}
                  >
                    <Segment.Item id="followers">Top</Segment.Item>
                    <Segment.Item id="name">A–Z</Segment.Item>
                    <Segment.Item id="newest">Newest</Segment.Item>
                  </Segment>
                </div>
              </div>

              {/* Active filter chips */}
              {activeChips.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {activeChips.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={c.onClear}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-soft border border-accent/40 text-accent-soft-foreground text-xs font-medium hover:bg-accent-soft/70 transition-colors"
                    >
                      {c.label}
                      <span className="opacity-60">×</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={resetAll}
                    className="text-muted text-xs font-medium hover:text-foreground underline"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Results grid */}
              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <Card>
                  <Card.Content className="p-8">
                    <EmptyState>
                      <EmptyState.Media>
                        <Users className="size-7" />
                      </EmptyState.Media>
                      <EmptyState.Title>No talent found</EmptyState.Title>
                      <EmptyState.Description>
                        Try broadening your search or removing some filters.
                      </EmptyState.Description>
                      <EmptyState.Content>
                        <Button
                          variant="primary"
                          size="md"
                          onPress={resetAll}
                        >
                          Reset all filters
                        </Button>
                      </EmptyState.Content>
                    </EmptyState>
                  </Card.Content>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map((t) => (
                    <TalentCard
                      key={t.id}
                      talent={t}
                      canInvite={canInvite}
                      loggedIn={loggedIn}
                      onInvite={() =>
                        setInvModal({
                          talent: t,
                          type:
                            t._type === 'creator'
                              ? 'creator_collab'
                              : 'manager_assign',
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Mobile filter sheet */}
      <Sheet
        isOpen={sheetOpen}
        onOpenChange={(open) => !open && setSheetOpen(false)}
        placement="left"
      >
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog>
              <Sheet.Header>
                <Sheet.Heading className="inline-flex items-center gap-2">
                  <Filter size={15} className="text-accent" /> Filters
                </Sheet.Heading>
              </Sheet.Header>
              <Sheet.Body className="!p-4">
                {/* Sort lives here on mobile (hidden from the page toolbar
                   to keep that row clean). */}
                <div className="pb-4 mb-4 border-b border-border">
                  <Label className="text-foreground text-xs font-semibold block mb-2.5">
                    Sort by
                  </Label>
                  <Segment
                    selectedKey={sort}
                    onSelectionChange={(k) => setSort(k as typeof sort)}
                  >
                    <Segment.Item id="followers">Top</Segment.Item>
                    <Segment.Item id="name">A–Z</Segment.Item>
                    <Segment.Item id="newest">Newest</Segment.Item>
                  </Segment>
                </div>
                <FilterPanel
                  filters={filters}
                  setFilters={setFilters}
                  onReset={resetAll}
                />
              </Sheet.Body>
              <Sheet.Footer>
                <Button
                  variant="primary"
                  fullWidth
                  onPress={() => setSheetOpen(false)}
                >
                  Show {filtered.length} results
                </Button>
              </Sheet.Footer>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>

      {/* Invitation modal */}
      {invModal && (
        <InvitationModal
          talent={invModal.talent}
          type={invModal.type}
          isOpen={!!invModal}
          onClose={() => setInvModal(null)}
        />
      )}
    </div>
  );
};

export default TalentNetwork;
