import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Camera,
  CheckCircle,
  MapPin,
  Search,
  Send,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  SearchField,
} from '@heroui/react';
import { EmptyState, KPI, Segment } from '@heroui-pro/react';
import api from '../lib/api';
import { PageShell } from '../components/ui';

const NICHES = [
  'All',
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
];

const FOLLOWER_RANGES = [
  { label: 'Any', min: 0, max: 0 },
  { label: 'Nano · 1K–10K', min: 1000, max: 10000 },
  { label: 'Micro · 10K–100K', min: 10000, max: 100000 },
  { label: 'Mid · 100K–1M', min: 100000, max: 1000000 },
  { label: 'Macro · 1M+', min: 1000000, max: 0 },
];

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
  if (followers >= 100_000) return '3.5–5.0%';
  if (followers >= 10_000) return '5.0–8.0%';
  return '8.0–15.0%';
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
  follower_count?: number;
  follower_range?: string;
  rating?: number;
  experience_years?: number;
};

const DashboardTalent: React.FC = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role') || '';
  const canInvite = userRole === 'brand' || userRole === 'manager';

  const [creators, setCreators] = useState<Talent[]>([]);
  const [managers, setManagers] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);

  const [profession, setProfession] = useState<'all' | 'creator' | 'manager'>(
    'all'
  );
  const [search, setSearch] = useState('');
  const [niche, setNiche] = useState('All');
  const [followerRange, setFollowerRange] = useState(0);
  const sort = 'followers_desc';

  const load = useCallback(() => {
    setLoading(true);
    const cp: any = { sort };
    if (search) cp.search = search;
    if (niche !== 'All') cp.category = niche;
    const range = FOLLOWER_RANGES[followerRange];
    if (range.min) cp.minFollowers = String(range.min);
    if (range.max) cp.maxFollowers = String(range.max);

    const mp: any = { sort: 'rating_desc' };
    if (search) mp.search = search;

    Promise.all([
      api.get('/creators/public-list', { params: cp }),
      api.get('/managers/public', { params: mp }),
    ])
      .then(([cr, mg]) => {
        setCreators(
          (cr.data || []).map((c: any) => ({
            ...c,
            _type: 'creator' as const,
            follower_count: parseFollowerCount(c.follower_range),
          }))
        );
        setManagers(
          (mg.data || []).map((m: any) => ({ ...m, _type: 'manager' as const }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, niche, followerRange]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const merged = useMemo(
    () =>
      [
        ...(profession !== 'manager' ? creators : []),
        ...(profession !== 'creator' ? managers : []),
      ].filter((t) => {
        if (niche !== 'All' && t._type === 'manager')
          return (t.specialty || '')
            .toLowerCase()
            .includes(niche.toLowerCase());
        return true;
      }),
    [creators, managers, profession, niche]
  );

  return (
    <PageShell
      title="Talent network"
      description="Browse verified creators and managers from within your dashboard."
      icon={<Star size={18} />}
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPI>
          <KPI.Header>
            <KPI.Title>Total profiles</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value
              value={merged.length}
              maximumFractionDigits={0}
            />
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Creators</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={creators.length} maximumFractionDigits={0} />
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Managers</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={managers.length} maximumFractionDigits={0} />
          </KPI.Content>
        </KPI>
      </div>

      {/* Profession filter + search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Segment
          selectedKey={profession}
          onSelectionChange={(k) => setProfession(k as typeof profession)}
        >
          <Segment.Item id="all">All · {creators.length + managers.length}</Segment.Item>
          <Segment.Item id="creator">Creators · {creators.length}</Segment.Item>
          <Segment.Item id="manager">Managers · {managers.length}</Segment.Item>
        </Segment>
        <SearchField
          aria-label="Search talent"
          value={search}
          onChange={setSearch}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              className="w-full sm:w-[280px]"
              placeholder="Search by name or username…"
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      {/* Niche chips */}
      <div>
        <p className="text-muted text-[10px] font-medium uppercase tracking-widest mb-2">
          Niche
        </p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {NICHES.map((n) => {
            const active = niche === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setNiche(n)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
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
      </div>

      {/* Follower range chips (creator-only) */}
      {profession !== 'manager' && (
        <div>
          <p className="text-muted text-[10px] font-medium uppercase tracking-widest mb-2">
            Followers
          </p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {FOLLOWER_RANGES.map((r, i) => {
              const active = followerRange === i;
              return (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setFollowerRange(i)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-accent border-accent text-accent-foreground'
                      : 'bg-surface border-border text-foreground hover:border-accent/40'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : merged.length === 0 ? (
        <Card>
          <Card.Content className="p-8">
            <EmptyState>
              <EmptyState.Media>
                <Search className="size-7" />
              </EmptyState.Media>
              <EmptyState.Title>No talent found</EmptyState.Title>
              <EmptyState.Description>
                Try broadening your search or clearing filters.
              </EmptyState.Description>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {merged.map((t, i) => {
            const name =
              t.full_name ||
              t.username ||
              (t._type === 'creator' ? 'Creator' : 'Manager');
            const initial = name[0]?.toUpperCase() || 'T';
            const followers = t.follower_count || 0;
            return (
              <Card key={`${t.id}-${i}`} className="flex flex-col">
                <Card.Content className="p-4 flex flex-col flex-1 gap-3">
                  <div className="flex items-center justify-between">
                    <Chip
                      color={t._type === 'creator' ? 'accent' : 'default'}
                      variant="soft"
                      size="sm"
                    >
                      {t._type === 'creator' ? (
                        <Camera size={10} />
                      ) : (
                        <Award size={10} />
                      )}
                      <Chip.Label className="capitalize">{t._type}</Chip.Label>
                    </Chip>
                    <ShieldCheck size={14} className="text-accent" />
                  </div>

                  <div className="flex items-center gap-3">
                    <Avatar size="lg">
                      {t.avatar_url && (
                        <Avatar.Image src={t.avatar_url} alt={name} />
                      )}
                      <Avatar.Fallback>{initial}</Avatar.Fallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="text-foreground text-sm font-semibold truncate">
                        {name}
                      </h3>
                      <div className="flex items-center gap-2 text-muted text-[10px] flex-wrap">
                        {t.category && <span>{t.category}</span>}
                        {t.specialty && <span>{t.specialty}</span>}
                        {t.location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin size={8} /> {t.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-muted text-xs line-clamp-2 flex-1">
                    {t.bio || 'Verified talent ready to collaborate.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {t._type === 'creator' ? (
                      <>
                        <div className="bg-surface-secondary rounded-lg p-2 text-center">
                          <div className="text-foreground text-sm font-semibold tabular-nums">
                            {formatFollowers(followers)}
                          </div>
                          <div className="text-muted text-[10px] font-medium uppercase">
                            Followers
                          </div>
                        </div>
                        <div className="bg-surface-secondary rounded-lg p-2 text-center">
                          <div className="text-foreground text-sm font-semibold tabular-nums">
                            {getEngagementRate(followers).split('–')[0]}
                          </div>
                          <div className="text-muted text-[10px] font-medium uppercase">
                            Eng. rate
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-surface-secondary rounded-lg p-2 text-center">
                          <div className="text-foreground text-sm font-semibold inline-flex items-center justify-center gap-0.5">
                            <Star
                              size={10}
                              className="fill-warning text-warning"
                            />
                            {Number(t.rating || 5).toFixed(1)}
                          </div>
                          <div className="text-muted text-[10px] font-medium uppercase">
                            Rating
                          </div>
                        </div>
                        <div className="bg-surface-secondary rounded-lg p-2 text-center">
                          <div className="text-foreground text-sm font-semibold tabular-nums">
                            {t.experience_years || 5}yr+
                          </div>
                          <div className="text-muted text-[10px] font-medium uppercase">
                            Experience
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {canInvite ? (
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      onPress={() => navigate('/talent')}
                    >
                      <Send size={12} /> Invite & collaborate
                    </Button>
                  ) : (
                    <Chip
                      color="default"
                      variant="soft"
                      size="md"
                      className="self-center"
                    >
                      <CheckCircle size={11} />
                      <Chip.Label>Viewing</Chip.Label>
                    </Chip>
                  )}
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
};

export default DashboardTalent;
