import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Segment } from '@heroui-pro/react';
import api from '../lib/api';
import { NegotiationModal } from '../components/chat/NegotiationModal';
import { EmptyPanel } from '../components/common/EmptyPanel';
import { MetricCard, PageShell } from '../components/ui';

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
  sender?: { id?: string; email?: string; brandProfile?: any; managerProfile?: any };
  receiver?: { id?: string; email?: string; creatorProfile?: any; managerProfile?: any };
};

/** Display name from the counterparty's profile, falling back to the email. */
const partyName = (u?: Invitation['sender'] | Invitation['receiver']): string => {
  const p: any = u || {};
  return (
    p.brandProfile?.company_name ||
    p.creatorProfile?.full_name ||
    p.managerProfile?.full_name ||
    p.email?.split('@')[0] ||
    'Unknown'
  );
};
const partyAvatar = (u?: any): string | undefined =>
  u?.brandProfile?.logo_url || u?.creatorProfile?.avatar_url || u?.managerProfile?.avatar_url || undefined;

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
  const [pending, setPending] = useState<'accept' | 'decline' | 'cancel' | 'edit' | null>(
    null
  );
  const [editingMsg, setEditingMsg] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'decline' | 'cancel' | null>(null);

  const counterparty = mode === 'received' ? inv.sender : inv.receiver;
  const isCreatorCollab = inv.type === 'creator_collab';
  const counterpartyName = partyName(counterparty);
  const avatarUrl = partyAvatar(counterparty);
  const initial = counterpartyName.slice(0, 1).toUpperCase();

  const run = async (kind: 'accept' | 'decline' | 'cancel', req: () => Promise<any>) => {
    setPending(kind);
    setError('');
    try {
      await req();
      onAction();
    } catch (e: any) {
      setError(e?.response?.data?.message || `Could not ${kind} this invitation.`);
    } finally {
      setPending(null);
      setConfirm(null);
    }
  };
  const handleAccept = () => run('accept', () => api.patch(`/invitations/${inv.id}/accept`));
  const handleDecline = () => run('decline', () => api.patch(`/invitations/${inv.id}/decline`));
  const handleCancel = () => run('cancel', () => api.delete(`/invitations/${inv.id}/cancel`));

  const saveEdit = async () => {
    if (editingMsg === null) return;
    setPending('edit');
    setError('');
    try {
      await api.patch(`/invitations/${inv.id}/message`, { message: editingMsg });
      setEditingMsg(null);
      onAction();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to edit invitation');
    } finally {
      setPending(null);
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
              {avatarUrl && <Avatar.Image src={avatarUrl} alt="" />}
              <Avatar.Fallback className="bg-accent-soft text-accent-soft-foreground font-semibold">
                {initial}
              </Avatar.Fallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-foreground text-sm font-semibold truncate" title={counterparty?.email}>
                  {counterpartyName}
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
              {editingMsg === null ? (
                <p className="text-muted text-sm mt-1">
                  {inv.message || 'No personal message provided.'}
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  <textarea
                    className="w-full px-3 py-2 rounded-lg bg-surface text-foreground text-sm border border-border focus:outline-none focus:border-field-border-focus resize-y"
                    rows={3}
                    value={editingMsg}
                    onChange={(e) => setEditingMsg(e.target.value)}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="sm" onPress={saveEdit} isPending={pending === 'edit'}>
                      Save message
                    </Button>
                    <Button variant="ghost" size="sm" onPress={() => setEditingMsg(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {error && (
                <p className="text-danger text-xs mt-2" role="alert">
                  {error}
                </p>
              )}
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
                onPress={() => setEditingMsg(inv.message || '')}
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
                  {confirm === 'decline' ? (
                    <>
                      <span className="text-muted text-xs">Decline this invitation?</span>
                      <Button variant="danger" size="sm" className="!rounded-lg" isPending={pending === 'decline'} onPress={handleDecline}>
                        Yes, decline
                      </Button>
                      <Button variant="ghost" size="sm" className="!rounded-lg" onPress={() => setConfirm(null)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="danger-soft"
                      size="sm"
                      className="!rounded-lg"
                      onPress={() => setConfirm('decline')}
                    >
                      <XCircle size={13} /> Decline
                    </Button>
                  )}
                </>
              ) : confirm === 'cancel' ? (
                <>
                  <span className="text-muted text-xs">Cancel this invitation?</span>
                  <Button variant="danger" size="sm" className="!rounded-lg" isPending={pending === 'cancel'} onPress={handleCancel}>
                    Yes, cancel it
                  </Button>
                  <Button variant="ghost" size="sm" className="!rounded-lg" onPress={() => setConfirm(null)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="!rounded-lg"
                  onPress={() => setConfirm('cancel')}
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
  const { t } = useTranslation();
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

  const [approving, setApproving] = useState<string | null>(null);
  const [approveError, setApproveError] = useState('');
  const handleApprovePayment = async (id: string) => {
    setApproving(id);
    setApproveError('');
    try {
      await api.patch(`/invitations/${id}/approve-payment`);
      load();
    } catch (e: any) {
      setApproveError(e?.response?.data?.message || 'Could not approve this payment.');
    } finally {
      setApproving(null);
    }
  };

  const pending = useMemo(
    () => received.filter((i) => i.status === 'pending').length,
    [received]
  );

  const list = tab === 'received' ? received : sent;

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('ops.inv.title')}
      titleAccent={t('ops.inv.accent')}
      description={t('ops.inv.desc')}
      icon={<Mail size={18} />}
      stats={
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label={t('ops.inv.kReceived')} value={received.length} hint={t('ops.inv.kReceivedHint', { n: pending })} icon={Mail} iconStatus={pending ? 'warning' : undefined} />
          <MetricCard label={t('ops.inv.kSent')} value={sent.length} hint={t('ops.inv.kSentHint', { n: sent.filter((i) => i.status === 'pending').length })} icon={Users} />
          <MetricCard label={t('ops.inv.kAccepted')} value={[...received, ...sent].filter((i) => i.status === 'accepted').length} hint={t('ops.inv.kAcceptedHint')} icon={CheckCircle} iconStatus="success" />
        </div>
      }
    >
      {/* Brand-only: pending payment approvals */}
      {role === 'brand' && approvals.length > 0 && (
        <Card className="bg-warning-soft border-warning/40">
          <Card.Content className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-warning" />
              <span className="text-foreground text-sm font-semibold">
                {t('ops.inv.approvals', { count: approvals.length })}
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
                    isPending={approving === inv.id}
                    isDisabled={!!approving && approving !== inv.id}
                    onPress={() => handleApprovePayment(inv.id)}
                  >
                    Approve
                  </Button>
                </li>
              ))}
            </ul>
            {approveError && (
              <p className="text-danger text-xs" role="alert">
                {approveError}
              </p>
            )}
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
        <EmptyPanel
          icon={<Mail size={22} />}
          title={tab === 'received' ? t('ops.inv.emptyReceived') : t('ops.inv.emptySent')}
          description={tab === 'received' ? t('ops.inv.emptyReceivedDesc') : t('ops.inv.emptySentDesc')}
          actions={
            tab === 'sent' ? (
              <Link to="/dashboard/talent">
                <Button variant="primary">{t('ops.inv.browseTalent')}</Button>
              </Link>
            ) : undefined
          }
        />
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
