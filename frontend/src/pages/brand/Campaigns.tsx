import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  Check,
  Clock,
  Eye,
  EyeOff,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  AlertDialog,
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  Modal,
  Switch,
  TextField,
  TextArea,
} from '@heroui/react';
import {
  EmptyState,
  KPI,
  RadioButtonGroup,
  Segment,
} from '@heroui-pro/react';
import { Input } from 'react-aria-components';
import api, { serverOrigin } from '../../lib/api';
import { PageShell } from '../../components/ui';

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Twitter', 'Twitch'];
const CAMPAIGN_CURRENCIES = ['USD', 'ETB', 'NGN', 'KES', 'GHS', 'EUR', 'GBP'];
const CONTENT_TYPES = ['Photo', 'Video', 'Story', 'Reel', 'Blog', 'Live'];
const OBJECTIVES = ['Awareness', 'Engagement', 'Conversions', 'Content'];

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

const EMPTY_CAMPAIGN = {
  title: '',
  description: '',
  budget: '',
  currency: 'USD',
  platform: 'Instagram',
  target_audience: '',
  deadline: '',
  content_type: 'Photo',
  objective: 'Awareness',
  cover_image: '',
  contract_template: '',
  post_to_telegram: false,
};

type Campaign = {
  id: string;
  title: string;
  description?: string;
  status: string;
  budget?: number | string;
  platform?: string;
  content_type?: string;
  objective?: string;
  target_audience?: string;
  cover_image?: string;
  contract_template?: string;
  post_to_telegram?: boolean;
  deadline?: string;
  created_at?: string;
};

type Application = {
  id: string;
  status: string;
  pitch?: string;
  created_at?: string;
  creator?: {
    email?: string;
    creatorProfile?: { avatar_url?: string };
  };
  campaign?: { id: string };
};

