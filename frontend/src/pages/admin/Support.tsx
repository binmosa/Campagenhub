import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Headphones,
  Inbox,
  MessageSquare,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  Video,
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
  TextArea,
  TextField,
} from '@heroui/react';
import { EmptyState, KPI, Segment } from '@heroui-pro/react';
import { Input } from 'react-aria-components';
import api from '../../lib/api';
import { PageShell } from '../../components/ui';

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

type Tab =
  | 'tickets'
  | 'reviews'
  | 'validations'
  | 'manager-reassignments';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'accent'> = {
  open: 'accent',
  in_progress: 'warning',
  resolved: 'success',
};

const AdminSupport: React.FC = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  const isSupportOnly = role === 'support';
  const [tab, setTab] = useState<Tab>('validations');
  const [tickets, setTickets] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [managerFeedbacks, setManagerFeedbacks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [kycModalUser, setKycModalUser] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>(
    'all'
  );

  const [showCreateReview, setShowCreateReview] = useState(false);
  const [newReview, setNewReview] = useState({
    user_name: '',
    user_role: 'Creator',
    rating: 5,
    comment: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isSupportOnly) {
        const pendingRes = await api
          .get('/admin/users/pending')
          .catch(() => ({ data: [] }));
        setPendingUsers(pendingRes.data || []);
        setTickets([]);
        setReviews([]);
        setManagerFeedbacks([]);
        setStats({});
      } else {
        const [ticketsRes, reviewsRes, statsRes, pendingRes, feedbacksRes] =
          await Promise.all([
            api.get('/support/tickets'),
            api.get('/reviews'),
            api.get('/support/tickets/stats'),
            api.get('/admin/users/pending').catch(() => ({ data: [] })),
            api
              .get('/managers/admin/feedback')
              .catch(() => ({ data: [] })),
          ]);
        setTickets(ticketsRes.data || []);
        setReviews(reviewsRes.data || []);
        setStats(statsRes.data || {});
        setPendingUsers(pendingRes.data || []);
        setManagerFeedbacks(
          (feedbacksRes.data || []).filter((f: any) => f.status === 'pending')
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    try {
      await api.patch(`/support/tickets/${selectedTicket.id}/reply`, {
        reply: replyText,
        status: 'resolved',
      });
      setReplyText('');
      setSelectedTicket(null);
      fetchData();
    } catch {
      alert('Failed to reply');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.patch(`/support/tickets/${id}/status`, { status });
      fetchData();
    } catch {
      alert('Failed to update');
    }
  };

  const toggleReview = async (id: string) => {
    try {
      await api.patch(`/reviews/${id}/toggle`);
      fetchData();
    } catch {
      alert('Failed to toggle');
    }
  };

  const deleteReview = async (id: string) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await api.delete(`/reviews/${id}`);
      fetchData();
    } catch {
      alert('Failed to delete');
    }
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/public/reviews', newReview);
      setShowCreateReview(false);
      setNewReview({
        user_name: '',
        user_role: 'Creator',
        rating: 5,
        comment: '',
      });
      fetchData();
    } catch {
      alert('Failed to create review');
    }
  };

  const handleValidateUser = async (id: string, status: string) => {
    try {
      await api.patch(`/admin/users/${id}/validate`, { status });
      fetchData();
    } catch {
      alert('Failed to update user status');
    }
  };

  const handleResolveFeedback = async (id: string, status: string) => {
    try {
      await api.patch(`/admin/feedback/${id}/resolve`, { status });
      fetchData();
    } catch {
      alert('Failed to resolve feedback');
    }
  };

  const filteredTickets =
    filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <PageShell
      title={isSupportOnly ? 'Verification center' : 'Support center'}
      description={
        isSupportOnly
          ? 'Review and approve registration requests.'
          : 'Manage support tickets, reviews, and user validations.'
      }
      icon={<Headphones size={18} />}
    >
      {/* KPIs */}
      {!isSupportOnly && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KPI>
            <KPI.Header>
              <KPI.Title>Open</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value
                value={stats.open || 0}
                maximumFractionDigits={0}
              />
              <KPI.Trend trend={(stats.open || 0) > 0 ? 'neutral' : 'up'}>
                Awaiting reply
              </KPI.Trend>
            </KPI.Content>
          </KPI>
          <KPI>
            <KPI.Header>
              <KPI.Title>In progress</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value
                value={stats.inProgress || 0}
                maximumFractionDigits={0}
              />
              <KPI.Trend trend="neutral">Being handled</KPI.Trend>
            </KPI.Content>
          </KPI>
          <KPI>
            <KPI.Header>
              <KPI.Title>Resolved</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value
                value={stats.resolved || 0}
                maximumFractionDigits={0}
              />
              <KPI.Trend trend={(stats.resolved || 0) > 0 ? 'up' : 'neutral'}>
                Closed
              </KPI.Trend>
            </KPI.Content>
          </KPI>
          <KPI>
            <KPI.Header>
              <KPI.Title>Pending validations</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value
                value={pendingUsers.length + managerFeedbacks.length}
                maximumFractionDigits={0}
              />
              <KPI.Trend
                trend={
                  pendingUsers.length + managerFeedbacks.length > 0
                    ? 'neutral'
                    : 'up'
                }
              >
                Awaiting review
              </KPI.Trend>
            </KPI.Content>
          </KPI>
        </div>
      )}

      {/* Tabs + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Segment
          selectedKey={tab}
          onSelectionChange={(k) => setTab(k as Tab)}
        >
          <Segment.Item id="validations">
            Validations · {pendingUsers.length}
          </Segment.Item>
          {!isSupportOnly && (
            <Segment.Item id="manager-reassignments">
              Manager changes · {managerFeedbacks.length}
            </Segment.Item>
          )}
          {!isSupportOnly && (
            <Segment.Item id="tickets">
              Tickets · {tickets.length}
            </Segment.Item>
          )}
          {!isSupportOnly && (
            <Segment.Item id="reviews">
              Reviews · {reviews.length}
            </Segment.Item>
          )}
        </Segment>
        {tab === 'reviews' && (
          <Button
            variant="primary"
            size="md"
            onPress={() => setShowCreateReview(true)}
          >
            <Star size={13} /> Create testimonial
          </Button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : tab === 'validations' ? (
        pendingUsers.length === 0 ? (
          <Card>
            <Card.Content className="p-8">
              <EmptyState>
                <EmptyState.Media>
                  <CheckCircle2 className="size-7" />
                </EmptyState.Media>
                <EmptyState.Title>All caught up</EmptyState.Title>
                <EmptyState.Description>
                  No pending account validations.
                </EmptyState.Description>
              </EmptyState>
            </Card.Content>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map((user) => {
              const name =
                user.role === 'brand'
                  ? user.brandProfile?.company_name
                  : user.role === 'creator'
                  ? user.creatorProfile?.full_name
                  : user.managerProfile?.full_name;
              const initial = (user.email || 'U')[0].toUpperCase();
              return (
                <Card key={user.id}>
                  <Card.Content className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar size="lg">
                        <Avatar.Fallback>{initial}</Avatar.Fallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-foreground text-sm font-semibold truncate">
                            {user.email}
                          </h3>
                          <Chip color="default" variant="soft" size="sm">
                            <Chip.Label className="capitalize">
                              {user.role}
                            </Chip.Label>
                          </Chip>
                        </div>
                        {name && (
                          <p className="text-muted text-xs mt-0.5">{name}</p>
                        )}
                        <div className="mt-3 flex gap-2 flex-wrap">
                          {user.kyc_video_url && (
                            <Button
                              variant="tertiary"
                              size="sm"
                              onPress={() => setKycModalUser(user)}
                            >
                              <Eye size={12} /> Review KYC media
                            </Button>
                          )}
                          {user.identity_document && (
                            <a
                              href={user.identity_document}
                              download={`identity_${user.id}.pdf`}
                            >
                              <Button variant="tertiary" size="sm">
                                <Eye size={12} /> Legacy document
                              </Button>
                            </a>
                          )}
                          {!user.kyc_video_url && !user.identity_document && (
                            <Chip color="danger" variant="soft" size="sm">
                              <Chip.Label>No documentation</Chip.Label>
                            </Chip>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="primary"
                        size="md"
                        onPress={() => handleValidateUser(user.id, 'active')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        className="!text-danger"
                        onPress={() => handleValidateUser(user.id, 'rejected')}
                      >
                        Reject
                      </Button>
                    </div>
                  </Card.Content>
                </Card>
              );
            })}
          </div>
        )
      ) : tab === 'manager-reassignments' ? (
        managerFeedbacks.length === 0 ? (
          <Card>
            <Card.Content className="p-8">
              <EmptyState>
                <EmptyState.Media>
                  <CheckCircle2 className="size-7" />
                </EmptyState.Media>
                <EmptyState.Title>No reassignment requests</EmptyState.Title>
                <EmptyState.Description>
                  No active manager complaints or reassignment requests.
                </EmptyState.Description>
              </EmptyState>
            </Card.Content>
          </Card>
        ) : (
          <div className="space-y-3">
            {managerFeedbacks.map((f) => (
              <Card key={f.id}>
                <Card.Content className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-foreground text-sm font-semibold">
                        Change request from{' '}
                        <span className="text-accent">
                          {f.brand?.brandProfile?.company_name ||
                            f.brand?.email}
                        </span>
                      </h3>
                      <p className="text-muted text-xs mt-1">
                        Current manager:{' '}
                        <span className="text-foreground font-medium">
                          {f.manager?.managerProfile?.full_name ||
                            f.manager?.email}
                        </span>
                      </p>
                    </div>
                    <Chip color="danger" variant="soft" size="sm">
                      <Chip.Label>Complaint</Chip.Label>
                    </Chip>
                  </div>
                  <div>
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Complaint feedback
                    </Label>
                    <Card className="bg-surface-secondary">
                      <Card.Content className="p-4 text-sm text-foreground leading-relaxed italic">
                        "{f.feedback_text}"
                      </Card.Content>
                    </Card>
                  </div>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="inline-flex items-center gap-1 text-sm">
                      <span className="text-muted">Brand rating:</span>
                      <span className="text-foreground font-semibold inline-flex items-center gap-1">
                        {f.rating}
                        <Star
                          size={13}
                          className="fill-warning text-warning"
                        />
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onPress={() =>
                          handleResolveFeedback(f.id, 'approved')
                        }
                      >
                        Approve & reassign
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() =>
                          handleResolveFeedback(f.id, 'rejected')
                        }
                      >
                        Reject request
                      </Button>
                    </div>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        )
      ) : tab === 'tickets' ? (
        <>
          <Segment
            selectedKey={filter}
            onSelectionChange={(k) => setFilter(k as typeof filter)}
            size="sm"
          >
            <Segment.Item id="all">All · {tickets.length}</Segment.Item>
            <Segment.Item id="open">
              Open · {tickets.filter((t) => t.status === 'open').length}
            </Segment.Item>
            <Segment.Item id="in_progress">
              In progress ·{' '}
              {tickets.filter((t) => t.status === 'in_progress').length}
            </Segment.Item>
            <Segment.Item id="resolved">
              Resolved ·{' '}
              {tickets.filter((t) => t.status === 'resolved').length}
            </Segment.Item>
          </Segment>

          {filteredTickets.length === 0 ? (
            <Card>
              <Card.Content className="p-8">
                <EmptyState>
                  <EmptyState.Media>
                    <Inbox className="size-7" />
                  </EmptyState.Media>
                  <EmptyState.Title>No tickets found</EmptyState.Title>
                </EmptyState>
              </Card.Content>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <Card key={ticket.id}>
                  <Card.Content className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        {ticket.status === 'open' ? (
                          <Inbox size={14} className="text-accent" />
                        ) : ticket.status === 'in_progress' ? (
                          <Clock size={14} className="text-warning" />
                        ) : (
                          <CheckCircle2 size={14} className="text-success" />
                        )}
                        <div>
                          <span className="text-foreground text-sm font-semibold">
                            {ticket.sender_name}
                          </span>
                          <span className="text-muted text-xs ml-2">
                            {ticket.sender_email}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Chip
                          color={STATUS_COLOR[ticket.status] || 'default'}
                          variant="soft"
                          size="sm"
                        >
                          <Chip.Label className="capitalize">
                            {ticket.status.replace('_', ' ')}
                          </Chip.Label>
                        </Chip>
                        <span className="text-muted text-xs tabular-nums">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {ticket.subject && (
                      <p className="text-foreground text-sm font-semibold">
                        {ticket.subject}
                      </p>
                    )}
                    <p className="text-muted text-sm leading-relaxed">
                      {ticket.message}
                    </p>
                    {ticket.admin_reply && (
                      <Card className="bg-success-soft border-success/40">
                        <Card.Content className="p-3">
                          <Label className="text-success-soft-foreground text-xs font-medium uppercase tracking-wider block mb-1">
                            Admin reply
                          </Label>
                          <p className="text-success-soft-foreground text-sm">
                            {ticket.admin_reply}
                          </p>
                        </Card.Content>
                      </Card>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {ticket.status !== 'resolved' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onPress={() => {
                            setSelectedTicket(ticket);
                            setReplyText('');
                          }}
                        >
                          <Send size={12} /> Reply & resolve
                        </Button>
                      )}
                      {ticket.status === 'open' && (
                        <Button
                          variant="tertiary"
                          size="sm"
                          onPress={() =>
                            handleStatusChange(ticket.id, 'in_progress')
                          }
                        >
                          Mark in progress
                        </Button>
                      )}
                      {ticket.status !== 'open' &&
                        ticket.status !== 'resolved' && (
                          <Button
                            variant="tertiary"
                            size="sm"
                            onPress={() =>
                              handleStatusChange(ticket.id, 'resolved')
                            }
                          >
                            Mark resolved
                          </Button>
                        )}
                    </div>
                  </Card.Content>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        reviews.length === 0 ? (
          <Card>
            <Card.Content className="p-8">
              <EmptyState>
                <EmptyState.Media>
                  <Star className="size-7" />
                </EmptyState.Media>
                <EmptyState.Title>No reviews yet</EmptyState.Title>
              </EmptyState>
            </Card.Content>
          </Card>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => {
              const initial = (review.user_name?.[0] || 'U').toUpperCase();
              return (
                <Card
                  key={review.id}
                  className={!review.is_visible ? 'opacity-60' : ''}
                >
                  <Card.Content className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar size="md">
                          <Avatar.Fallback>{initial}</Avatar.Fallback>
                        </Avatar>
                        <div>
                          <span className="text-foreground text-sm font-semibold">
                            {review.user_name || 'Anonymous'}
                          </span>
                          <div className="inline-flex items-center gap-1 mt-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                size={12}
                                className={
                                  i <= review.rating
                                    ? 'text-warning fill-warning'
                                    : 'text-border'
                                }
                              />
                            ))}
                            <span className="text-muted text-xs ml-1">
                              {review.user_role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          aria-label={review.is_visible ? 'Hide' : 'Show'}
                          onPress={() => toggleReview(review.id)}
                        >
                          {review.is_visible ? (
                            <Eye size={13} />
                          ) : (
                            <EyeOff size={13} />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          aria-label="Delete"
                          className="!text-danger"
                          onPress={() => deleteReview(review.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                    <p className="text-foreground text-sm leading-relaxed mt-3">
                      {review.comment}
                    </p>
                    <span className="text-muted text-xs mt-2 block">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </Card.Content>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Reply modal */}
      <Modal
        isOpen={!!selectedTicket}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <div>
                  <Modal.Heading>Reply to ticket</Modal.Heading>
                  <p className="text-muted text-xs mt-0.5">
                    {selectedTicket?.sender_name} ·{' '}
                    {selectedTicket?.sender_email}
                  </p>
                </div>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-4">
                  <Card className="bg-surface-secondary">
                    <Card.Content className="p-4">
                      <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                        Original message
                      </Label>
                      <p className="text-foreground text-sm">
                        {selectedTicket?.message}
                      </p>
                    </Card.Content>
                  </Card>
                  <div>
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Your reply
                    </Label>
                    <TextArea
                      value={replyText}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setReplyText(e.target.value)
                      }
                      placeholder="Type your reply…"
                      rows={5}
                      className={`${fieldClass} resize-none`}
                    />
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="ghost"
                  onPress={() => setSelectedTicket(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  isDisabled={!replyText.trim()}
                  onPress={handleReply}
                >
                  <Send size={13} /> Send reply & resolve
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Create review modal */}
      <Modal
        isOpen={showCreateReview}
        onOpenChange={(open) => !open && setShowCreateReview(false)}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Create testimonial</Modal.Heading>
              </Modal.Header>
              <form id="create-review-form" onSubmit={handleCreateReview}>
                <Modal.Body>
                  <div className="space-y-4">
                    <TextField
                      value={newReview.user_name}
                      onChange={(v) =>
                        setNewReview({ ...newReview, user_name: v })
                      }
                      isRequired
                      aria-label="User name"
                    >
                      <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                        User name
                      </Label>
                      <Input className={fieldClass} placeholder="Jane Doe" />
                    </TextField>
                    <TextField
                      value={newReview.user_role}
                      onChange={(v) =>
                        setNewReview({ ...newReview, user_role: v })
                      }
                      isRequired
                      aria-label="Role"
                    >
                      <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                        Role / description
                      </Label>
                      <Input
                        className={fieldClass}
                        placeholder="Style creator (500k followers)"
                      />
                    </TextField>
                    <div>
                      <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                        Rating
                      </Label>
                      <select
                        value={newReview.rating}
                        onChange={(e) =>
                          setNewReview({
                            ...newReview,
                            rating: Number(e.target.value),
                          })
                        }
                        className={fieldClass}
                      >
                        <option value={5}>5 stars</option>
                        <option value={4}>4 stars</option>
                        <option value={3}>3 stars</option>
                        <option value={2}>2 stars</option>
                        <option value={1}>1 star</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                        Comment
                      </Label>
                      <TextArea
                        value={newReview.comment}
                        onChange={(
                          e: React.ChangeEvent<HTMLTextAreaElement>
                        ) =>
                          setNewReview({
                            ...newReview,
                            comment: e.target.value,
                          })
                        }
                        required
                        rows={4}
                        placeholder="CampaignHub is amazing…"
                        className={`${fieldClass} resize-none`}
                      />
                    </div>
                  </div>
                </Modal.Body>
              </form>
              <Modal.Footer>
                <Button
                  variant="ghost"
                  onPress={() => setShowCreateReview(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="create-review-form"
                  variant="primary"
                >
                  Create
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* KYC modal */}
      <Modal
        isOpen={!!kycModalUser}
        onOpenChange={(open) => !open && setKycModalUser(null)}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="!max-w-3xl">
              <Modal.Header>
                <div>
                  <Modal.Heading className="inline-flex items-center gap-2">
                    <ShieldCheck size={16} className="text-accent" />
                    KYC verification review
                  </Modal.Heading>
                  <p className="text-muted text-xs mt-0.5">
                    {kycModalUser?.email}
                  </p>
                </div>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-2">
                        Front of ID
                      </Label>
                      <div className="bg-surface-secondary rounded-xl border border-border aspect-video flex items-center justify-center overflow-hidden">
                        {kycModalUser?.kyc_id_front ? (
                          <img
                            src={kycModalUser.kyc_id_front}
                            alt="Front ID"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-muted text-sm font-medium">
                            No image
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-2">
                        Back of ID
                      </Label>
                      <div className="bg-surface-secondary rounded-xl border border-border aspect-video flex items-center justify-center overflow-hidden">
                        {kycModalUser?.kyc_id_back ? (
                          <img
                            src={kycModalUser.kyc_id_back}
                            alt="Back ID"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-muted text-sm font-medium">
                            No image
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-muted text-xs font-medium uppercase tracking-wider inline-flex items-center gap-1.5">
                        <Video size={11} /> Verification video
                      </Label>
                      <Chip color="success" variant="soft" size="sm">
                        <CheckCircle2 size={11} />
                        <Chip.Label>Motion checked</Chip.Label>
                      </Chip>
                    </div>
                    <div className="bg-overlay rounded-xl overflow-hidden border border-border aspect-video flex items-center justify-center">
                      {kycModalUser?.kyc_video_url ? (
                        <video
                          src={kycModalUser.kyc_video_url}
                          controls
                          autoPlay
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-muted text-sm font-medium">
                          No video uploaded
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="ghost"
                  className="!text-danger"
                  onPress={() => {
                    handleValidateUser(kycModalUser.id, 'rejected');
                    setKycModalUser(null);
                  }}
                >
                  <X size={13} /> Reject & disconnect
                </Button>
                <Button
                  variant="primary"
                  onPress={() => {
                    handleValidateUser(kycModalUser.id, 'active');
                    setKycModalUser(null);
                  }}
                >
                  <CheckCircle2 size={13} /> Approve & activate
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </PageShell>
  );
};

export default AdminSupport;
