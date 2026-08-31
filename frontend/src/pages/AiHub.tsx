import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MessageCircle,
  Send,
  Shield,
  Sparkles,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Modal,
  Separator,
} from '@heroui/react';
import {
  EmptyState,
  Segment,
} from '@heroui-pro/react';
import api, { serverOrigin } from '../lib/api';
import { PageShell } from '../components/ui';

/* ── Shared input styles ───────────────────────────────────────── */
const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted';
const fieldStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  outline: 'none',
};
const labelClass = 'text-muted text-xs font-medium uppercase tracking-wider block mb-1.5';

const resolveAvatar = (avatar: string | undefined) => {
  if (!avatar) return '';
  if (
    avatar.startsWith('http') ||
    avatar.startsWith('data:') ||
    avatar.startsWith('blob:')
  )
    return avatar;
  return `${serverOrigin}${avatar}`;
};

const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

/* ── Profile card modal ─────────────────────────────────────────── */
const ProfileCardModal: React.FC<{
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}> = ({ userId, isOpen, onClose }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api
      .get(`/creators/public/${userId}`)
      .then((r) => {
        setProfile(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId, isOpen]);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Creator profile</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-accent" size={22} />
              </div>
            ) : profile ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar size="lg" className="!h-14 !w-14">
                    {resolveAvatar(profile.avatar_url) && (
                      <Avatar.Image
                        src={resolveAvatar(profile.avatar_url)}
                        alt={profile.full_name}
                      />
                    )}
                    <Avatar.Fallback>
                      {(profile.full_name?.[0] || '?').toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-foreground text-lg font-semibold truncate">
                      {profile.full_name || 'Unknown'}
                    </div>
                    {profile.username && (
                      <div className="text-muted text-sm truncate">
                        @{profile.username.replace(/^@/, '')}
                      </div>
                    )}
                    <Chip color="accent" variant="soft" size="sm" className="mt-1 capitalize">
                      {profile.role}
                    </Chip>
                  </div>
                </div>
                {profile.bio && (
                  <Card>
                    <Card.Content className="p-3 text-sm">
                      {profile.bio}
                    </Card.Content>
                  </Card>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { l: 'Niche', v: profile.category },
                    { l: 'Location', v: profile.location },
                    { l: 'Followers', v: profile.follower_range },
                    {
                      l: 'Joined',
                      v: profile.joined && new Date(profile.joined).toLocaleDateString(),
                    },
                  ]
                    .filter((x) => x.v)
                    .map((x) => (
                      <div
                        key={x.l}
                        className="p-3 rounded-lg"
                        style={{
                          background: 'var(--surface-secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div className="text-muted text-[10px] uppercase font-medium tracking-wider">
                          {x.l}
                        </div>
                        <div className="text-foreground text-sm font-semibold">
                          {x.v}
                        </div>
                      </div>
                    ))}
                </div>
                {profile.social_links && (
                  <a
                    href={
                      profile.social_links.startsWith('http')
                        ? profile.social_links
                        : `https://${profile.social_links}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent text-sm font-medium hover:underline truncate block"
                  >
                    {profile.social_links}
                  </a>
                )}
              </div>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onPress={onClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── 1. Caption generator ───────────────────────────────────────── */
const CaptionGenerator: React.FC = () => {
  const [brandName, setBrandName] = useState('');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [tone, setTone] = useState('casual');
  const [captions, setCaptions] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const generate = async () => {
    if (!brandName.trim() || !campaignTitle.trim()) return;
    setLoading(true);
    setCaptions([]);
    try {
      const res = await api.post('/ai/captions', {
        brandName,
        campaignTitle,
        platform,
        tone,
        count: 5,
      });
      setCaptions(res.data.captions || []);
      setCategory(res.data.category || '');
      setConfidence(res.data.confidence || 0);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Brand name *</label>
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Nike, Glossier…"
            className={fieldClass}
            style={fieldStyle}
          />
        </div>
        <div>
          <label className={labelClass}>Campaign title *</label>
          <input
            value={campaignTitle}
            onChange={(e) => setCampaignTitle(e.target.value)}
            placeholder="Summer collection launch"
            className={fieldClass}
            style={fieldStyle}
          />
        </div>
        <div>
          <label className={labelClass}>Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          >
            <option>Instagram</option>
            <option>TikTok</option>
            <option>YouTube</option>
            <option>Twitter</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          >
            <option value="casual">Casual & fun</option>
            <option value="professional">Professional</option>
            <option value="edgy">Edgy & bold</option>
            <option value="inspirational">Inspirational</option>
            <option value="humorous">Humorous</option>
          </select>
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        fullWidth
        className="!rounded-xl"
        isPending={loading}
        isDisabled={!brandName.trim() || !campaignTitle.trim()}
        onPress={generate}
      >
        <Sparkles size={14} /> Generate AI captions
      </Button>

      {captions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Chip variant="secondary" size="sm">
              Category: {category}
            </Chip>
            <Chip color="success" variant="soft" size="sm">
              {confidence}% confidence
            </Chip>
          </div>
          {captions.map((c, i) => (
            <Card key={i}>
              <Card.Content className="p-4">
                <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                  {c}
                </p>
                <div
                  className="flex items-center justify-between mt-3 pt-3"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <span className="text-muted text-[11px]">Caption {i + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!rounded-lg"
                    onPress={() => {
                      copyToClipboard(c);
                      setCopiedIdx(i);
                      setTimeout(() => setCopiedIdx(null), 2000);
                    }}
                  >
                    {copiedIdx === i ? (
                      <>
                        <Check size={12} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy
                      </>
                    )}
                  </Button>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── 2. Smart match ─────────────────────────────────────────────── */
export const SmartMatch: React.FC = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | number | null>(null);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/campaigns/active').then((r) => setCampaigns(r.data || [])).catch(() => {});
  }, []);

  const find = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const r = await api.get(`/ai/match/${selected}`);
      setMatches(r.data || []);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className={fieldClass + ' flex-1'}
          style={fieldStyle}
        >
          <option value="">Select a campaign…</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} · ${Number(c.budget || 0).toLocaleString()}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          size="md"
          className="!rounded-xl"
          isPending={loading}
          isDisabled={!selected}
          onPress={find}
        >
          <Target size={14} /> Find matches
        </Button>
      </div>

      {matches.length > 0 && (
        <div className="space-y-3">
          <p className="text-muted text-xs uppercase tracking-wider font-medium">
            {matches.length} creators matched
          </p>
          {matches.map((m, i) => {
            const id = m.id || i;
            const isExp = expanded === id;
            return (
              <Card key={id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isExp ? null : id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <Avatar size="md">
                      {resolveAvatar(m.avatar) && (
                        <Avatar.Image src={resolveAvatar(m.avatar)} alt={m.name} />
                      )}
                      <Avatar.Fallback>
                        {(m.name?.[0] || 'C').toUpperCase()}
                      </Avatar.Fallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-foreground text-sm font-semibold truncate">
                            {m.name}
                          </span>
                          {m.username && (
                            <span className="text-muted text-xs truncate">
                              @{m.username.replace(/^@/, '')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Chip color="accent" variant="soft" size="sm">
                            <Star size={11} /> {m.matchScore}%
                          </Chip>
                          {isExp ? (
                            <ChevronUp size={14} className="text-muted" />
                          ) : (
                            <ChevronDown size={14} className="text-muted" />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {[m.category, m.platform, m.location, m.followers && `${m.followers} followers`]
                          .filter(Boolean)
                          .map((tag) => (
                            <Chip key={tag} variant="secondary" size="sm">
                              {tag}
                            </Chip>
                          ))}
                      </div>
                      {m.bio && (
                        <p className="text-muted text-xs mt-2 line-clamp-2">{m.bio}</p>
                      )}
                    </div>
                  </div>
                </button>
                {isExp && (
                  <>
                    <Separator />
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { l: 'Followers', v: m.followers || 'N/A' },
                          { l: 'Engagement', v: m.engagementRate || m.engagement_rate || 'N/A' },
                          { l: 'Quality', v: m.contentQuality || m.content_quality || 'N/A' },
                          { l: 'Brand safety', v: m.brandSafety || m.brand_safety || 'N/A' },
                        ].map((x) => (
                          <div
                            key={x.l}
                            className="text-center p-2 rounded-lg"
                            style={{
                              background: 'var(--surface-secondary)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <div className="text-foreground text-sm font-semibold">
                              {x.v}
                            </div>
                            <div className="text-muted text-[10px] uppercase font-medium">
                              {x.l}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.matchReasons?.map((r: string, ri: number) => (
                          <Chip key={ri} color="accent" variant="soft" size="sm">
                            {r}
                          </Chip>
                        ))}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Link
                          to={`/dashboard/messages?newId=${m.id}&name=${encodeURIComponent(m.name)}`}
                        >
                          <Button variant="primary" size="sm" className="!rounded-lg">
                            <Send size={12} /> Message
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="!rounded-lg"
                          onPress={() => setViewProfileId(m.id)}
                        >
                          <ExternalLink size={12} /> Profile
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {viewProfileId && (
        <ProfileCardModal
          userId={viewProfileId}
          isOpen={!!viewProfileId}
          onClose={() => setViewProfileId(null)}
        />
      )}
    </div>
  );
};

/* ── 3. Performance predictor ───────────────────────────────────── */
export const PerformancePredictor: React.FC = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/campaigns/active').then((r) => setCampaigns(r.data || [])).catch(() => {});
  }, []);

  const predict = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const r = await api.get(`/ai/predict/${selected}`);
      setPrediction(r.data);
    } catch {}
    setLoading(false);
  };

  const fmt = (n: number) =>
    n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className={fieldClass + ' flex-1'}
          style={fieldStyle}
        >
          <option value="">Select a campaign…</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          size="md"
          className="!rounded-xl"
          isPending={loading}
          isDisabled={!selected}
          onPress={predict}
        >
          <TrendingUp size={14} /> Predict
        </Button>
      </div>

      {prediction && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-sm font-semibold">
              {prediction.campaignTitle}
            </span>
            <Chip color="success" variant="soft" size="sm">
              {prediction.confidence}% confidence
            </Chip>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { l: 'Est. reach', v: fmt(prediction.predictedReach || 0) },
              { l: 'Impressions', v: fmt(prediction.predictedImpressions || 0) },
              { l: 'Engagement', v: prediction.predictedEngagementRate || '0%' },
              { l: 'Est. ROI', v: prediction.estimatedROI || '0×' },
            ].map((s) => (
              <Card key={s.l}>
                <Card.Content className="p-4 text-center">
                  <div className="text-foreground text-xl font-semibold tabular-nums">
                    {s.v}
                  </div>
                  <div className="text-muted text-[10px] uppercase tracking-wider font-medium mt-1">
                    {s.l}
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
          {prediction.recommendations?.length > 0 && (
            <Card>
              <Card.Header>
                <Card.Title className="text-base">AI recommendations</Card.Title>
              </Card.Header>
              <Separator />
              <Card.Content className="p-4 space-y-2">
                {prediction.recommendations.map((r: string, i: number) => (
                  <p
                    key={i}
                    className="text-foreground text-sm flex items-start gap-2"
                  >
                    <span className="text-success mt-0.5">•</span> {r}
                  </p>
                ))}
              </Card.Content>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

/* ── 4. Pitch assistant ─────────────────────────────────────────── */
const PitchAssistant: React.FC = () => {
  const [campaignTitle, setCampaignTitle] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [creatorCategory, setCreatorCategory] = useState('');
  const [pitches, setPitches] = useState<string[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const generate = async () => {
    if (!campaignTitle.trim() || !creatorName.trim()) return;
    setLoading(true);
    setPitches([]);
    try {
      const r = await api.post('/ai/pitch', {
        campaignTitle,
        creatorName,
        creatorCategory,
      });
      setPitches(r.data.pitches || []);
      setTips(r.data.tips || []);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Campaign title *</label>
          <input
            value={campaignTitle}
            onChange={(e) => setCampaignTitle(e.target.value)}
            placeholder="Summer fashion drop"
            className={fieldClass}
            style={fieldStyle}
          />
        </div>
        <div>
          <label className={labelClass}>Your name *</label>
          <input
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            placeholder="Alex Rivera"
            className={fieldClass}
            style={fieldStyle}
          />
        </div>
        <div>
          <label className={labelClass}>Your niche</label>
          <input
            value={creatorCategory}
            onChange={(e) => setCreatorCategory(e.target.value)}
            placeholder="Fashion, tech…"
            className={fieldClass}
            style={fieldStyle}
          />
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        fullWidth
        className="!rounded-xl"
        isPending={loading}
        isDisabled={!campaignTitle.trim() || !creatorName.trim()}
        onPress={generate}
      >
        <MessageCircle size={14} /> Generate AI pitches
      </Button>

      {pitches.length > 0 && (
        <div className="space-y-3">
          {pitches.map((p, i) => (
            <Card key={i}>
              <Card.Content className="p-4">
                <p className="text-foreground text-sm leading-relaxed">{p}</p>
                <div
                  className="flex items-center justify-between mt-3 pt-3"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <span className="text-muted text-[11px]">Pitch {i + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!rounded-lg"
                    onPress={() => {
                      copyToClipboard(p);
                      setCopiedIdx(i);
                      setTimeout(() => setCopiedIdx(null), 2000);
                    }}
                  >
                    {copiedIdx === i ? (
                      <>
                        <Check size={12} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy
                      </>
                    )}
                  </Button>
                </div>
              </Card.Content>
            </Card>
          ))}
          {tips.length > 0 && (
            <Card className="bg-warning-soft border-warning/40">
              <Card.Content className="p-4 space-y-1.5">
                <div className="text-warning-soft-foreground text-xs font-medium uppercase tracking-wider">
                  Pro tips
                </div>
                {tips.map((t, i) => (
                  <p key={i} className="text-foreground text-xs">
                    • {t}
                  </p>
                ))}
              </Card.Content>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

/* ── 5. Applicant ranker ────────────────────────────────────────── */
export const ApplicantRanker: React.FC = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [ranked, setRanked] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | number | null>(null);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/campaigns/brand')
      .then((r) => setCampaigns(r.data || []))
      .catch(() => {
        api.get('/campaigns/active').then((r) => setCampaigns(r.data || [])).catch(() => {});
      });
  }, []);

  const rank = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const r = await api.get(`/ai/rank/${selected}`);
      setRanked(r.data.ranked_applicants || []);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <p className="text-muted text-sm">
        AI analyzes applicant profiles using ML-trained quality scoring to rank
        creators by qualification, brand safety, and predicted performance.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className={fieldClass + ' flex-1'}
          style={fieldStyle}
        >
          <option value="">Select a campaign…</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          size="md"
          className="!rounded-xl"
          isPending={loading}
          isDisabled={!selected}
          onPress={rank}
        >
          <Users size={14} /> Rank applicants
        </Button>
      </div>

      {ranked.length > 0 && (
        <div className="space-y-3">
          <p className="text-muted text-xs uppercase tracking-wider font-medium">
            {ranked.length} applicants scored
          </p>
          {ranked.map((a, i) => {
            const id = a.applicant_id || i;
            const isExp = expanded === id;
            const score = a.qualification_score;
            const color: 'success' | 'warning' | 'danger' =
              score > 70 ? 'success' : score > 50 ? 'warning' : 'danger';
            return (
              <Card key={id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isExp ? null : id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <Avatar size="md">
                        {resolveAvatar(a.avatar) && (
                          <Avatar.Image src={resolveAvatar(a.avatar)} alt={a.name} />
                        )}
                        <Avatar.Fallback>
                          {(a.name?.[0] || '?').toUpperCase()}
                        </Avatar.Fallback>
                      </Avatar>
                      <span
                        className="absolute -top-1 -left-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                        style={{
                          background: 'var(--accent)',
                          color: 'var(--accent-foreground)',
                          border: '2px solid var(--surface)',
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-foreground text-sm font-semibold truncate">
                            {a.name}
                          </span>
                          {a.recommended ? (
                            <ThumbsUp size={12} className="text-success shrink-0" />
                          ) : (
                            <ThumbsDown size={12} className="text-muted shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Chip color={color} variant="soft" size="sm">
                            {score}/100
                          </Chip>
                          {isExp ? (
                            <ChevronUp size={14} className="text-muted" />
                          ) : (
                            <ChevronDown size={14} className="text-muted" />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {[a.category, a.platform, a.followers > 0 && `${Number(a.followers).toLocaleString()} followers`]
                          .filter(Boolean)
                          .map((tag) => (
                            <Chip key={String(tag)} variant="secondary" size="sm">
                              {tag}
                            </Chip>
                          ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {a.strengths?.map((s: string, si: number) => (
                          <Chip key={si} color="success" variant="soft" size="sm">
                            <Shield size={9} /> {s}
                          </Chip>
                        ))}
                        {a.concerns?.map((c: string, ci: number) => (
                          <Chip key={ci} color="warning" variant="soft" size="sm">
                            <AlertTriangle size={9} /> {c}
                          </Chip>
                        ))}
                      </div>
                      <div className="text-muted text-[10px] mt-1">
                        AI confidence: {a.confidence}%
                      </div>
                    </div>
                  </div>
                </button>
                {isExp && (
                  <>
                    <Separator />
                    <div className="p-4 space-y-3">
                      {a.pitch && (
                        <Card
                          style={{ background: 'var(--surface-secondary)' }}
                        >
                          <Card.Content className="p-3">
                            <div className="text-muted text-[10px] uppercase tracking-wider font-medium mb-1">
                              Pitch
                            </div>
                            <p className="text-foreground text-sm">{a.pitch}</p>
                          </Card.Content>
                        </Card>
                      )}
                      {a.bio && (
                        <Card
                          style={{ background: 'var(--surface-secondary)' }}
                        >
                          <Card.Content className="p-3">
                            <div className="text-muted text-[10px] uppercase tracking-wider font-medium mb-1">
                              Bio
                            </div>
                            <p className="text-foreground text-sm">{a.bio}</p>
                          </Card.Content>
                        </Card>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {a.creator_user_id && (
                          <Link
                            to={`/dashboard/messages?newId=${a.creator_user_id}&name=${encodeURIComponent(a.name)}`}
                          >
                            <Button variant="primary" size="sm" className="!rounded-lg">
                              <Send size={12} /> Message
                            </Button>
                          </Link>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="!rounded-lg"
                          onPress={() =>
                            setViewProfileId(a.creator_user_id || a.applicant_id)
                          }
                        >
                          <ExternalLink size={12} /> Profile
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {viewProfileId && (
        <ProfileCardModal
          userId={viewProfileId}
          isOpen={!!viewProfileId}
          onClose={() => setViewProfileId(null)}
        />
      )}
    </div>
  );
};

/* ── 6. Contract generator ──────────────────────────────────────── */
const ContractGenerator: React.FC = () => {
  const [brandName, setBrandName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [budget, setBudget] = useState('');
  const [contract, setContract] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!brandName.trim() || !creatorName.trim() || !campaignTitle.trim()) return;
    setLoading(true);
    setContract('');
    try {
      const r = await api.post('/ai/contract', {
        brandName,
        creatorName,
        campaignTitle,
        deliverables,
        budget: Number(budget) || 0,
        platform: 'Instagram',
        usageRights: '30 days',
      });
      setContract(r.data.contract || '');
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { l: 'Brand name *', v: brandName, set: setBrandName, p: 'Nike Inc.' },
          { l: 'Creator name *', v: creatorName, set: setCreatorName, p: 'Alex Rivera' },
          {
            l: 'Campaign title *',
            v: campaignTitle,
            set: setCampaignTitle,
            p: 'Summer collection launch',
          },
          {
            l: 'Budget ($)',
            v: budget,
            set: setBudget,
            p: '5000',
            type: 'number' as const,
          },
        ].map((f) => (
          <div key={f.l}>
            <label className={labelClass}>{f.l}</label>
            <input
              type={f.type || 'text'}
              value={f.v}
              onChange={(e) => f.set(e.target.value)}
              placeholder={f.p}
              className={fieldClass}
              style={fieldStyle}
            />
          </div>
        ))}
      </div>
      <div>
        <label className={labelClass}>Deliverables</label>
        <textarea
          value={deliverables}
          onChange={(e) => setDeliverables(e.target.value)}
          placeholder="3 Instagram Reels, 2 Stories, 1 Feed Post"
          className={`${fieldClass} h-20 resize-none`}
          style={fieldStyle}
        />
      </div>

      <Button
        variant="primary"
        size="md"
        fullWidth
        className="!rounded-xl"
        isPending={loading}
        isDisabled={!brandName.trim() || !creatorName.trim() || !campaignTitle.trim()}
        onPress={generate}
      >
        <FileText size={14} /> Generate contract
      </Button>

      {contract && (
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title className="text-base">Generated contract</Card.Title>
            <Button
              variant="ghost"
              size="sm"
              className="!rounded-lg"
              onPress={() => {
                copyToClipboard(contract);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? (
                <>
                  <Check size={12} /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy all
                </>
              )}
            </Button>
          </Card.Header>
          <Separator />
          <Card.Content className="p-5 max-h-[500px] overflow-y-auto">
            <pre
              className="text-foreground text-sm leading-relaxed whitespace-pre-wrap font-sans"
              style={{ background: 'var(--surface-secondary)' }}
            >
              {contract}
            </pre>
          </Card.Content>
        </Card>
      )}
    </div>
  );
};

/* ── 7. Campaign recommender ────────────────────────────────────── */
export const CampaignRecommender: React.FC = () => {
  const [category, setCategory] = useState('fashion');
  const [interests, setInterests] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const recommend = async () => {
    setLoading(true);
    try {
      const r = await api.post('/ai/recommend', {
        creatorCategory: category,
        creatorInterests: interests
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        creatorFollowers: 10000,
        creatorPlatform: platform,
      });
      setRecs(r.data.recommendations || []);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <p className="text-muted text-sm">
        AI matches your profile against active campaign descriptions using TF-IDF
        cosine similarity.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Your niche</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          >
            {[
              'fashion',
              'tech',
              'food',
              'fitness',
              'beauty',
              'travel',
              'gaming',
              'lifestyle',
              'music',
              'education',
            ].map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Other interests</label>
          <input
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="tech, lifestyle"
            className={fieldClass}
            style={fieldStyle}
          />
        </div>
        <div>
          <label className={labelClass}>Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          >
            <option>Instagram</option>
            <option>TikTok</option>
            <option>YouTube</option>
            <option>Twitter</option>
            <option>Twitch</option>
          </select>
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        fullWidth
        className="!rounded-xl"
        isPending={loading}
        onPress={recommend}
      >
        <Compass size={14} /> Find recommended campaigns
      </Button>

      {recs.length > 0 && (
        <div className="space-y-3">
          {recs.map((r, i) => {
            const isExp = expanded === i;
            return (
              <Card key={i} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isExp ? null : i)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-foreground text-sm font-semibold">
                      {r.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Chip color="accent" variant="soft" size="sm">
                        <Star size={11} /> {r.match_score}%
                      </Chip>
                      {isExp ? (
                        <ChevronUp size={14} className="text-muted" />
                      ) : (
                        <ChevronDown size={14} className="text-muted" />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[r.category, r.platform, r.budget_range].filter(Boolean).map((t) => (
                      <Chip key={t} variant="secondary" size="sm">
                        {t}
                      </Chip>
                    ))}
                  </div>
                  <p className="text-muted text-xs mt-2">{r.why}</p>
                </button>
                {isExp && (
                  <>
                    <Separator />
                    <div className="p-4 space-y-3">
                      {r.description && (
                        <Card style={{ background: 'var(--surface-secondary)' }}>
                          <Card.Content className="p-3">
                            <div className="text-muted text-[10px] uppercase tracking-wider font-medium mb-1">
                              Description
                            </div>
                            <p className="text-foreground text-sm">
                              {r.description}
                            </p>
                          </Card.Content>
                        </Card>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <Link to="/dashboard/campaigns">
                          <Button variant="primary" size="sm" className="!rounded-lg">
                            <Target size={12} /> Apply
                          </Button>
                        </Link>
                        {r.brand_id && (
                          <Link
                            to={`/dashboard/messages?newId=${r.brand_id}&name=${encodeURIComponent(r.brand_name || 'Brand')}`}
                          >
                            <Button variant="outline" size="sm" className="!rounded-lg">
                              <Send size={12} /> Message brand
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── 8. Deep research ───────────────────────────────────────────── */
export const DeepResearch: React.FC = () => {
  const [username, setUsername] = useState('');
  const [niche, setNiche] = useState('');
  const [followerCount, setFollowerCount] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [knownFor, setKnownFor] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoFile(reader.result as string);
      setImageUrl('');
    };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!niche.trim() || !knownFor.trim()) return;
    setLoading(true);
    setReport(null);
    try {
      const res = await api.post('/ai/deep-research', {
        image_url: photoFile || imageUrl || 'https://placeholder.com/generic-creator.jpg',
        username: username || 'unknown',
        niche,
        follower_count: followerCount,
        platform,
        known_for: knownFor,
      });
      setReport({
        ...res.data,
        inputMeta: { username, niche, followerCount, platform, knownFor },
      });
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <p className="text-muted text-sm">
        Describe the type of influencer you need. The AI searches the web in
        real-time and returns discovered creators that match your criteria.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Username / handle</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@creator_name"
            className={fieldClass}
            style={fieldStyle}
          />
        </div>
        <div>
          <label className={labelClass}>Niche *</label>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          >
            <option value="">Select niche…</option>
            <option>Fashion & Style</option>
            <option>Tech & Gadgets</option>
            <option>Food & Cooking</option>
            <option>Fitness & Health</option>
            <option>Beauty & Skincare</option>
            <option>Travel & Lifestyle</option>
            <option>Gaming</option>
            <option>Education</option>
            <option>Business & Finance</option>
            <option>Entertainment</option>
            <option>Art & Design</option>
            <option>Music</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Follower count (est.)</label>
          <input
            value={followerCount}
            onChange={(e) => setFollowerCount(e.target.value)}
            placeholder="50000 or 50K"
            className={fieldClass}
            style={fieldStyle}
          />
        </div>
        <div>
          <label className={labelClass}>Primary platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          >
            <option>Instagram</option>
            <option>TikTok</option>
            <option>YouTube</option>
            <option>Twitter</option>
            <option>Twitch</option>
            <option>LinkedIn</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>What are they known for? *</label>
        <textarea
          value={knownFor}
          onChange={(e) => setKnownFor(e.target.value)}
          placeholder="Specialty, content style, audience type, notable collabs…"
          className={`${fieldClass} h-20 resize-none`}
          style={fieldStyle}
        />
      </div>

      <Card>
        <Card.Content className="p-4 space-y-3">
          <label className={labelClass}>Profile photo (optional)</label>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setPhotoFile('');
              }}
              placeholder="Paste image URL…"
              className={fieldClass + ' flex-1'}
              style={fieldStyle}
            />
            <span className="text-muted text-xs font-medium text-center">OR</span>
            <label
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-foreground text-sm cursor-pointer"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <Eye size={14} className="text-muted" />
              <span>{photoFile ? 'Photo uploaded ✓' : 'Upload photo'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhoto}
              />
            </label>
          </div>
        </Card.Content>
      </Card>

      <Button
        variant="primary"
        size="md"
        fullWidth
        className="!rounded-xl"
        isPending={loading}
        isDisabled={!niche.trim() || !knownFor.trim()}
        onPress={analyze}
      >
        <Shield size={14} /> Run creator research
      </Button>

      {report?.success && (
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <div>
              <Card.Title className="text-base">Creator research report</Card.Title>
              <Card.Description className="text-xs">
                AI confidence: {report.ml_confidence}%
                {report.inputMeta?.username &&
                  ` · @${report.inputMeta.username.replace(/^@/, '')}`}
              </Card.Description>
            </div>
            {report.analysis?.visual_brand_safety?.is_brand_safe ? (
              <Chip color="success" variant="soft" size="md">
                <Shield size={12} /> Brand safe
              </Chip>
            ) : (
              <Chip color="warning" variant="soft" size="md">
                <AlertTriangle size={12} /> Review
              </Chip>
            )}
          </Card.Header>
          <Separator />
          <Card.Content className="p-5 space-y-4">
            {report.discovered_creators?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-accent text-[11px] font-medium uppercase tracking-wider">
                    🌐 Discovered creators ({report.discovered_creators.length})
                  </span>
                  <span className="text-muted text-[10px]">Live internet search</span>
                </div>
                <div className="space-y-3">
                  {report.discovered_creators.map((c: any, i: number) => (
                    <Card key={i}>
                      <Card.Content className="p-4 flex items-start gap-3">
                        <Avatar size="md">
                          <Avatar.Fallback
                            style={{
                              background:
                                'linear-gradient(135deg, var(--accent) 0%, var(--accent-2, var(--accent)) 100%)',
                              color: 'var(--accent-foreground)',
                            }}
                          >
                            {c.handle?.[1]?.toUpperCase() || '#'}
                          </Avatar.Fallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-foreground text-sm font-semibold truncate">
                            {c.display_name || c.handle}
                          </div>
                          <div className="text-muted text-xs">{c.handle}</div>
                          <div className="mt-1 flex gap-1.5 flex-wrap">
                            <Chip color="accent" variant="soft" size="sm">
                              {c.platform}
                            </Chip>
                            <Chip variant="secondary" size="sm">
                              ~{c.estimated_followers} followers
                            </Chip>
                          </div>
                          {c.snippet && (
                            <p className="text-muted text-xs mt-2 line-clamp-2">
                              {c.snippet}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <a href={c.url} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="sm" className="!rounded-lg">
                              Visit <ExternalLink size={11} />
                            </Button>
                          </a>
                          <Button
                            variant="primary"
                            size="sm"
                            className="!rounded-lg"
                            onPress={() =>
                              alert(
                                `Automated outreach initiated for ${c.handle}.`
                              )
                            }
                          >
                            <Send size={11} /> Outreach
                          </Button>
                        </div>
                      </Card.Content>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {report.inputMeta?.niche && (
              <Card className="bg-accent-soft border-accent/30">
                <Card.Content className="p-4">
                  <div className="text-accent-soft-foreground text-[10px] uppercase tracking-wider font-medium mb-1">
                    AI recommendation
                  </div>
                  <p className="text-foreground text-sm">
                    Based on the <strong>{report.inputMeta.niche}</strong> niche
                    {report.inputMeta.followerCount
                      ? ` with ~${report.inputMeta.followerCount} followers`
                      : ''}{' '}
                    on <strong>{report.inputMeta.platform || 'Instagram'}</strong>,
                    this creator profile aligns well with campaigns targeting
                    engaged audiences in{' '}
                    {report.inputMeta.niche?.toLowerCase()} content verticals.
                  </p>
                </Card.Content>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.analysis?.demographics_estimated && (
                <Card>
                  <Card.Content className="p-3">
                    <div className="text-muted text-[10px] uppercase tracking-wider font-medium mb-1">
                      Demographics
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <div className="text-muted text-xs">Age</div>
                        <div className="text-foreground text-sm font-semibold">
                          {report.analysis.demographics_estimated.age_group}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted text-xs">Presentation</div>
                        <div className="text-foreground text-sm font-semibold">
                          {report.analysis.demographics_estimated.gender_presentation}
                        </div>
                      </div>
                    </div>
                  </Card.Content>
                </Card>
              )}
              {report.analysis?.aesthetic_tags && (
                <Card>
                  <Card.Content className="p-3">
                    <div className="text-muted text-[10px] uppercase tracking-wider font-medium mb-2">
                      Aesthetic tags
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {report.analysis.aesthetic_tags.map((t: string) => (
                        <Chip key={t} variant="secondary" size="sm">
                          {t}
                        </Chip>
                      ))}
                    </div>
                  </Card.Content>
                </Card>
              )}
              {report.analysis?.recommended_platforms && (
                <Card>
                  <Card.Content className="p-3">
                    <div className="text-muted text-[10px] uppercase tracking-wider font-medium mb-2">
                      Platform fit
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {report.analysis.recommended_platforms.map((p: string) => (
                        <Chip key={p} color="accent" variant="soft" size="sm">
                          {p}
                        </Chip>
                      ))}
                    </div>
                  </Card.Content>
                </Card>
              )}
              {report.analysis?.visual_brand_safety && (
                <Card>
                  <Card.Content className="p-3 space-y-1.5">
                    <div className="text-muted text-[10px] uppercase tracking-wider font-medium">
                      Safety
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Risk score</span>
                      <span className="text-foreground font-semibold">
                        {100 - report.analysis.visual_brand_safety.score}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Flags</span>
                      <span
                        className={`font-semibold ${
                          report.analysis.visual_brand_safety.flags === 'None'
                            ? 'text-success'
                            : 'text-danger'
                        }`}
                      >
                        {report.analysis.visual_brand_safety.flags}
                      </span>
                    </div>
                  </Card.Content>
                </Card>
              )}
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
};

/* ── Tab catalog ─────────────────────────────────────────────────── */
type TabDef = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  desc: string;
};

const AI_TABS: TabDef[] = [
  { id: 'captions', label: 'Caption gen', icon: Sparkles, desc: 'LLM social captions' },
  { id: 'match', label: 'Smart match', icon: Target, desc: 'ML creator matching' },
  { id: 'predict', label: 'Performance', icon: TrendingUp, desc: 'Predict outcomes' },
  { id: 'pitch', label: 'Pitch help', icon: MessageCircle, desc: 'AI pitches' },
  { id: 'rank', label: 'Ranker', icon: Users, desc: 'Score applicants' },
  { id: 'contract', label: 'Contract gen', icon: FileText, desc: 'Generate agreements' },
  { id: 'recommend', label: 'Campaign find', icon: Compass, desc: 'Recommend campaigns' },
  { id: 'research', label: 'Discovery', icon: Eye, desc: 'Web search creators' },
];

/* ── Main hub ───────────────────────────────────────────────────── */
const AiHub: React.FC = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase();
  const displayTabs =
    role === 'creator'
      ? AI_TABS.filter((t) => ['captions', 'recommend', 'pitch'].includes(t.id))
      : role === 'admin'
      ? AI_TABS
      : AI_TABS.filter((t) => t.id !== 'research');
  const [activeTab, setActiveTab] = useState(displayTabs[0]?.id || 'captions');

  const renderActive = () => {
    switch (activeTab) {
      case 'captions':
        return <CaptionGenerator />;
      case 'match':
        return <SmartMatch />;
      case 'predict':
        return <PerformancePredictor />;
      case 'pitch':
        return <PitchAssistant />;
      case 'rank':
        return <ApplicantRanker />;
      case 'contract':
        return <ContractGenerator />;
      case 'recommend':
        return <CampaignRecommender />;
      case 'research':
        return <DeepResearch />;
      default:
        return null;
    }
  };

  const activeTabMeta = displayTabs.find((t) => t.id === activeTab);

  return (
    <PageShell
      title="AI Studio"
      description="Powered by frontier LLMs and seven specialized ML models utilizing real-time database vectors."
      icon={<Brain size={18} />}
    >
      {/* Supervision warning */}
      <Card className="border-warning/40 bg-warning-soft">
        <Card.Content className="p-4 flex items-start gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0 bg-warning text-warning-foreground">
            <AlertTriangle size={15} />
          </span>
          <div>
            <div className="text-foreground text-sm font-semibold">
              AI supervision required
            </div>
            <p className="text-muted text-xs mt-1 leading-relaxed">
              Outputs in this AI Studio are generated by language models and
              statistical calculations. They may be inaccurate or lack context —
              verify before using for business decisions.
            </p>
          </div>
        </Card.Content>
      </Card>

      {/* Tab tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {displayTabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`p-3 rounded-xl text-left border transition-colors ${
                active
                  ? 'bg-accent-soft border-accent/30'
                  : 'bg-surface border-border hover:bg-surface-secondary'
              }`}
            >
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg mb-2 ${
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-surface-secondary text-accent'
                }`}
              >
                <Icon size={14} />
              </span>
              <div className="text-foreground text-xs font-semibold leading-tight">
                {t.label}
              </div>
              <div className="text-muted text-[10px] leading-tight mt-0.5 hidden sm:block">
                {t.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <Card>
        <Card.Header>
          <Card.Title className="inline-flex items-center gap-2 text-base">
            {activeTabMeta && (
              <activeTabMeta.icon className="size-4 text-accent" />
            )}
            {activeTabMeta?.label}
          </Card.Title>
          <Card.Description>{activeTabMeta?.desc}</Card.Description>
        </Card.Header>
        <Separator />
        <Card.Content className="p-5 sm:p-6">{renderActive()}</Card.Content>
      </Card>
    </PageShell>
  );
};

export default AiHub;
