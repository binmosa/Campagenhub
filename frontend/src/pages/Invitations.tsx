import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Calendar,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Edit,
  FileText,
  Mail,
  MessageSquare,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Separator,
} from '@heroui/react';
import {
  EmptyState,
  Segment,
} from '@heroui-pro/react';
import api from '../lib/api';
import { NegotiationModal } from '../components/chat/NegotiationModal';
import { PageShell } from '../components/ui';

type Invitation = {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | string;
  type?: 'creator_collab' | 'manager_assign' | string;
  message?: string;
  video_link?: string;
  payment_amount?: number | string;
  payment_frequency?: string;
  payment_day?: number;
  payment_approved?: boolean;
  currency?: string;
  permissions?: Record<string, boolean>;
  contract_content?: string;
  created_at?: string;
  sender?: { id?: string; email?: string };
  receiver?: { id?: string; email?: string };
};

const STATUS_COLOR: Record<
  string,
  'success' | 'warning' | 'danger' | 'default'
> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'danger',
  cancelled: 'default',
  expired: 'default',
};

const InvitationCard: React.FC<{
  inv: Invitation;
  mode: 'received' | 'sent';
  onAction: () => void;
  onNegotiate: (id: string) => void;
}> = ({ inv, mode, onAction, onNegotiate }) => {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<'accept' | 'decline' | 'cancel' | null>(
    null
  );

  const counterparty = mode === 'received' ? inv.sender : inv.receiver;
  const isCreatorCollab = inv.type === 'creator_collab';
  const counterpartyName =
    counterparty?.email?.split('@')[0] || counterparty?.email || 'Unknown';
  const initial = counterpartyName.slice(0, 1).toUpperCase();

  const handleAccept = async () => {
    setPending('accept');
    try {
      await api.patch(`/invitations/${inv.id}/accept`);
      onAction();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to accept');
    } finally {
      setPending(null);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm('Decline this invitation?')) return;
    setPending('decline');
    try {
      await api.patch(`/invitations/${inv.id}/decline`);
      onAction();
    } catch {}
    finally {
      setPending(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this invitation?')) return;
    setPending('cancel');
    try {
      await api.delete(`/invitations/${inv.id}/cancel`);
      onAction();
    } catch {}
    finally {
      setPending(null);
    }
  };

  const handleEdit = async () => {
    const newMsg = prompt('Edit invitation message:', inv.message || '');
    if (newMsg === null) return;
    try {
      await api.patch(`/invitations/${inv.id}/message`, { message: newMsg });
      onAction();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to edit invitation');
    }
  };

  const offerSearch = encodeURIComponent(
    JSON.stringify({
      payment_amount: inv.payment_amount,
      currency: inv.currency,
      payment_frequency: inv.payment_frequency,
    })
  );

  return (
    <Card className="overflow-hidden">
      <Card.Content className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Avatar size="md">
              <Avatar.Fallback className="bg-accent-soft text-accent-soft-foreground font-semibold">
                {initial}
              </Avatar.Fallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-foreground text-sm font-semibold truncate">
                  {counterparty?.email || 'Unknown'}
                </span>
                <Chip
                  color={isCreatorCollab ? 'accent' : 'success'}
                  variant="soft"
                  size="sm"
                >
                  {isCreatorCollab ? (
                    <>
                      <Camera size={11} /> Creator collab
                    </>
                  ) : (
                    <>
                      <Award size={11} /> Manager assign
                    </>
                  )}
                </Chip>
                <Chip
                  color={STATUS_COLOR[inv.status] || 'default'}
                  variant="soft"
                  size="sm"
                  className="capitalize"
                >
                  {inv.status}
                </Chip>
              </div>
              <p className="text-muted text-sm mt-1">
                {inv.message || 'No personal message provided.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {inv.video_link && (
              <a
                href={inv.video_link}
                target="_blank"
                rel="noreferrer"
                aria-label="Watch video pitch"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground"
                title="Watch video pitch"
              >
                <Camera size={14} />
              </a>
            )}
            {mode === 'sent' && inv.status === 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                className="!rounded-lg !text-warning"
                aria-label="Edit invitation"
                onPress={handleEdit}
              >
                <Edit size={14} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              className="!rounded-lg"
              aria-label={expanded ? 'Collapse' : 'Expand'}
              onPress={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </Button>
          </div>
        </div>

        {/* Payment chips */}
        {inv.payment_amount && (
          <div className="flex flex-wrap gap-2">
            <Chip color="success" variant="soft" size="sm">
              <DollarSign size={11} />
              {inv.currency} {Number(inv.payment_amount).toLocaleString()} /{' '}
              {inv.payment_frequency}
            </Chip>
            {inv.payment_day && (
              <Chip variant="secondary" size="sm">
                <Calendar size={11} /> Day {inv.payment_day}
              </Chip>
            )}
            {!inv.payment_approved && mode === 'received' && (
              <Chip color="warning" variant="soft" size="sm">
                <AlertCircle size={11} /> Awaiting brand approval
              </Chip>
            )}
          </div>
        )}

        {/* Quick actions row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="!rounded-lg"
            onPress={() => onNegotiate(inv.id)}
          >
            <MessageSquare size={13} /> Negotiate
          </Button>
          {counterparty?.id && (
            <Link
              to={`/dashboard/messages?newId=${counterparty.id}&name=${encodeURIComponent(counterpartyName)}&offer=${offerSearch}`}
            >
              <Button variant="ghost" size="sm" className="!rounded-lg">
                <Mail size={13} /> Message
              </Button>
            </Link>
          )}
        </div>

        {/* Expanded panel */}
        {expanded && (
          <>
            <Separator />
            {inv.permissions &&
              Object.keys(inv.permissions).some((k) => inv.permissions![k]) && (
                <div>
                  <div className="text-muted text-xs font-medium uppercase tracking-wider mb-2">
                    Permissions offered
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {inv.permissions.can_add_campaigns && (
                      <Chip color="accent" variant="soft" size="sm">
                        Can add campaigns
                      </Chip>
                    )}
                    {inv.permissions.can_view_analytics && (
                      <Chip color="accent" variant="soft" size="sm">
                        Can view analytics
                      </Chip>
                    )}
                    {inv.permissions.can_manage_applications && (
                      <Chip color="accent" variant="soft" size="sm">
                        Can manage applications
                      </Chip>
                    )}
                  </div>
                </div>
              )}
            {inv.contract_content && (
              <div>
                <div className="text-muted text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={11} /> Contract
                </div>
                <div
                  className="rounded-lg p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto"
                  style={{
                    background: 'var(--surface-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                >
                  {inv.contract_content}
                </div>
              </div>
            )}
          </>
        )}

        {/* Action footer */}
        {inv.status === 'pending' && (
          <>
            <Separator />
            <div className="flex items-center gap-2 flex-wrap">
              {mode === 'received' ? (
                <>
                  {!inv.payment_approved ? (
                    <Chip color="warning" variant="soft" size="sm">
                      <AlertCircle size={11} /> Cannot accept until brand approves payment
                    </Chip>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      className="!rounded-lg"
                      isPending={pending === 'accept'}
                      onPress={handleAccept}
                    >
                      <CheckCircle size={13} /> Accept & sign
                    </Button>
                  )}
                  <Button
                    variant="danger-soft"
                    size="sm"
                    className="!rounded-lg"
                    isPending={pending === 'decline'}
                    onPress={handleDecline}
                  >
                    <XCircle size={13} /> Decline
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="!rounded-lg"
                  isPending={pending === 'cancel'}
                  onPress={handleCancel}
                >
                  Cancel invitation
                </Button>
              )}
              <span className="ml-auto inline-flex items-center gap-1 text-muted text-xs">
                <Clock size={11} />{' '}
                {inv.created_at
                  ? new Date(inv.created_at).toLocaleDateString()
                  : '—'}
              </span>
            </div>
          </>
        )}
      </Card.Content>
    </Card>
  );
};

const Invitations: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryInviteId = searchParams.get('inviteId');

  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [received, setReceived] = useState<Invitation[]>([]);
  const [sent, setSent] = useState<Invitation[]>([]);
  const [approvals, setApprovals] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [negotiatingInviteId, setNegotiatingInviteId] = useState<string | null>(
    queryInviteId
  );
  const role = (localStorage.getItem('role') || 'creator').toLowerCase();

  const load = useCallback(() => {
    setLoading(true);
    const calls: Promise<any>[] = [
      api.get('/invitations/received').catch(() => ({ data: [] })),
      api.get('/invitations/sent').catch(() => ({ data: [] })),
    ];
    if (role === 'brand')
      calls.push(
        api.get('/invitations/pending-approvals').catch(() => ({ data: [] }))
      );
    Promise.all(calls).then(([recv, snt, appr]) => {
      setReceived(recv.data || []);
      setSent(snt.data || []);
      if (appr) setApprovals(appr.data || []);
      setLoading(false);
    });
  }, [role]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprovePayment = async (id: string) => {
    await api.patch(`/invitations/${id}/approve-payment`);
    load();
  };

  const pending = useMemo(
    () => received.filter((i) => i.status === 'pending').length,
    [received]
  );

  const list = tab === 'received' ? received : sent;

  return (
    <PageShell
      title="Invitations"
      description="Collaboration invitations with embedded contracts and payment terms."
      icon={<Mail size={18} />}
    >
      {/* Brand-only: pending payment approvals */}
      {role === 'brand' && approvals.length > 0 && (
        <Card className="bg-warning-soft border-warning/40">
          <Card.Content className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-warning" />
              <span className="text-foreground text-sm font-semibold">
                {approvals.length} invitation
                {approvals.length === 1 ? '' : 's'} from your manager need
                payment approval
              </span>
            </div>
            <ul className="space-y-2">
              {approvals.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-surface border border-border"
                >
                  <div className="min-w-0">
                    <div className="text-foreground text-sm font-semibold truncate">
                      {inv.receiver?.email}
                    </div>
                    <div className="text-muted text-xs">
                      {inv.currency}{' '}
                      {Number(inv.payment_amount || 0).toLocaleString()} /{' '}
                      {inv.payment_frequency}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="!rounded-lg"
                    onPress={() => handleApprovePayment(inv.id)}
                  >
                    Approve
                  </Button>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      )}

      {/* Tabs */}
      <Segment
        selectedKey={tab}
        onSelectionChange={(k) => setTab(k as typeof tab)}
        size="md"
      >
        <Segment.Item id="received">
          <Mail className="size-3.5" /> Received
          {pending > 0 && <span className="ml-1 tabular-nums">· {pending}</span>}
        </Segment.Item>
        <Segment.Separator />
        <Segment.Item id="sent">
          <Users className="size-3.5" /> Sent
        </Segment.Item>
      </Segment>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <Card.Content className="p-8">
            <EmptyState>
              <EmptyState.Media>
                <Mail className="size-7" />
              </EmptyState.Media>
              <EmptyState.Title>No {tab} invitations yet</EmptyState.Title>
              <EmptyState.Description>
                {tab === 'received'
                  ? 'New invitations will appear here.'
                  : 'Send your first invitation from the Talent Network.'}
              </EmptyState.Description>
              {tab === 'sent' && (
                <EmptyState.Content>
                  <Link to="/talent">
                    <Button variant="primary">Browse Talent Network</Button>
                  </Link>
                </EmptyState.Content>
              )}
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((inv) => (
            <InvitationCard
              key={inv.id}
              inv={inv}
              mode={tab}
              onAction={load}
              onNegotiate={setNegotiatingInviteId}
            />
          ))}
        </div>
      )}

      {/* Negotiation modal (existing component) */}
      {negotiatingInviteId && (
        <NegotiationModal
          inviteId={negotiatingInviteId}
          onClose={() => setNegotiatingInviteId(null)}
          onUpdate={load}
        />
      )}
    </PageShell>
  );
};

export default Invitations;
