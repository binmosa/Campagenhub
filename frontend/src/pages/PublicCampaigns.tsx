import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Check,
  DollarSign,
  Eye,
  FileText,
  Layers,
  MapPin,
  ShieldCheck,
  Star,
  Users,
  Video,
} from 'lucide-react';
import { Button, Card, Chip, Modal } from '@heroui/react';
import { Kanban, Segment } from '@heroui-pro/react';
import { motion } from 'motion/react';
import api from '../lib/api';
import LandingNav from './landing/sections/LandingNav';
import Footer from './landing/sections/Footer';
import { VideoPitchRecorder } from '../components/common/VideoPitchRecorder';
import { PitchModal } from '../components/common/PitchModal';

interface PublicCampaignsProps {
  isDashboard?: boolean;
}

/* ── Platform metadata ─────────────────────────────────────────── */
type PlatformKey =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'twitter'
  | 'twitch'
  | 'linkedin'
  | 'other';

const PLATFORM_ORDER: PlatformKey[] = [
  'tiktok',
  'instagram',
  'youtube',
  'twitter',
  'twitch',
  'linkedin',
  'other',
];

const PLATFORM_LABELS: Record<PlatformKey, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'X / Twitter',
  twitch: 'Twitch',
  linkedin: 'LinkedIn',
  other: 'Other',
};

const PLATFORM_COLORS: Record<PlatformKey, string> = {
  tiktok: '#ff5a5f',
  instagram: '#d6409f',
  youtube: '#ef3a40',
  twitter: '#0b1736',
  twitch: '#7b61ff',
  linkedin: '#4f7cff',
  other: '#6c63ff',
};

const BRAND_COLORS = ['#6c63ff', '#00d4c7', '#4f7cff', '#7b61ff', '#ffb547', '#ff5a5f', '#16c784'];

const normalizePlatform = (p?: string): PlatformKey => {
  if (!p) return 'other';
  const k = p.toLowerCase().trim();
  if (k === 'x' || k === 'twitter') return 'twitter';
  if (PLATFORM_LABELS[k as PlatformKey]) return k as PlatformKey;
  return 'other';
};

const initials = (name?: string) =>
  (name || 'CH').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

const formatBudget = (raw?: number | string) => {
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
};

