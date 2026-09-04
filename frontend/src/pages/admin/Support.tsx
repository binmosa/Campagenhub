import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileCheck,
  Headphones,
  Inbox,
  MessageSquare,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  UserCheck,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { toast } from '../../lib/toast';
import { postedLabel } from '../../lib/campaignFormat';
import { fieldClass } from '../talent/shared';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { StoryAvatar } from '../../components/common/StoryAvatar';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Field, RoleChip, RowSkeletons, TICKET_COLOR, dateShort, userIdentity } from './shared';

/**
 * AdminSupport — the human-review desk. Four queues in one place:
 * identity validations (KYC), manager change requests from brands, support
 * tickets, and the testimonials shown on the landing page. Support agents
 * see the validation queue only.
 */
type Tab = 'validations' | 'changes' | 'tickets' | 'reviews';
type TicketFilter = 'all' | 'open' | 'in_progress' | 'resolved';

const Stars: React.FC<{ n: number; size?: number }> = ({ n, size = 12 }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${n}/5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={size} className={i <= n ? 'fill-warning text-warning' : ''} style={i <= n ? undefined : { color: 'var(--color-cool-gray)' }} />
    ))}
  </span>
);

const AdminSupport: React.FC = () => {
  const { t } = useTranslation();
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  const supportOnly = role === 'support';

  const [tab, setTab] = useState<Tab>('validations');
  const [tickets, setTickets] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>('all');

  const [replyTo, setReplyTo] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [kycUser, setKycUser] = useState<any>(null);
  const [confirm, setConfirm] = useState<{ kind: 'rejectUser' | 'deleteReview' | 'rejectChange'; item: any } | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [newReview, setNewReview] = useState({ user_name: '', user_role: '', rating: 5, comment: '' });

  const load = useCallback(async () => {
    setError(false);
    try {
      const arr = (r: any) => (Array.isArray(r?.data) ? r.data : []);
      if (supportOnly) {
        const pu = await api.get('/admin/users/pending').catch(() => ({ data: [] }));
        setPendingUsers(arr(pu));
      } else {
        const [tk, rv, st, pu, fb] = await Promise.all([
          api.get('/support/tickets').catch(() => ({ data: [] })),
          api.get('/reviews').catch(() => ({ data: [] })),
          api.get('/support/tickets/stats').catch(() => ({ data: {} })),
          api.get('/admin/users/pending').catch(() => ({ data: [] })),
          api.get('/managers/admin/feedback').catch(() => ({ data: [] })),
        ]);
        setTickets(arr(tk));
        setReviews(arr(rv));
        setStats(st.data || {});
        setPendingUsers(arr(pu));
        setChanges(arr(fb).filter((f: any) => f.status === 'pending'));
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [supportOnly]);
  useEffect(() => { load(); }, [load]);

  const run = async (id: string, fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || fail);
    } finally {
      setBusy(null);
    }
  };

  const validate = (u: any, status: 'active' | 'rejected') =>
    run(u.id, () => api.patch(`/admin/users/${u.id}/validate`, { status }), status === 'active' ? t('adm.sup.approved', { email: u.email }) : t('adm.sup.rejectedUser', { email: u.email }), t('adm.users.updateFailed'));

  const resolveChange = (f: any, status: 'approved' | 'rejected') =>
    run(f.id, () => api.patch(`/managers/admin/feedback/${f.id}/resolve`, { status }), status === 'approved' ? t('adm.sup.changeApproved') : t('adm.sup.changeRejected'), t('adm.users.updateFailed'));

  const setTicketStatus = (tk: any, status: string) =>
    run(tk.id, () => api.patch(`/support/tickets/${tk.id}/status`, { status }), t('adm.sup.ticketUpdated', { status: t(`adm.sup.tStatus.${status}`) }), t('adm.users.updateFailed'));

  const sendReply = async () => {
    if (!replyTo || !replyText.trim()) return;
    await run(replyTo.id, () => api.patch(`/support/tickets/${replyTo.id}/reply`, { reply: replyText.trim(), status: 'resolved' }), t('adm.sup.replied', { name: replyTo.sender_name }), t('adm.sup.replyFailed'));
    setReplyTo(null);
    setReplyText('');
  };

  const toggleReview = (r: any) =>
    run(r.id, () => api.patch(`/reviews/${r.id}/toggle`), r.is_visible ? t('adm.sup.reviewHidden') : t('adm.sup.reviewShown'), t('adm.users.updateFailed'));

  const createReview = async (e: React.FormEvent) => {
    e.preventDefault();
    await run('newReview', () => api.post('/public/reviews', newReview), t('adm.sup.reviewCreated'), t('adm.sup.reviewFailed'));
    setShowReview(false);
    setNewReview({ user_name: '', user_role: '', rating: 5, comment: '' });
  };

  const onConfirm = async () => {
    if (!confirm) return;
    const { kind, item } = confirm;
    if (kind === 'rejectUser') await validate(item, 'rejected');
    if (kind === 'rejectChange') await resolveChange(item, 'rejected');
    if (kind === 'deleteReview') await run(item.id, () => api.delete(`/reviews/${item.id}`), t('adm.sup.reviewDeleted'), t('adm.users.updateFailed'));
    setConfirm(null);
    if (kind === 'rejectUser') setKycUser(null);
  };

  const ticketCounts = useMemo(() => ({
    open: tickets.filter((x) => x.status === 'open').length,
    in_progress: tickets.filter((x) => x.status === 'in_progress').length,
    resolved: tickets.filter((x) => x.status === 'resolved').length,
  }), [tickets]);
  const shownTickets = ticketFilter === 'all' ? tickets : tickets.filter((x) => x.status === ticketFilter);

  const kpis = supportOnly ? (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard label={t('adm.sup.kpiValidations')} value={pendingUsers.length} hint={t('adm.sup.kpiValidationsHint')} icon={UserCheck} iconStatus={pendingUsers.length ? 'warning' : 'success'} />
      <MetricCard label={t('adm.sup.kpiDocs')} value={pendingUsers.filter((u) => u.kyc_video_url || u.kyc_id_front || u.identity_document).length} hint={t('adm.sup.kpiDocsHint')} icon={FileCheck} />
    </div>
  ) : (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label={t('adm.sup.kpiOpen')} value={stats.open || 0} hint={t('adm.sup.kpiOpenHint')} icon={Inbox} iconStatus={stats.open ? 'warning' : 'success'} />
      <MetricCard label={t('adm.sup.tStatus.in_progress')} value={stats.inProgress || 0} hint={t('adm.sup.kpiProgressHint')} icon={Clock} />
      <MetricCard label={t('adm.sup.tStatus.resolved')} value={stats.resolved || 0} hint={t('adm.sup.kpiResolvedHint', { n: stats.total || 0 })} icon={CheckCircle2} iconStatus="success" />
      <MetricCard label={t('adm.sup.kpiValidations')} value={pendingUsers.length + changes.length} hint={t('adm.sup.kpiValidationsHint2', { n: changes.length })} icon={UserCheck} iconStatus={pendingUsers.length + changes.length ? 'warning' : 'success'} />
    </div>
  );

  const docChips = (u: any) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {u.kyc_id_front && <Chip color="default" variant="soft" size="sm"><FileCheck size={11} /><Chip.Label>{t('adm.sup.idFront')}</Chip.Label></Chip>}
      {u.kyc_id_back && <Chip color="default" variant="soft" size="sm"><FileCheck size={11} /><Chip.Label>{t('adm.sup.idBack')}</Chip.Label></Chip>}
      {u.kyc_video_url && <Chip color="success" variant="soft" size="sm"><Video size={11} /><Chip.Label>{t('adm.sup.video')}</Chip.Label></Chip>}
      {u.identity_document && <Chip color="default" variant="soft" size="sm"><FileCheck size={11} /><Chip.Label>{t('adm.sup.legacyDoc')}</Chip.Label></Chip>}
      {!u.kyc_id_front && !u.kyc_id_back && !u.kyc_video_url && !u.identity_document && (
        <Chip color="danger" variant="soft" size="sm"><AlertTriangle size={11} /><Chip.Label>{t('adm.sup.noDocs')}</Chip.Label></Chip>
      )}
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={supportOnly ? t('adm.sup.titleSupport') : t('adm.sup.title')}
      titleAccent={t('adm.sup.titleAccent')}
      description={supportOnly ? t('adm.sup.descSupport') : t('adm.sup.desc')}
      icon={<Headphones size={18} />}
      actions={!supportOnly && tab === 'reviews' ? <Button variant="primary" size="md" onPress={() => setShowReview(true)}><Star size={13} /> {t('adm.sup.createReview')}</Button> : undefined}
      stats={kpis}
    >
      {!supportOnly && (
        <Segment size="md" selectedKey={tab} onSelectionChange={(k) => setTab(k as Tab)} aria-label={t('adm.sup.queues')}>
          <Segment.Item id="validations">{t('adm.sup.tabValidations')} · {pendingUsers.length}</Segment.Item>
          <Segment.Item id="changes">{t('adm.sup.tabChanges')} · {changes.length}</Segment.Item>
          <Segment.Item id="tickets">{t('adm.sup.tabTickets')} · {tickets.length}</Segment.Item>
          <Segment.Item id="reviews">{t('adm.sup.tabReviews')} · {reviews.length}</Segment.Item>
        </Segment>
      )}

      {loading ? (
        <RowSkeletons n={4} />
      ) : error ? (
        <EmptyPanel tone="error" icon={<AlertTriangle size={22} />} title={t('adm.errTitle')} description={t('adm.errDesc')} actions={<Button variant="primary" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>} />
      ) : tab === 'validations' ? (
        pendingUsers.length === 0 ? (
          <EmptyPanel tone="success" icon={<ShieldCheck size={22} />} title={t('adm.sup.noValidationsTitle')} description={t('adm.sup.noValidationsDesc')} />
        ) : (
          <ul className="space-y-3">
            {pendingUsers.map((u) => {
              const who = userIdentity(u);
              const rowBusy = busy === u.id;
              return (
                <li key={u.id} className="v-talent-card p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <StoryAvatar src={who.avatar} name={who.name || u.email} seed={u.id} size={44} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="v-ink font-medium truncate" style={{ fontSize: 14.5 }}>{who.name || u.email.split('@')[0]}</span>
                        <RoleChip role={u.role} />
                      </div>
                      <div className="v-caption v-quiet truncate mt-0.5" style={{ fontSize: 12 }}>
                        {u.email} · {t('adm.sup.submitted', { when: postedLabel(u.created_at) })}
                      </div>
                      <div className="mt-2">{docChips(u)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {(u.kyc_video_url || u.kyc_id_front || u.kyc_id_back) && (
                      <Button variant="tertiary" size="sm" onPress={() => setKycUser(u)}><Eye size={12} /> {t('adm.sup.review')}</Button>
                    )}
                    {u.identity_document && (
                      <a href={u.identity_document} download={`identity_${u.id}`}>
                        <Button variant="tertiary" size="sm"><FileCheck size={12} /> {t('adm.sup.legacyDoc')}</Button>
                      </a>
                    )}
                    <Button variant="primary" size="sm" isPending={rowBusy} onPress={() => validate(u, 'active')}><CheckCircle2 size={12} /> {t('adm.sup.approve')}</Button>
                    <Button variant="ghost" size="sm" className="!text-danger" isPending={rowBusy} onPress={() => setConfirm({ kind: 'rejectUser', item: u })}><X size={12} /> {t('adm.sup.reject')}</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : tab === 'changes' ? (
        changes.length === 0 ? (
          <EmptyPanel tone="success" icon={<Users size={22} />} title={t('adm.sup.noChangesTitle')} description={t('adm.sup.noChangesDesc')} />
        ) : (
          <ul className="space-y-3">
            {changes.map((f) => {
              const brand = userIdentity(f.brand);
              const mgr = userIdentity(f.manager);
              return (
                <li key={f.id} className="v-talent-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <StoryAvatar src={brand.avatar} name={brand.name || f.brand?.email} seed={f.brand?.id || f.id} size={40} />
                      <div className="min-w-0">
                        <div className="v-ink font-medium truncate" style={{ fontSize: 14.5 }}>{t('adm.sup.changeFrom', { brand: brand.name || f.brand?.email })}</div>
                        <div className="v-caption v-quiet truncate" style={{ fontSize: 12 }}>
                          {t('adm.sup.currentManager', { manager: mgr.name || f.manager?.email })} · {postedLabel(f.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Stars n={Number(f.rating) || 0} />
                      <Chip color="danger" variant="soft" size="sm"><AlertTriangle size={11} /><Chip.Label>{t('adm.sup.complaint')}</Chip.Label></Chip>
                    </div>
                  </div>
                  <blockquote className="rounded-xl px-4 py-3 v-body v-ink" style={{ background: 'var(--color-cool-gray)', fontSize: 13.5, fontStyle: 'italic' }}>“{f.feedback_text}”</blockquote>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Button variant="ghost" size="sm" isPending={busy === f.id} onPress={() => setConfirm({ kind: 'rejectChange', item: f })}>{t('adm.sup.rejectChange')}</Button>
                    <Button variant="primary" size="sm" isPending={busy === f.id} onPress={() => resolveChange(f, 'approved')}><CheckCircle2 size={12} /> {t('adm.sup.approveChange')}</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : tab === 'tickets' ? (
        <>
          <Segment size="sm" selectedKey={ticketFilter} onSelectionChange={(k) => setTicketFilter(k as TicketFilter)} aria-label={t('adm.users.statusFilter')}>
            <Segment.Item id="all">{t('dash.all')} · {tickets.length}</Segment.Item>
            <Segment.Item id="open">{t('adm.sup.tStatus.open')} · {ticketCounts.open}</Segment.Item>
            <Segment.Item id="in_progress">{t('adm.sup.tStatus.in_progress')} · {ticketCounts.in_progress}</Segment.Item>
            <Segment.Item id="resolved">{t('adm.sup.tStatus.resolved')} · {ticketCounts.resolved}</Segment.Item>
          </Segment>
          {shownTickets.length === 0 ? (
            <EmptyPanel tone={tickets.length === 0 || ticketFilter === 'open' ? 'success' : 'neutral'} icon={<Inbox size={22} />} title={tickets.length === 0 ? t('adm.sup.noTicketsTitle') : t('common.noMatches')} description={tickets.length === 0 ? t('adm.sup.noTicketsDesc') : t('board.emptyStatus')} />
          ) : (
            <ul className="space-y-3">
              {shownTickets.map((tk) => (
                <li key={tk.id} className="v-talent-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <StoryAvatar name={tk.sender_name || tk.sender_email} seed={tk.sender_email || tk.id} size={40} />
                      <div className="min-w-0">
                        <div className="v-ink font-medium truncate" style={{ fontSize: 14.5 }}>{tk.subject || t('adm.sup.noSubject')}</div>
                        <div className="v-caption v-quiet truncate" style={{ fontSize: 12 }}>{tk.sender_name} · {tk.sender_email} · {postedLabel(tk.created_at)}</div>
                      </div>
                    </div>
                    <Chip color={TICKET_COLOR[tk.status] || 'default'} variant="soft" size="sm">
                      {tk.status === 'open' ? <Inbox size={11} /> : tk.status === 'in_progress' ? <Clock size={11} /> : <CheckCircle2 size={11} />}
                      <Chip.Label>{t(`adm.sup.tStatus.${tk.status}`, { defaultValue: tk.status })}</Chip.Label>
                    </Chip>
                  </div>
                  <p className="v-body v-ink whitespace-pre-wrap" style={{ fontSize: 13.5 }}>{tk.message}</p>
                  {tk.admin_reply && (
                    <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(22,199,132,0.10)', border: '1px solid rgba(22,199,132,0.28)' }}>
                      <div className="v-caption font-medium uppercase tracking-wider mb-1 inline-flex items-center gap-1.5" style={{ fontSize: 10.5, color: '#0b6e3e' }}><MessageSquare size={11} /> {t('adm.sup.ourReply')}</div>
                      <p className="v-body whitespace-pre-wrap" style={{ fontSize: 13, color: '#0b6e3e' }}>{tk.admin_reply}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {tk.status !== 'resolved' && (
                      <Button variant="primary" size="sm" onPress={() => { setReplyTo(tk); setReplyText(''); }}><Send size={12} /> {t('adm.sup.replyResolve')}</Button>
                    )}
                    {tk.status === 'open' && (
                      <Button variant="tertiary" size="sm" isPending={busy === tk.id} onPress={() => setTicketStatus(tk, 'in_progress')}><Clock size={12} /> {t('adm.sup.markProgress')}</Button>
                    )}
                    {tk.status === 'in_progress' && (
                      <Button variant="tertiary" size="sm" isPending={busy === tk.id} onPress={() => setTicketStatus(tk, 'resolved')}><CheckCircle2 size={12} /> {t('adm.sup.markResolved')}</Button>
                    )}
                    {tk.status === 'resolved' && (
                      <Button variant="ghost" size="sm" isPending={busy === tk.id} onPress={() => setTicketStatus(tk, 'open')}>{t('adm.sup.reopen')}</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : reviews.length === 0 ? (
        <EmptyPanel icon={<Star size={22} />} title={t('adm.sup.noReviewsTitle')} description={t('adm.sup.noReviewsDesc')} actions={<Button variant="primary" onPress={() => setShowReview(true)}><Star size={13} /> {t('adm.sup.createReview')}</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {reviews.map((r) => (
            <article key={r.id} className="v-talent-card p-4 flex flex-col" style={r.is_visible ? undefined : { opacity: 0.6 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <StoryAvatar name={r.user_name || 'A'} seed={r.id} size={40} />
                  <div className="min-w-0">
                    <div className="v-ink font-medium truncate" style={{ fontSize: 14 }}>{r.user_name || t('adm.sup.anonymous')}</div>
                    <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>{r.user_role || '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" isIconOnly aria-label={r.is_visible ? t('adm.sup.hide') : t('adm.sup.show')} isPending={busy === r.id} onPress={() => toggleReview(r)}>
                    {r.is_visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </Button>
                  <Button variant="ghost" size="sm" isIconOnly aria-label={t('adm.sup.deleteReview')} className="!text-danger" onPress={() => setConfirm({ kind: 'deleteReview', item: r })}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
              <div className="mt-2"><Stars n={Number(r.rating) || 0} /></div>
              <p className="v-body v-ink mt-2 flex-1" style={{ fontSize: 13.5, lineHeight: 1.5 }}>“{r.comment}”</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="v-caption v-quiet" style={{ fontSize: 11 }}>{dateShort(r.created_at)}</span>
                <Chip color={r.is_visible ? 'success' : 'default'} variant="soft" size="sm">
                  <Chip.Label>{r.is_visible ? t('adm.sup.visible') : t('adm.sup.hidden')}</Chip.Label>
                </Chip>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Reply */}
      <Modal isOpen={!!replyTo} onOpenChange={(o) => !o && setReplyTo(null)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="!max-w-lg">
              <Modal.CloseTrigger />
              <Modal.Header>
                <div>
                  <Modal.Heading>{t('adm.sup.replyTitle')}</Modal.Heading>
                  <p className="v-caption v-quiet mt-0.5" style={{ fontSize: 12 }}>{replyTo?.sender_name} · {replyTo?.sender_email}</p>
                </div>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-4">
                  <div className="rounded-xl px-4 py-3" style={{ background: 'var(--color-cool-gray)' }}>
                    <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-1" style={{ fontSize: 10.5 }}>{replyTo?.subject || t('adm.sup.original')}</div>
                    <p className="v-body v-ink whitespace-pre-wrap" style={{ fontSize: 13 }}>{replyTo?.message}</p>
                  </div>
                  <Field label={t('adm.sup.yourReply')} hint={t('adm.sup.replyHint')}>
                    <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={5} className={`${fieldClass} resize-y`} placeholder={t('adm.sup.replyPh')} autoFocus />
                  </Field>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setReplyTo(null)}>{t('common.cancel')}</Button>
                <Button variant="primary" isDisabled={!replyText.trim()} isPending={busy === replyTo?.id} onPress={sendReply}><Send size={13} /> {t('adm.sup.sendReply')}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Create testimonial */}
      <Modal isOpen={showReview} onOpenChange={(o) => !o && setShowReview(false)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="!max-w-lg">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="inline-flex items-center gap-2"><Star size={16} style={{ color: 'var(--color-campaign-purple)' }} /> {t('adm.sup.createReview')}</Modal.Heading>
              </Modal.Header>
              <form id="create-review-form" onSubmit={createReview}>
                <Modal.Body>
                  <div className="space-y-4">
                    <p className="v-caption v-quiet" style={{ fontSize: 12.5 }}>{t('adm.sup.reviewIntro')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label={t('adm.sup.fName')}>
                        <input required value={newReview.user_name} onChange={(e) => setNewReview({ ...newReview, user_name: e.target.value })} className={fieldClass} placeholder="Meron Haile" />
                      </Field>
                      <Field label={t('adm.sup.fRole')}>
                        <input required value={newReview.user_role} onChange={(e) => setNewReview({ ...newReview, user_role: e.target.value })} className={fieldClass} placeholder={t('adm.sup.fRolePh')} />
                      </Field>
                    </div>
                    <div>
                      <span className="v-caption v-ink font-medium block mb-1" style={{ fontSize: 12 }}>{t('adm.sup.fRating')}</span>
                      <div className="flex items-center gap-1" role="radiogroup" aria-label={t('adm.sup.fRating')}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" role="radio" aria-checked={newReview.rating === n} aria-label={`${n}`} onClick={() => setNewReview({ ...newReview, rating: n })} className="p-1">
                            <Star size={22} className={n <= newReview.rating ? 'fill-warning text-warning' : ''} style={n <= newReview.rating ? undefined : { color: 'var(--color-cool-gray)' }} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <Field label={t('adm.sup.fComment')}>
                      <textarea required rows={4} value={newReview.comment} onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })} className={`${fieldClass} resize-y`} placeholder={t('adm.sup.fCommentPh')} />
                    </Field>
                  </div>
                </Modal.Body>
              </form>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setShowReview(false)}>{t('common.cancel')}</Button>
                <Button type="submit" form="create-review-form" variant="primary" isPending={busy === 'newReview'}>{t('adm.sup.publishReview')}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* KYC review */}
      <Modal isOpen={!!kycUser} onOpenChange={(o) => !o && setKycUser(null)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="!max-w-3xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <div className="flex items-center gap-3 min-w-0 pr-8">
                  <StoryAvatar src={userIdentity(kycUser).avatar} name={userIdentity(kycUser).name || kycUser?.email} seed={kycUser?.id || 'k'} size={40} />
                  <div className="min-w-0">
                    <Modal.Heading className="inline-flex items-center gap-2 truncate"><ShieldCheck size={16} style={{ color: 'var(--color-campaign-purple)' }} /> {t('adm.sup.kycTitle')}</Modal.Heading>
                    <p className="v-caption v-quiet truncate" style={{ fontSize: 12 }}>{kycUser?.email} · {t(`adm.roles.${kycUser?.role}`, { defaultValue: kycUser?.role })}</p>
                  </div>
                </div>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[['kyc_id_front', t('adm.sup.idFront')], ['kyc_id_back', t('adm.sup.idBack')]].map(([k, label]) => (
                      <div key={k}>
                        <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-1.5" style={{ fontSize: 10.5 }}>{label}</div>
                        <div className="rounded-xl v-hairline aspect-video flex items-center justify-center overflow-hidden" style={{ background: 'var(--color-cool-gray)' }}>
                          {kycUser?.[k] ? <img src={kycUser[k]} alt={label} className="w-full h-full object-contain" /> : <span className="v-caption v-quiet">{t('adm.sup.noImage')}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-1.5 inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}><Video size={11} /> {t('adm.sup.video')}</div>
                    <div className="rounded-xl v-hairline aspect-video flex items-center justify-center overflow-hidden" style={{ background: '#0b1736' }}>
                      {kycUser?.kyc_video_url ? <video src={kycUser.kyc_video_url} controls className="w-full h-full object-contain" /> : <span className="v-caption" style={{ color: '#fff', opacity: 0.7 }}>{t('adm.sup.noVideo')}</span>}
                    </div>
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" className="!text-danger" onPress={() => setConfirm({ kind: 'rejectUser', item: kycUser })}><X size={13} /> {t('adm.sup.rejectDisconnect')}</Button>
                <Button variant="primary" isPending={busy === kycUser?.id} onPress={async () => { await validate(kycUser, 'active'); setKycUser(null); }}><CheckCircle2 size={13} /> {t('adm.sup.approveActivate')}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmModal
        open={!!confirm}
        tone="danger"
        pending={!!confirm && busy === confirm.item.id}
        title={confirm?.kind === 'rejectUser' ? t('adm.sup.rejectUserTitle') : confirm?.kind === 'rejectChange' ? t('adm.sup.rejectChangeTitle') : t('adm.sup.deleteReviewTitle')}
        body={confirm?.kind === 'rejectUser' ? t('adm.sup.rejectUserBody', { email: confirm.item.email }) : confirm?.kind === 'rejectChange' ? t('adm.sup.rejectChangeBody') : t('adm.sup.deleteReviewBody', { name: confirm?.item.user_name })}
        confirmLabel={confirm?.kind === 'deleteReview' ? t('adm.sup.deleteReview') : t('adm.sup.reject')}
        onConfirm={onConfirm}
        onClose={() => setConfirm(null)}
      />
    </PageShell>
  );
};

export default AdminSupport;
