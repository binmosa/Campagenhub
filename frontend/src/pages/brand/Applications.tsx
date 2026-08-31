import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  MessageSquare,
  Users,
  X,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  Modal,
  Separator,
  TextField,
  TextArea,
} from '@heroui/react';
import { EmptyState, KPI, RadioButtonGroup, Segment } from '@heroui-pro/react';
import { Input } from 'react-aria-components';
import api, { serverOrigin } from '../../lib/api';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { ContractManager } from '../../components/contracts/ContractManager';
import { PageShell } from '../../components/ui';

const CURRENCIES = ['NGN', 'USD', 'KES', 'GHS', 'ZAR', 'UGX', 'EUR', 'GBP'];
const FREQUENCIES = ['monthly', 'quarterly', 'yearly'];

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  accepted: 'success',
  pending: 'warning',
  rejected: 'danger',
  refunded: 'warning',
};

/* ── Payment Schedule Modal ────────────────────────────────────── */
const PaymentScheduleModal: React.FC<{
  app: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}> = ({ app, isOpen, onClose, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [frequency, setFrequency] = useState('monthly');
  const [paymentDay, setPaymentDay] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      setMsg({ type: 'error', text: 'Enter a valid payment amount' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.patch(`/applications/${app.id}/status`, { status: 'accepted' });
      await api.patch(`/applications/${app.id}/payment-schedule`, {
        payment_amount: Number(amount),
        currency,
        payment_frequency: frequency,
        payment_day: Number(paymentDay),
        notes,
      });
      setMsg({
        type: 'success',
        text: 'Agreement created. Payment schedule saved.',
      });
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1200);
    } catch {
      setMsg({
        type: 'error',
        text: 'Could not save agreement. Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const creatorName =
    app.creator?.creatorProfile?.full_name ||
    app.creator?.email?.split('@')[0] ||
    'Creator';

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading className="inline-flex items-center gap-2">
              <CheckCircle size={16} className="text-accent" /> Set payment
              schedule
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted text-sm mb-4">
              With{' '}
              <span className="text-foreground font-semibold">
                {creatorName}
              </span>
            </p>

            <Card className="bg-success-soft border-success/40 mb-4">
              <Card.Content className="p-3 flex items-start gap-2 text-xs font-medium text-success-soft-foreground">
                <CheckCircle size={13} className="mt-0.5 shrink-0" />
                <p>
                  Accepting creates a digital agreement. No immediate payment is
                  charged — manage payments from{' '}
                  <strong>My Team</strong> any time.
                </p>
              </Card.Content>
            </Card>

            <div className="space-y-4">
              {/* Amount + Currency */}
              <div>
                <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Payment amount
                </Label>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={`${fieldClass} w-24`}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <TextField
                    value={amount}
                    onChange={setAmount}
                    className="flex-1"
                    aria-label="Amount"
                  >
                    <Input
                      className={fieldClass}
                      type="number"
                      placeholder="e.g. 150000"
                    />
                  </TextField>
                </div>
              </div>

              {/* Frequency */}
              <div>
                <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Payment frequency
                </Label>
                <RadioButtonGroup
                  aria-label="Frequency"
                  value={frequency}
                  onChange={(v) => setFrequency(v as string)}
                  layout="flex"
                >
                  {FREQUENCIES.map((f) => (
                    <RadioButtonGroup.Item key={f} value={f}>
                      <RadioButtonGroup.ItemContent>
                        <span className="capitalize">{f}</span>
                      </RadioButtonGroup.ItemContent>
                      <RadioButtonGroup.Indicator />
                    </RadioButtonGroup.Item>
                  ))}
                </RadioButtonGroup>
              </div>

              {/* Payment Day */}
              <div>
                <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                  <Calendar size={11} /> Payment day (of{' '}
                  {frequency === 'yearly'
                    ? 'year'
                    : frequency === 'quarterly'
                    ? 'quarter'
                    : 'month'}
                  )
                </Label>
                <select
                  value={paymentDay}
                  onChange={(e) => setPaymentDay(e.target.value)}
                  className={fieldClass}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Day {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Agreement notes (optional)
                </Label>
                <TextArea
                  value={notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setNotes(e.target.value)
                  }
                  placeholder="Deliverables, milestones, or other terms…"
                  rows={3}
                  className={`${fieldClass} resize-none`}
                />
              </div>

              {msg && (
                <Card
                  className={
                    msg.type === 'success'
                      ? 'bg-success-soft border-success/40'
                      : 'bg-danger-soft border-danger/40'
                  }
                >
                  <Card.Content className="p-3 flex items-center gap-2 text-sm font-medium">
                    {msg.type === 'success' ? (
                      <CheckCircle size={13} />
                    ) : (
                      <AlertCircle size={13} />
                    )}{' '}
                    {msg.text}
                  </Card.Content>
                </Card>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isPending={saving}
              onPress={handleSave}
            >
              <CheckCircle size={13} /> Accept & create agreement
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Review deliverables modal ─────────────────────────────────── */
const ReviewModal: React.FC<{
  app: any;
  submissions: any[];
  isOpen: boolean;
  onClose: () => void;
}> = ({ app, submissions, isOpen, onClose }) => (
  <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
    <Modal.Backdrop>
    <Modal.Container>
      <Modal.Dialog>
        <Modal.Header>
          <Modal.Heading>Review deliverables</Modal.Heading>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted text-sm mb-4">
            Content submitted by{' '}
            {app.creator?.creatorProfile?.full_name || 'the creator'}.
          </p>
          {submissions.length === 0 ? (
            <Card className="bg-surface-secondary">
              <Card.Content className="p-6">
                <EmptyState>
                  <EmptyState.Media>
                    <Clock className="size-7" />
                  </EmptyState.Media>
                  <EmptyState.Title>No deliverables yet</EmptyState.Title>
                  <EmptyState.Description>
                    Nothing has been submitted for review.
                  </EmptyState.Description>
                </EmptyState>
              </Card.Content>
            </Card>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {submissions.map((sub: any) => (
                <Card key={sub.id}>
                  <Card.Content className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-muted text-xs font-medium uppercase">
                        Submitted link
                      </span>
                      <Chip
                        color={
                          sub.ai_verification_status === 'verified'
                            ? 'success'
                            : 'warning'
                        }
                        variant="soft"
                        size="sm"
                      >
                        <Chip.Label>
                          AI {sub.ai_verification_status}
                        </Chip.Label>
                      </Chip>
                    </div>
                    <a
                      href={sub.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent text-sm hover:underline break-all"
                    >
                      {sub.url}
                    </a>
                  </Card.Content>
                </Card>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onPress={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onPress={() => {
              alert('Content approved!');
              onClose();
            }}
          >
            <CheckCircle size={13} /> Approve content
          </Button>
        </Modal.Footer>
      </Modal.Dialog>
    </Modal.Container>
    </Modal.Backdrop>
  </Modal>
);

/* ── Application card ─────────────────────────────────────────── */
type Application = {
  id: string;
  status: string;
  pitch?: string;
  video_pitch_url?: string;
  payment_amount?: number | string;
  payment_frequency?: string;
  payment_day?: number;
  currency?: string;
  creator?: {
    email?: string;
    creatorProfile?: {
      full_name?: string;
      avatar_url?: string;
      follower_range?: string;
    };
  };
  campaign?: { title?: string; budget?: number | string };
};

const getStats = (user: any) => {
  const fr: string = user?.creatorProfile?.follower_range || '';
  if (fr.includes('500k') || fr.includes('500K'))
    return { followers: '500K+', eng: '4.2%' };
  if (fr.includes('100k') || fr.includes('100K'))
    return { followers: '100K–500K', eng: '3.8%' };
  if (fr.includes('50k') || fr.includes('50K'))
    return { followers: '50K–100K', eng: '5.1%' };
  if (fr.includes('10k') || fr.includes('10K'))
    return { followers: '10K–50K', eng: '6.2%' };
  return { followers: '1K–10K', eng: '7.5%' };
};

const AppCard: React.FC<{
  app: Application;
  expanded: boolean;
  onToggle: () => void;
  onMessage: () => void;
  onAccept: () => void;
  onReject: () => void;
  onContract: () => void;
  onEditPayment: () => void;
  onReview: () => void;
}> = ({
  app,
  expanded,
  onToggle,
  onMessage,
  onAccept,
  onReject,
  onContract,
  onEditPayment,
  onReview,
}) => {
  const stats = getStats(app.creator);
  const initial = (app.creator?.email || 'C')[0].toUpperCase();
  const name =
    app.creator?.creatorProfile?.full_name || app.creator?.email || 'Creator';

  return (
    <Card>
      <Card.Content className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar size="md">
            {app.creator?.creatorProfile?.avatar_url && (
              <Avatar.Image
                src={app.creator.creatorProfile.avatar_url}
                alt={name}
              />
            )}
            <Avatar.Fallback>{initial}</Avatar.Fallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-foreground text-sm font-semibold truncate">
              {name}
            </div>
            <div className="text-muted text-xs truncate">
              {app.campaign?.title || 'Campaign'}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 text-center">
            <div>
              <div className="text-foreground text-sm font-semibold tabular-nums">
                {stats.followers}
              </div>
              <div className="text-muted text-[10px] uppercase tracking-wider">
                Followers
              </div>
            </div>
            <div>
              <div className="text-success text-sm font-semibold tabular-nums">
                {stats.eng}
              </div>
              <div className="text-muted text-[10px] uppercase tracking-wider">
                Eng. rate
              </div>
            </div>
          </div>

          <Chip
            color={STATUS_COLOR[app.status] || 'default'}
            variant="soft"
            size="sm"
          >
            <Chip.Label className="capitalize">{app.status}</Chip.Label>
          </Chip>

          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onPress={onToggle}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>

        {expanded && (
          <>
            <Separator />
            <div className="space-y-3">
              {/* Pitch */}
              <Card className="bg-surface-secondary">
                <Card.Content className="p-3 text-sm text-foreground leading-relaxed">
                  <p className="text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 inline-flex items-center gap-1.5">
                    <MessageSquare size={11} /> Creator pitch
                  </p>
                  {app.pitch || (
                    <span className="italic text-muted">
                      No written pitch provided.
                    </span>
                  )}
                </Card.Content>
              </Card>

              {/* Video pitch */}
              {app.video_pitch_url && (
                <div className="space-y-2">
                  <p className="text-muted text-[10px] font-medium uppercase tracking-wider inline-flex items-center gap-1.5">
                    <Activity size={11} className="text-accent" /> Video
                    introduction
                  </p>
                  <div className="aspect-video bg-overlay rounded-xl overflow-hidden border border-border max-w-sm">
                    <video
                      src={
                        app.video_pitch_url.startsWith('http')
                          ? app.video_pitch_url
                          : `${serverOrigin}${app.video_pitch_url}`
                      }
                      controls
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Budget */}
              {app.campaign?.budget && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign size={13} className="text-success" />
                  <span className="text-foreground font-medium">
                    Campaign budget: $
                    {Number(app.campaign.budget).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="tertiary"
                  size="sm"
                  onPress={onMessage}
                >
                  <MessageSquare size={12} /> Message
                </Button>
                {app.status === 'pending' && (
                  <>
                    <Button variant="primary" size="sm" onPress={onAccept}>
                      <CheckCircle size={12} /> Accept & set agreement
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!text-danger"
                      onPress={onReject}
                    >
                      <X size={12} /> Decline
                    </Button>
                  </>
                )}
                {app.status === 'accepted' && (
                  <>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onPress={onContract}
                    >
                      <FileText size={12} /> View contract
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onPress={onEditPayment}
                    >
                      <CreditCard size={12} /> Edit payment
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onPress={onReview}
                    >
                      <Eye size={12} /> Review deliverables
                    </Button>
                  </>
                )}
              </div>

              {app.status === 'accepted' && app.payment_amount && (
                <Card className="bg-success-soft border-success/40">
                  <Card.Content className="p-3 flex items-center gap-2 text-xs text-success-soft-foreground">
                    <Clock size={12} />
                    <span>
                      Paying{' '}
                      <strong>
                        {app.currency || 'USD'}{' '}
                        {Number(app.payment_amount).toLocaleString()}
                      </strong>{' '}
                      every{' '}
                      <strong>{app.payment_frequency || 'month'}</strong> on day{' '}
                      <strong>{app.payment_day || 1}</strong>
                    </span>
                  </Card.Content>
                </Card>
              )}
            </div>
          </>
        )}
      </Card.Content>
    </Card>
  );
};

/* ── Main page ────────────────────────────────────────────────── */
const BrandApplications: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingApp, setReviewingApp] = useState<Application | null>(null);
  const [appSubmissions, setAppSubmissions] = useState<any[]>([]);
  const [chatApp, setChatApp] = useState<Application | null>(null);
  const [contractApp, setContractApp] = useState<Application | null>(null);
  const [paymentApp, setPaymentApp] = useState<Application | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'accepted' | 'others'
  >('all');

  const fetchData = async () => {
    try {
      const res = await api.get('/applications');
      setApplications(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setCurrentUserId(res.data.userId))
      .catch(() => {});
    fetchData();
  }, []);

  const handleReject = async (appId: string) => {
    try {
      await api.patch(`/applications/${appId}/status`, { status: 'rejected' });
      fetchData();
    } catch {
      alert('Failed to reject.');
    }
  };

  const counts = useMemo(
    () => ({
      all: applications.length,
      pending: applications.filter((a) => a.status === 'pending').length,
      accepted: applications.filter((a) => a.status === 'accepted').length,
      others: applications.filter(
        (a) => a.status !== 'pending' && a.status !== 'accepted'
      ).length,
    }),
    [applications]
  );

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return applications;
    if (statusFilter === 'others')
      return applications.filter(
        (a) => a.status !== 'pending' && a.status !== 'accepted'
      );
    return applications.filter((a) => a.status === statusFilter);
  }, [applications, statusFilter]);

  return (
    <PageShell
      title="Applications inbox"
      description="Review creator applications and create payment agreements — no upfront payments required."
      icon={<Users size={18} />}
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPI>
          <KPI.Header>
            <KPI.Title>Pending review</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={counts.pending} maximumFractionDigits={0} />
            <KPI.Trend trend={counts.pending > 0 ? 'neutral' : 'up'}>
              Awaiting decision
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Accepted & active</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={counts.accepted} maximumFractionDigits={0} />
            <KPI.Trend trend={counts.accepted > 0 ? 'up' : 'neutral'}>
              Currently working
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Declined / other</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={counts.others} maximumFractionDigits={0} />
          </KPI.Content>
        </KPI>
      </div>

      {/* Info banner */}
      <Card className="bg-accent-soft border-accent/30">
        <Card.Content className="p-4 flex items-start gap-3">
          <AlertCircle size={15} className="text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground text-sm font-semibold">
              Accept first, pay on schedule
            </p>
            <p className="text-muted text-xs mt-0.5">
              Accepting a creator no longer triggers immediate payment. Instead,
              you agree on a payment schedule. Adjust or cancel anytime from{' '}
              <strong>My Team</strong>.
            </p>
          </div>
        </Card.Content>
      </Card>

      {/* Filter toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Segment
          selectedKey={statusFilter}
          onSelectionChange={(k) => setStatusFilter(k as typeof statusFilter)}
        >
          <Segment.Item id="all">All · {counts.all}</Segment.Item>
          <Segment.Item id="pending">Pending · {counts.pending}</Segment.Item>
          <Segment.Item id="accepted">Accepted · {counts.accepted}</Segment.Item>
          <Segment.Item id="others">Others · {counts.others}</Segment.Item>
        </Segment>
      </div>

      {/* Applications */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : applications.length === 0 ? (
        <Card>
          <Card.Content className="p-8">
            <EmptyState>
              <EmptyState.Media>
                <Users className="size-7" />
              </EmptyState.Media>
              <EmptyState.Title>Inbox zero</EmptyState.Title>
              <EmptyState.Description>
                No applications yet. Launch a campaign to start receiving
                creators.
              </EmptyState.Description>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <Card.Content className="p-8">
            <EmptyState>
              <EmptyState.Media>
                <FileText className="size-7" />
              </EmptyState.Media>
              <EmptyState.Title>No matches</EmptyState.Title>
              <EmptyState.Description>
                Try selecting a different status above.
              </EmptyState.Description>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              expanded={expanded === app.id}
              onToggle={() => setExpanded(expanded === app.id ? null : app.id)}
              onMessage={() => setChatApp(app)}
              onAccept={() => setPaymentApp(app)}
              onReject={() => handleReject(app.id)}
              onContract={() => setContractApp(app)}
              onEditPayment={() => setPaymentApp(app)}
              onReview={async () => {
                setReviewingApp(app);
                try {
                  const res = await api.get(
                    `/tracking/application/${app.id}/submissions`
                  );
                  setAppSubmissions(res.data || []);
                } catch {
                  setAppSubmissions([]);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {paymentApp && (
        <PaymentScheduleModal
          app={paymentApp}
          isOpen={!!paymentApp}
          onClose={() => setPaymentApp(null)}
          onSaved={fetchData}
        />
      )}

      {reviewingApp && (
        <ReviewModal
          app={reviewingApp}
          submissions={appSubmissions}
          isOpen={!!reviewingApp}
          onClose={() => setReviewingApp(null)}
        />
      )}

      {chatApp && (
        <ChatWindow
          applicationId={chatApp.id}
          currentUserId={currentUserId}
          onClose={() => setChatApp(null)}
          creatorName={
            chatApp.creator?.creatorProfile?.full_name || chatApp.creator?.email
          }
        />
      )}
      {contractApp && (
        <ContractManager
          applicationId={contractApp.id}
          isBrand={true}
          onClose={() => setContractApp(null)}
        />
      )}
    </PageShell>
  );
};

export default BrandApplications;