/* ── Create / edit campaign modal ────────────────────────────────── */
const CampaignFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Campaign | null;
}> = ({ isOpen, onClose, onSaved, editing }) => {
  const [form, setForm] = useState({ ...EMPTY_CAMPAIGN });
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [generatingContract, setGeneratingContract] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setForm({
          title: editing.title || '',
          description: editing.description || '',
          budget: editing.budget?.toString() || '',
          currency: (editing as any).currency || 'USD',
          platform: editing.platform || 'Instagram',
          target_audience: editing.target_audience || '',
          deadline: editing.deadline
            ? new Date(editing.deadline).toISOString().split('T')[0]
            : '',
          content_type: editing.content_type || 'Photo',
          objective: editing.objective || 'Awareness',
          cover_image: editing.cover_image || '',
          contract_template: editing.contract_template || '',
          post_to_telegram: editing.post_to_telegram || false,
        });
      } else {
        setForm({ ...EMPTY_CAMPAIGN });
      }
      setStatus('idle');
    }
  }, [isOpen, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const payload = { ...form, budget: Number(form.budget) };
      if (editing) {
        await api.patch(`/campaigns/${editing.id}`, payload);
      } else {
        await api.post('/campaigns', payload);
      }
      setStatus('success');
      onSaved();
      setTimeout(() => {
        setStatus('idle');
        onClose();
      }, 800);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog className="!max-w-3xl">
          <Modal.Header>
            <Modal.Heading className="inline-flex items-center gap-2">
              <Plus size={16} className="text-accent" />
              {editing ? 'Edit campaign' : 'New campaign'}
            </Modal.Heading>
          </Modal.Header>
          <form id="campaign-form" onSubmit={submit}>
            <Modal.Body>
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    value={form.title}
                    onChange={(v) => setForm({ ...form, title: v })}
                    isRequired
                    aria-label="Campaign title"
                  >
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Campaign title *
                    </Label>
                    <Input
                      className={fieldClass}
                      placeholder="e.g. Summer launch"
                    />
                  </TextField>
                  <div>
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Platforms
                    </Label>
                    {/* Multi-target: stored comma-joined in the `platform`
                        field ("TikTok, Instagram") — the backend and the
                        public platform filter both understand this shape. */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {PLATFORMS.map((p) => {
                        const selected = form.platform
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const active = selected.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              const next = active
                                ? selected.filter((s) => s !== p)
                                : [...selected, p];
                              setForm({ ...form, platform: next.join(', ') });
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              active
                                ? 'bg-accent border-accent text-accent-foreground'
                                : 'bg-surface border-border text-foreground hover:border-accent/40'
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-muted text-[11px] mt-1.5">
                      Pick every platform this campaign targets.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <TextField
                    value={form.budget}
                    onChange={(v) => setForm({ ...form, budget: v })}
                    isRequired
                    aria-label="Budget"
                  >
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Budget *
                    </Label>
                    <div className="flex gap-2">
                      <select
                        value={form.currency}
                        onChange={(e) => setForm({ ...form, currency: e.target.value })}
                        className={`${fieldClass} !w-24 shrink-0`}
                        aria-label="Currency"
                      >
                        {CAMPAIGN_CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <Input
                        className={fieldClass}
                        type="number"
                        min="0"
                        placeholder="5000"
                      />
                    </div>
                  </TextField>
                  <TextField
                    value={form.target_audience}
                    onChange={(v) =>
                      setForm({ ...form, target_audience: v })
                    }
                    aria-label="Target audience"
                  >
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Target audience
                    </Label>
                    <Input
                      className={fieldClass}
                      placeholder="Tech enthusiasts"
                    />
                  </TextField>
                  <TextField
                    value={form.deadline}
                    onChange={(v) => setForm({ ...form, deadline: v })}
                    aria-label="Deadline"
                  >
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Deadline
                    </Label>
                    <Input className={fieldClass} type="date" />
                  </TextField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Content type
                    </Label>
                    <RadioButtonGroup
                      aria-label="Content type"
                      value={form.content_type}
                      onChange={(v) =>
                        setForm({ ...form, content_type: v as string })
                      }
                      layout="flex"
                    >
                      {CONTENT_TYPES.map((ct) => (
                        <RadioButtonGroup.Item key={ct} value={ct}>
                          <RadioButtonGroup.ItemContent>
                            {ct}
                          </RadioButtonGroup.ItemContent>
                          <RadioButtonGroup.Indicator />
                        </RadioButtonGroup.Item>
                      ))}
                    </RadioButtonGroup>
                  </div>
                  <div>
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Objective
                    </Label>
                    <RadioButtonGroup
                      aria-label="Objective"
                      value={form.objective}
                      onChange={(v) =>
                        setForm({ ...form, objective: v as string })
                      }
                      layout="flex"
                    >
                      {OBJECTIVES.map((o) => (
                        <RadioButtonGroup.Item key={o} value={o}>
                          <RadioButtonGroup.ItemContent>
                            {o}
                          </RadioButtonGroup.ItemContent>
                          <RadioButtonGroup.Indicator />
                        </RadioButtonGroup.Item>
                      ))}
                    </RadioButtonGroup>
                  </div>
                </div>

                <div>
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Requirements & description *
                  </Label>
                  <TextArea
                    value={form.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="Detail exactly what you expect from creators: deliverables, tone, style, usage rights…"
                    rows={5}
                    className={`${fieldClass} resize-none`}
                  />
                </div>

                {/* Cover image */}
                <div>
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                    <Upload size={11} /> Campaign cover image
                  </Label>
                  {form.cover_image ? (
                    <div className="relative">
                      <img
                        src={form.cover_image}
                        alt="Cover"
                        className="w-full h-40 object-cover rounded-xl border border-border"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        aria-label="Remove cover"
                        className="!absolute top-2 right-2 !bg-surface/80 backdrop-blur-sm"
                        onPress={() =>
                          setForm({ ...form, cover_image: '' })
                        }
                      >
                        <X size={13} />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl bg-surface-secondary hover:bg-surface cursor-pointer transition-colors">
                      <Upload size={22} className="text-muted mb-2" />
                      <span className="text-foreground text-sm font-medium">
                        Click to upload
                      </span>
                      <span className="text-muted text-xs mt-1">
                        PNG, JPG up to 5MB
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () =>
                              setForm({
                                ...form,
                                cover_image: reader.result as string,
                              });
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Telegram broadcast toggle */}
                <Card className="bg-surface-secondary">
                  <Card.Content className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-foreground text-sm font-semibold">
                        Broadcast to Telegram bot
                      </p>
                      <p className="text-muted text-xs mt-0.5">
                        Push this opportunity to matching creators in the
                        CampaignHub bot network.
                      </p>
                    </div>
                    <Switch
                      isSelected={form.post_to_telegram}
                      onChange={(v) =>
                        setForm({ ...form, post_to_telegram: v })
                      }
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                  </Card.Content>
                </Card>

                {/* Contract template */}
                <div>
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                    <FileText size={11} /> Campaign contract
                  </Label>
                  <p className="text-muted text-xs mb-2">
                    Write the contract terms or generate one with AI.
                  </p>
                  <TextArea
                    value={form.contract_template}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setForm({ ...form, contract_template: e.target.value })
                    }
                    placeholder="Enter contract terms, or click 'Generate' below…"
                    rows={6}
                    className={`${fieldClass} font-mono text-xs resize-none`}
                  />
                  <div className="mt-2">
                    <Button
                      variant="tertiary"
                      size="sm"
                      isPending={generatingContract}
                      isDisabled={!form.title.trim()}
                      onPress={async () => {
                        setGeneratingContract(true);
                        try {
                          const res = await api.post('/ai/contract', {
                            brandName: 'Your Brand',
                            creatorName: '[Creator Name]',
                            campaignTitle: form.title,
                            deliverables: form.description,
                            budget: Number(form.budget) || 0,
                            deadline: form.deadline,
                            platform: form.platform,
                          });
                          setForm({
                            ...form,
                            contract_template: res.data.contract || '',
                          });
                        } catch {
                          alert('AI contract generation failed.');
                        } finally {
                          setGeneratingContract(false);
                        }
                      }}
                    >
                      <Sparkles size={13} /> Generate with AI
                    </Button>
                  </div>
                </div>
              </div>
            </Modal.Body>
          </form>
          <Modal.Footer>
            {status === 'success' && (
              <Chip color="success" variant="soft" size="md">
                <Check size={13} />
                <Chip.Label>Saved</Chip.Label>
              </Chip>
            )}
            <Button variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="campaign-form"
              variant="primary"
              isPending={status === 'loading'}
            >
              {editing ? 'Update campaign' : 'Deploy campaign'}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Applications viewer modal ────────────────────────────────── */
const ApplicationsModal: React.FC<{
  campaign: Campaign;
  applications: Application[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (appId: string, status: string) => void;
}> = ({ campaign, applications, isOpen, onClose, onUpdate }) => {
  const apps = applications.filter((a) => a.campaign?.id === campaign.id);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog className="!max-w-3xl">
          <Modal.Header>
            <div>
              <Modal.Heading>Applications</Modal.Heading>
              <p className="text-muted text-xs mt-0.5">{campaign.title}</p>
            </div>
          </Modal.Header>
          <Modal.Body>
            {apps.length === 0 ? (
              <div className="py-8">
                <EmptyState>
                  <EmptyState.Media>
                    <Users className="size-7" />
                  </EmptyState.Media>
                  <EmptyState.Title>No applications yet</EmptyState.Title>
                  <EmptyState.Description>
                    Creators haven't applied to this campaign.
                  </EmptyState.Description>
                </EmptyState>
              </div>
            ) : (
              <div className="space-y-3">
                {apps.map((app) => {
                  const initial = (app.creator?.email || 'C')[0].toUpperCase();
                  return (
                    <Card key={app.id}>
                      <Card.Content className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <Avatar size="md">
                            {app.creator?.creatorProfile?.avatar_url && (
                              <Avatar.Image
                                src={app.creator.creatorProfile.avatar_url}
                                alt={app.creator?.email}
                              />
                            )}
                            <Avatar.Fallback>{initial}</Avatar.Fallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="text-foreground text-sm font-semibold truncate">
                              {app.creator?.email}
                            </div>
                            <div className="text-muted text-xs">
                              Applied{' '}
                              {app.created_at
                                ? new Date(
                                    app.created_at
                                  ).toLocaleDateString()
                                : '—'}
                            </div>
                          </div>
                          <Chip
                            color={
                              app.status === 'accepted'
                                ? 'success'
                                : app.status === 'rejected'
                                ? 'danger'
                                : app.status === 'refunded'
                                ? 'warning'
                                : 'default'
                            }
                            variant="soft"
                            size="sm"
                          >
                            <Chip.Label className="capitalize">
                              {app.status}
                            </Chip.Label>
                          </Chip>
                        </div>
                        <Card className="bg-surface-secondary">
                          <Card.Content className="p-3 text-sm text-foreground leading-relaxed">
                            <p className="text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 inline-flex items-center gap-1.5">
                              <MessageSquare size={11} /> Pitch
                            </p>
                            {app.pitch || (
                              <span className="italic text-muted">
                                No pitch provided.
                              </span>
                            )}
                          </Card.Content>
                        </Card>

                        {app.status === 'pending' && (
                          <div className="flex items-center gap-2 mt-3">
                            <Button
                              variant="primary"
                              size="sm"
                              onPress={() => onUpdate(app.id, 'accepted')}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="!text-danger"
                              onPress={() => onUpdate(app.id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        {app.status === 'accepted' && (
                          <div className="mt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="!text-warning"
                              onPress={() => {
                                if (
                                  window.confirm(
                                    'Refund this creator?'
                                  )
                                )
                                  onUpdate(app.id, 'refunded');
                              }}
                            >
                              Refund
                            </Button>
                          </div>
                        )}
                      </Card.Content>
                    </Card>
                  );
                })}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={onClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Campaign card ─────────────────────────────────────────────── */
const CampaignCard: React.FC<{
  campaign: Campaign;
  applications: Application[];
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}> = ({ campaign, applications, onView, onEdit, onDelete, onToggle }) => {
  const apps = applications.filter((a) => a.campaign?.id === campaign.id);
  const acceptedCount = apps.filter((a) => a.status === 'accepted').length;
  const pendingCount = apps.filter((a) => a.status === 'pending').length;
  const fillRate =
    apps.length > 0
      ? Math.round((acceptedCount / Math.max(apps.length, 1)) * 100)
      : 0;
  const coverSrc = campaign.cover_image
    ? campaign.cover_image.startsWith('http') ||
      campaign.cover_image.startsWith('data:')
      ? campaign.cover_image
      : `${serverOrigin}${campaign.cover_image}`
    : '';

  return (
    <Card className="group relative flex flex-col overflow-hidden">
      {/* Publish/Unpublish (top-right overlay) */}
      <div className="absolute top-3 right-3 z-10">
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label={
            campaign.status === 'active' ? 'Unpublish' : 'Publish'
          }
          className="!bg-surface/80 backdrop-blur-sm"
          onPress={onToggle}
        >
          {campaign.status === 'active' ? (
            <EyeOff size={14} />
          ) : (
            <Eye size={14} />
          )}
        </Button>
      </div>

      {/* Cover image */}
      {coverSrc ? (
        <div className="h-32 w-full overflow-hidden bg-surface-secondary">
          <img
            src={coverSrc}
            alt={campaign.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="h-12 w-full bg-surface-secondary" />
      )}

      <Card.Content className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex items-start justify-between gap-2">
          <Chip
            color={campaign.status === 'active' ? 'success' : 'default'}
            variant="soft"
            size="sm"
          >
            <Chip.Label className="capitalize">
              {campaign.status === 'active' ? '● Live' : campaign.status}
            </Chip.Label>
          </Chip>
          <span className="text-foreground font-semibold tabular-nums">
            ${Number(campaign.budget || 0).toLocaleString()}
          </span>
        </div>

        <h3 className="text-foreground text-base font-semibold line-clamp-1">
          {campaign.title}
        </h3>
        <p className="text-muted text-xs line-clamp-2">
          {campaign.description}
        </p>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface-secondary rounded-lg p-2 text-center">
            <div className="text-foreground text-sm font-semibold tabular-nums">
              {apps.length}
            </div>
            <div className="text-muted text-[10px] font-medium uppercase">
              Applied
            </div>
          </div>
          <div className="bg-accent-soft rounded-lg p-2 text-center">
            <div className="text-accent-soft-foreground text-sm font-semibold tabular-nums">
              {acceptedCount}
            </div>
            <div className="text-muted text-[10px] font-medium uppercase">
              Accepted
            </div>
          </div>
          <div className="bg-warning-soft rounded-lg p-2 text-center">
            <div className="text-warning-soft-foreground text-sm font-semibold tabular-nums">
              {pendingCount}
            </div>
            <div className="text-muted text-[10px] font-medium uppercase">
              Pending
            </div>
          </div>
        </div>

        {/* Acceptance rate bar */}
        <div>
          <div className="flex justify-between text-muted text-[10px] font-medium uppercase mb-1">
            <span>Acceptance rate</span>
            <span className="text-accent">{fillRate}%</span>
          </div>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${fillRate}%` }}
            />
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-muted text-xs flex-wrap mt-auto">
          <span className="inline-flex items-center gap-1">
            <Target size={11} /> {campaign.platform}
          </span>
          {campaign.created_at && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} />{' '}
              {new Date(campaign.created_at).toLocaleDateString()}
            </span>
          )}
          {campaign.deadline && (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> Due{' '}
              {new Date(campaign.deadline).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Per-card action toolbar — hidden until hover on desktop, always on mobile.
           Anchored inside the Card.Content so it's clearly tied to THIS card. */}
        <div
          aria-label={`Actions for ${campaign.title}`}
          role="toolbar"
          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-150 flex items-center gap-1 rounded-full bg-overlay shadow-overlay border border-border px-2 py-1 self-center"
        >
          <Button
            aria-label="View applications"
            size="sm"
            variant="ghost"
            onPress={onView}
          >
            <Eye size={13} />
            <span className="hidden sm:inline">View</span>
          </Button>
          <Button
            aria-label="Edit campaign"
            size="sm"
            variant="ghost"
            onPress={onEdit}
          >
            <Pencil size={13} />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          <Button
            aria-label="Delete campaign"
            className="!text-danger !bg-danger/10"
            size="sm"
            variant="ghost"
            onPress={onDelete}
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
};

/* ── Main page ─────────────────────────────────────────────────── */
const BrandCampaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [viewingAppsFor, setViewingAppsFor] = useState<Campaign | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campsRes, appsRes] = await Promise.all([
        api.get('/campaigns/brand'),
        api.get('/applications'),
      ]);
      setCampaigns(campsRes.data || []);
      setApplications(appsRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateApp = async (appId: string, newStatus: string) => {
    try {
      await api.patch(`/applications/${appId}/status`, { status: newStatus });
      fetchData();
    } catch {
      alert('Failed to update status');
    }
  };

  const handleToggle = async (camp: Campaign) => {
    const newStatus = camp.status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/campaigns/${camp.id}`, { status: newStatus });
      fetchData();
    } catch {
      alert('Failed to update campaign status');
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/campaigns/${pendingDelete.id}`);
      setPendingDelete(null);
      fetchData();
    } catch {
      alert('Failed to delete campaign.');
    } finally {
      setDeleting(false);
    }
  };

  const counts = useMemo(
    () => ({
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === 'active').length,
      inactive: campaigns.filter((c) => c.status !== 'active').length,
      applicants: applications.length,
      budget: campaigns.reduce((s, c) => s + Number(c.budget || 0), 0),
    }),
    [campaigns, applications]
  );

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return campaigns;
    if (statusFilter === 'active')
      return campaigns.filter((c) => c.status === 'active');
    return campaigns.filter((c) => c.status !== 'active');
  }, [campaigns, statusFilter]);

  return (
    <PageShell
      title="Your campaigns"
      description="Create, manage, and track your campaigns."
      icon={<Briefcase size={18} />}
      actions={
        <Button
          variant="primary"
          size="md"
          onPress={() => {
            setEditingCampaign(null);
            setShowForm(true);
          }}
        >
          <Plus size={14} /> New campaign
        </Button>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI>
          <KPI.Header>
            <KPI.Title>Total</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={counts.total} maximumFractionDigits={0} />
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Active</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={counts.active} maximumFractionDigits={0} />
            <KPI.Trend trend={counts.active > 0 ? 'up' : 'neutral'}>
              Live
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Applicants</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={counts.applicants} maximumFractionDigits={0} />
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Total budget</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value
              value={counts.budget}
              style="currency"
              currency="USD"
              notation="compact"
              maximumFractionDigits={1}
            />
          </KPI.Content>
        </KPI>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Segment
          selectedKey={statusFilter}
          onSelectionChange={(k) => setStatusFilter(k as typeof statusFilter)}
        >
          <Segment.Item id="all">All · {counts.total}</Segment.Item>
          <Segment.Item id="active">Active · {counts.active}</Segment.Item>
          <Segment.Item id="inactive">
            Inactive · {counts.inactive}
          </Segment.Item>
        </Segment>
      </div>

      {/* Campaigns grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <Card.Content className="p-8">
            <EmptyState>
              <EmptyState.Media>
                <Briefcase className="size-7" />
              </EmptyState.Media>
              <EmptyState.Title>No campaigns yet</EmptyState.Title>
              <EmptyState.Description>
                Create your first campaign to start receiving applications.
              </EmptyState.Description>
              <EmptyState.Content>
                <Button
                  variant="primary"
                  size="md"
                  onPress={() => {
                    setEditingCampaign(null);
                    setShowForm(true);
                  }}
                >
                  <Plus size={14} /> Create first campaign
                </Button>
              </EmptyState.Content>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((camp) => (
            <CampaignCard
              key={camp.id}
              campaign={camp}
              applications={applications}
              onView={() => setViewingAppsFor(camp)}
              onEdit={() => {
                setEditingCampaign(camp);
                setShowForm(true);
              }}
              onDelete={() => setPendingDelete(camp)}
              onToggle={() => handleToggle(camp)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        isOpen={!!pendingDelete}
        onOpenChange={(open) =>
          !open && !deleting && setPendingDelete(null)
        }
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger">
                  <AlertTriangle size={18} />
                </AlertDialog.Icon>
                <AlertDialog.Heading>
                  Delete this campaign?
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                This action cannot be undone. All applications associated with{' '}
                <strong>{pendingDelete?.title}</strong> will be removed.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  variant="ghost"
                  isDisabled={deleting}
                  onPress={() => setPendingDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  isPending={deleting}
                  onPress={handleConfirmDelete}
                >
                  <Trash2 size={13} /> Delete
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      {/* Modals */}
      <CampaignFormModal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingCampaign(null);
        }}
        onSaved={fetchData}
        editing={editingCampaign}
      />
      {viewingAppsFor && (
        <ApplicationsModal
          campaign={viewingAppsFor}
          applications={applications}
          isOpen={!!viewingAppsFor}
          onClose={() => setViewingAppsFor(null)}
          onUpdate={handleUpdateApp}
        />
      )}
    </PageShell>
  );
};

export default BrandCampaigns;