/* ── Campaign card (used inside Kanban.ColumnBody) ─────────────── */
interface CampaignCardProps {
  camp: any;
  applied: boolean;
  accent: string;
  onApply: () => void;
  onViewContract?: () => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({
  camp,
  applied,
  accent,
  onApply,
  onViewContract,
}) => {
  const brandName =
    camp.brand?.brandProfile?.company_name ||
    camp.brand?.email?.split('@')[0] ||
    'Brand';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
    >
      <div
        style={{
          background: 'var(--color-paper)',
          border: '1px solid var(--color-cool-gray)',
          borderRadius: 18,
          overflow: 'hidden',
          transition: 'border-color 200ms, box-shadow 200ms',
        }}
        className="hover:shadow-lg"
      >
        {/* Cover */}
        <div
          style={{
            position: 'relative',
            height: 120,
            background: camp.cover_image
              ? `url(${camp.cover_image}) center/cover`
              : `linear-gradient(135deg, ${accent}22 0%, ${accent}44 100%)`,
          }}
        >
          {!camp.cover_image && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: accent }}
            >
              <Briefcase size={28} strokeWidth={1.5} />
            </div>
          )}
          {/* Budget pill */}
          <div
            className="absolute"
            style={{
              top: 12,
              right: 12,
              background: 'rgba(11,23,54,0.85)',
              backdropFilter: 'blur(6px)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '-0.012em',
            }}
          >
            {formatBudget(camp.budget)}
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-center gap-2.5 mb-3">
            {camp.brand?.brandProfile?.logo_url ? (
              <img
                src={camp.brand.brandProfile.logo_url}
                alt={brandName}
                className="h-8 w-8 rounded-lg object-cover"
                style={{ border: '1px solid var(--color-cool-gray)' }}
              />
            ) : (
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-medium shrink-0"
                style={{ background: accent, color: '#fff', fontSize: 11 }}
              >
                {initials(brandName)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="v-body v-ink font-medium truncate" style={{ fontSize: 13 }}>
                {brandName}
              </div>
              {camp.brand?.account_status === 'active' && (
                <div className="flex items-center gap-1">
                  <ShieldCheck size={11} style={{ color: 'var(--color-info-blue)' }} />
                  <span className="v-caption v-quiet">Verified</span>
                </div>
              )}
            </div>
          </div>

          <h3
            className="v-ink font-medium"
            style={{
              fontSize: 14,
              lineHeight: 1.35,
              letterSpacing: '-0.014em',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.7em',
            }}
          >
            {camp.title}
          </h3>

          <p
            className="mt-1.5 v-body v-muted"
            style={{
              fontSize: 12.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.6em',
            }}
          >
            {camp.description || ' '}
          </p>

          {/* Requirements chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip variant="soft" size="sm">
              <Users size={11} />
              {camp.requirements?.minFollowers
                ? `${(camp.requirements.minFollowers / 1000).toFixed(0)}k+`
                : 'Any size'}
            </Chip>
            <Chip variant="soft" size="sm">
              <MapPin size={11} />
              {camp.requirements?.location || 'Global'}
            </Chip>
          </div>

          {/* Actions */}
          <div
            className="mt-3 pt-3 flex items-center gap-2"
            style={{ borderTop: '1px solid var(--color-cool-gray)' }}
          >
            {camp.contract_template && onViewContract && (
              <Button
                variant="outline"
                size="sm"
                isIconOnly
                className="!rounded-lg"
                onPress={onViewContract}
                aria-label="View contract"
              >
                <Eye size={14} />
              </Button>
            )}
            {applied ? (
              <Chip color="success" variant="soft" size="sm" className="flex-1 justify-center !py-1.5">
                <Check size={12} /> Applied
              </Chip>
            ) : (
              <Button
                variant="primary"
                size="sm"
                className="!rounded-lg flex-1"
                onPress={onApply}
              >
                Apply
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Component ─────────────────────────────────────────────────── */
const PublicCampaigns: React.FC<PublicCampaignsProps> = ({ isDashboard = false }) => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [pitch, setPitch] = useState('');
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [appliedCampaignIds, setAppliedCampaignIds] = useState<string[]>([]);
  const [viewingContract, setViewingContract] = useState<string | null>(null);
  const [showPitchGenerator, setShowPitchGenerator] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformKey>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'applied'>('all');

  useEffect(() => {
    api.get('/campaigns/active')
      .then((res) => {
        setCampaigns(res.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    if (localStorage.getItem('token') && localStorage.getItem('role') === 'creator') {
      api
        .get('/applications')
        .then((res) => {
          if (Array.isArray(res.data)) {
            setAppliedCampaignIds(res.data.map((app) => app.campaign.id));
          }
        })
        .catch(console.error);
    }
  }, []);

  const handleApplyClick = (camp: any) => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const role = localStorage.getItem('role');
    if (role !== 'creator' && role !== 'manager') {
      alert('Only creators and managers can apply to campaigns.');
      return;
    }
    setSelectedCampaign(camp);
    setPitch('');
    setVideoBase64(null);
    setApplyStatus('idle');
  };

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign) return;
    setApplyStatus('loading');

    try {
      let videoUrl = '';
      if (videoBase64) {
        try {
          const uploadRes = await api.post('/uploads', {
            file: videoBase64,
            filename: `pitch-${Date.now()}.webm`,
          });
          videoUrl = uploadRes.data.url;
          if (uploadRes.data.error) throw new Error(uploadRes.data.error);
        } catch (uploadErr: any) {
          console.error('Upload failed:', uploadErr);
          alert(
            `Video upload failed: ${uploadErr.message || 'The file might be too large'}. You can try applying without a video or recording a shorter one.`
          );
          setApplyStatus('error');
          return;
        }
      }

      await api.post('/applications', {
        campaignId: selectedCampaign.id,
        pitch: pitch,
        videoPitchUrl: videoUrl,
      });
      setApplyStatus('success');
      setPitch('');
      setVideoBase64(null);
      setAppliedCampaignIds((prev) => [...prev, selectedCampaign.id]);
      setTimeout(() => {
        setSelectedCampaign(null);
        setApplyStatus('idle');
      }, 2000);
    } catch (err: any) {
      console.error('Application failed:', err);
      alert(err.response?.data?.message || 'Failed to submit application. Please try again.');
      setApplyStatus('error');
    }
  };

  /* ── Counts by platform / status (drive the Segment labels) ───── */
  const platformCounts = useMemo(() => {
    const acc: Record<PlatformKey, number> = {
      tiktok: 0, instagram: 0, youtube: 0, twitter: 0, twitch: 0, linkedin: 0, other: 0,
    };
    for (const c of campaigns) acc[normalizePlatform(c.platform)]++;
    return acc;
  }, [campaigns]);

  const statusCounts = useMemo(() => {
    const applied = campaigns.filter((c) => appliedCampaignIds.includes(c.id)).length;
    return { all: campaigns.length, open: campaigns.length - applied, applied };
  }, [campaigns, appliedCampaignIds]);

  /* ── Apply filters (platform + status) before grouping ────────── */
  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (
        platformFilter !== 'all' &&
        normalizePlatform(c.platform) !== platformFilter
      ) {
        return false;
      }
      const isApplied = appliedCampaignIds.includes(c.id);
      if (statusFilter === 'open' && isApplied) return false;
      if (statusFilter === 'applied' && !isApplied) return false;
      return true;
    });
  }, [campaigns, platformFilter, statusFilter, appliedCampaignIds]);

  /* ── Group filtered campaigns by platform for Kanban columns ──── */
  const grouped = useMemo(() => {
    const acc: Record<PlatformKey, any[]> = {
      tiktok: [], instagram: [], youtube: [], twitter: [], twitch: [], linkedin: [], other: [],
    };
    for (const c of filtered) {
      const k = normalizePlatform(c.platform);
      acc[k].push(c);
    }
    return acc;
  }, [filtered]);

  const visiblePlatforms = useMemo(
    () => PLATFORM_ORDER.filter((p) => grouped[p].length > 0),
    [grouped]
  );

  /* Platforms that have ANY campaigns (regardless of filter) — these are
   * the choices we surface in the Segment so users don't see empty tabs. */
  const offeredPlatforms = useMemo(
    () => PLATFORM_ORDER.filter((p) => platformCounts[p] > 0),
    [platformCounts]
  );

  const fieldClass = 'w-full px-3.5 py-2.5 rounded-lg v-body v-ink';
  const fieldStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--color-cool-gray)',
    outline: 'none',
  };

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="landing-visitors min-h-screen flex flex-col">
      {!isDashboard && <LandingNav />}

      <main className="flex-1">
        {/* ─── Page header (matches /talent — compact) ─────────────── */}
        <section className="px-6 lg:px-10 pt-10 pb-6">
          <div className="max-w-[1200px] mx-auto text-center">
            <Chip color="success" variant="soft" size="md" className="!mb-4">
              <span
                className="size-1.5 rounded-full bg-success inline-block"
                aria-hidden
              />
              <Chip.Label>Live opportunities</Chip.Label>
            </Chip>
            <h1 className="text-3xl md:text-4xl font-medium text-foreground tracking-tight mb-2">
              Browse open{' '}
              <span className="bg-gradient-to-r from-accent to-accent bg-clip-text text-transparent">
                campaigns
              </span>
            </h1>
            <p className="text-muted text-base max-w-2xl mx-auto">
              Real briefs from real brands. Pay on delivery, apply in seconds.
            </p>
          </div>
        </section>

        {/* ─── Kanban board ──────────────────────────────────────── */}
        <section className="relative px-6 lg:px-10 pb-24">
          {/* Subtle gradient band underneath the board */}
          <div
            className="absolute inset-x-0 top-0 h-[200px] pointer-events-none -z-10"
            style={{
              background:
                'linear-gradient(180deg, rgba(244,242,255,0.6) 0%, transparent 100%)',
            }}
            aria-hidden
          />

          <div className="max-w-[1300px] mx-auto">
            {/* ─── Filter toolbar (Platform + Status) ─────────────── */}
            {!loading && campaigns.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <Segment
                  selectedKey={platformFilter}
                  onSelectionChange={(k) =>
                    setPlatformFilter(k as 'all' | PlatformKey)
                  }
                >
                  <Segment.Item id="all">
                    All · {campaigns.length}
                  </Segment.Item>
                  {offeredPlatforms.map((p) => (
                    <Segment.Item key={p} id={p}>
                      {PLATFORM_LABELS[p]} · {platformCounts[p]}
                    </Segment.Item>
                  ))}
                </Segment>
                <Segment
                  selectedKey={statusFilter}
                  onSelectionChange={(k) =>
                    setStatusFilter(k as 'all' | 'open' | 'applied')
                  }
                >
                  <Segment.Item id="all">All · {statusCounts.all}</Segment.Item>
                  <Segment.Item id="open">
                    Open · {statusCounts.open}
                  </Segment.Item>
                  <Segment.Item id="applied">
                    Applied · {statusCounts.applied}
                  </Segment.Item>
                </Segment>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-20">
                <div
                  className="h-10 w-10 rounded-full animate-spin"
                  style={{
                    border: '3px solid var(--color-cool-gray)',
                    borderTopColor: 'var(--color-campaign-purple)',
                  }}
                />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="v-card max-w-md mx-auto text-center" style={{ padding: 48 }}>
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                  style={{ background: 'var(--color-soft-lavender)', color: 'var(--color-campaign-purple)' }}
                >
                  <Layers size={20} strokeWidth={1.5} />
                </span>
                <h3 className="v-heading-lg">No Active Campaigns</h3>
                <p className="mt-2 v-body-lg v-muted">
                  Check back later for new exclusive brand opportunities.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="v-card max-w-md mx-auto text-center" style={{ padding: 48 }}>
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                  style={{ background: 'var(--color-soft-lavender)', color: 'var(--color-campaign-purple)' }}
                >
                  <Layers size={20} strokeWidth={1.5} />
                </span>
                <h3 className="v-heading-lg">No matching campaigns</h3>
                <p className="mt-2 v-body-lg v-muted">
                  Try widening your platform or status filter.
                </p>
                <Button
                  variant="ghost"
                  size="md"
                  className="!mt-4"
                  onPress={() => {
                    setPlatformFilter('all');
                    setStatusFilter('all');
                  }}
                >
                  Reset filters
                </Button>
              </div>
            ) : (
              <Kanban>
                {visiblePlatforms.map((p) => {
                  const list = grouped[p];
                  const color = PLATFORM_COLORS[p];
                  return (
                    <Kanban.Column key={p}>
                      <Kanban.ColumnHeader>
                        <Kanban.ColumnIndicator style={{ background: color }} />
                        <Kanban.ColumnTitle>{PLATFORM_LABELS[p]}</Kanban.ColumnTitle>
                        <Kanban.ColumnCount>{list.length}</Kanban.ColumnCount>
                      </Kanban.ColumnHeader>
                      <Kanban.ColumnBody>
                        <div className="flex flex-col gap-3">
                          {list.map((camp, i) => (
                            <CampaignCard
                              key={camp.id}
                              camp={camp}
                              applied={appliedCampaignIds.includes(camp.id)}
                              accent={BRAND_COLORS[i % BRAND_COLORS.length]}
                              onApply={() => handleApplyClick(camp)}
                              onViewContract={
                                camp.contract_template
                                  ? () => setViewingContract(camp.contract_template)
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </Kanban.ColumnBody>
                    </Kanban.Column>
                  );
                })}
              </Kanban>
            )}
          </div>
        </section>
      </main>

      {!isDashboard && <Footer />}

      {/* ─── Application modal ───────────────────────────────────── */}
      <Modal isOpen={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Apply for Campaign</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {selectedCampaign && (
                <div className="space-y-5">
                  <p className="v-body v-muted">
                    Submit your application to{' '}
                    <span className="v-ink font-medium">{selectedCampaign.title}</span>.
                  </p>

                  {/* Payout pill */}
                  <div
                    className="flex items-center justify-between rounded-xl p-4"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(22,199,132,0.10) 0%, rgba(0,212,199,0.12) 100%)',
                      border: '1px solid rgba(22,199,132,0.20)',
                    }}
                  >
                    <span
                      className="v-body font-medium flex items-center gap-2"
                      style={{ color: '#0b6e3e' }}
                    >
                      <DollarSign size={16} /> Base Payout
                    </span>
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: '#0b6e3e', fontSize: 22, letterSpacing: '-0.018em' }}
                    >
                      ${Number(selectedCampaign.budget).toLocaleString()}
                    </span>
                  </div>

                  {selectedCampaign.contract_template && (
                    <div
                      className="rounded-xl p-4 max-h-40 overflow-y-auto"
                      style={{
                        background: 'rgba(244,242,255,0.5)',
                        border: '1px solid var(--color-cool-gray)',
                      }}
                    >
                      <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Briefcase size={11} /> Contract Terms
                      </div>
                      <div className="v-body v-ink whitespace-pre-wrap" style={{ fontSize: 13, lineHeight: 1.55 }}>
                        {selectedCampaign.contract_template}
                      </div>
                    </div>
                  )}

                  <form id="campaign-apply-form" onSubmit={submitApplication} className="space-y-5">
                    <div>
                      <label className="v-caption v-quiet font-medium uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Video size={12} style={{ color: 'var(--color-campaign-purple)' }} />
                        Video pitch (recommended)
                      </label>
                      <VideoPitchRecorder
                        onRecordingComplete={(b64) => setVideoBase64(b64)}
                        maxDuration={60}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="v-caption v-quiet font-medium uppercase tracking-wider flex items-center gap-1.5">
                          <Layers size={12} /> Written pitch (optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowPitchGenerator(true)}
                          className="v-caption font-medium flex items-center gap-1"
                          style={{ color: 'var(--color-campaign-purple)' }}
                        >
                          <Star size={11} fill="currentColor" /> AI pitch gen
                        </button>
                      </div>
                      <textarea
                        value={pitch}
                        onChange={(e) => setPitch(e.target.value)}
                        placeholder="Tell the brand why they should choose you…"
                        className={`${fieldClass} resize-none h-24`}
                        style={fieldStyle}
                      />
                    </div>
                  </form>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={() => setSelectedCampaign(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="campaign-apply-form"
                isPending={applyStatus === 'loading'}
                isDisabled={applyStatus === 'success'}
              >
                {applyStatus === 'success' ? (
                  <>
                    <Check size={14} /> Sent
                  </>
                ) : (
                  'Confirm & send'
                )}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {showPitchGenerator && selectedCampaign && (
        <PitchModal
          onClose={() => setShowPitchGenerator(false)}
          defaultCampaignName={selectedCampaign.title}
        />
      )}

      {/* ─── Contract modal ──────────────────────────────────────── */}
      <Modal isOpen={!!viewingContract} onOpenChange={(open) => !open && setViewingContract(null)}>
        <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <FileText size={18} style={{ color: 'var(--color-campaign-purple)' }} />
                Contract Terms
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div
                className="v-body v-ink whitespace-pre-wrap rounded-xl p-5"
                style={{
                  background: 'rgba(244,242,255,0.5)',
                  border: '1px solid var(--color-cool-gray)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  maxHeight: '60vh',
                  overflow: 'auto',
                }}
              >
                {viewingContract}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="primary" onPress={() => setViewingContract(null)}>
                Close
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
};

export default PublicCampaigns;
