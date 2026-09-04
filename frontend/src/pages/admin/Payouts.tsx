import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  Landmark,
  Send,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { toast } from '../../lib/toast';
import { weekSums } from '../../lib/series';
import { postedLabel } from '../../lib/campaignFormat';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { DirectoryToolbar } from '../../components/common/filters';
import { StoryAvatar } from '../../components/common/StoryAvatar';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Fact, PAYOUT_COLOR, Panel, RowSkeletons, SectionTitle, dateShort, dateTime, money, userIdentity } from './shared';

/**
 * AdminPayouts — the money desk for admin and finance: brand escrow on
 * top, the payout queue in the middle (approve → execute → paid), and the
 * staff audit trail underneath. Executing a transfer always confirms.
 */
type Payout = {
  id: string;
  status: string;
  amount: number | string;
  created_at: string;
  tx_ref?: string | null;
  campaign?: { id?: string; title?: string; currency?: string };
  creator?: any;
  payoutAccount?: {
    account_type?: string;
    bank_name?: string;
    account_number?: string;
    account_name?: string;
    bank_code?: string;
    currency?: string;
    mobile_number?: string;
    mobile_network?: string;
    is_verified?: boolean;
    country?: string;
  } | null;
};
type Balance = { brandId: string; brandEmail: string; deposited: number | string; committed: number | string; available: number | string };
type StatusFilter = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';
const STATUSES: StatusFilter[] = ['pending', 'approved', 'paid', 'rejected'];
const PAGE = 30;

const AdminPayouts: React.FC = () => {
  const { t } = useTranslation();
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  const isAdmin = role === 'admin';

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<Payout | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'execute' | 'reject' | 'approve'; payout: Payout } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(false);
    Promise.all([
      api.get('/admin/payouts'),
      api.get('/admin/brand-balances').catch(() => ({ data: [] })),
      isAdmin ? api.get('/admin/audit-logs').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ])
      .then(([p, b, a]) => {
        setPayouts(Array.isArray(p.data) ? p.data : []);
        setBalances(Array.isArray(b.data) ? b.data : []);
        setAudit(Array.isArray(a.data) ? a.data : []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isAdmin]);
  useEffect(load, [load]);

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    let paidVolume = 0;
    for (const p of payouts) {
      by[p.status] = (by[p.status] || 0) + 1;
      if (p.status === 'paid') paidVolume += Number(p.amount) || 0;
    }
    const escrow = balances.reduce((s, b) => s + (Number(b.available) || 0), 0);
    const deposited = balances.reduce((s, b) => s + (Number(b.deposited) || 0), 0);
    return { by, paidVolume, escrow, deposited };
  }, [payouts, balances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payouts.filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (!q) return true;
      const who = userIdentity(p.creator);
      return [p.creator?.email, who.name, p.campaign?.title, p.status, p.tx_ref].some((s) => String(s || '').toLowerCase().includes(q));
    });
  }, [payouts, search, status]);
  const shown = filtered.slice(0, limit);

  const setStatusOf = async (p: Payout, next: 'approved' | 'rejected') => {
    setBusy(p.id);
    try {
      await api.patch(`/admin/payouts/${p.id}`, { status: next });
      setPayouts((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next } : x)));
      if (detail?.id === p.id) setDetail((d) => (d ? { ...d, status: next } : d));
      toast.success(next === 'approved' ? t('adm.pay.approved', { amount: money(p.amount) }) : t('adm.pay.rejected', { amount: money(p.amount) }));
      if (isAdmin) api.get('/admin/audit-logs').then((r) => setAudit(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('adm.pay.updateFailed'));
    } finally {
      setBusy(null);
    }
  };

  const execute = async (p: Payout) => {
    setBusy(p.id);
    try {
      await api.post(`/admin/payouts/${p.id}/execute`);
      setPayouts((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: 'paid' } : x)));
      if (detail?.id === p.id) setDetail((d) => (d ? { ...d, status: 'paid' } : d));
      toast.success(t('adm.pay.executed', { amount: money(p.amount) }));
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('adm.pay.executeFailed'));
    } finally {
      setBusy(null);
    }
  };

  const onConfirm = async () => {
    if (!confirm) return;
    const { kind, payout } = confirm;
    if (kind === 'execute') await execute(payout);
    if (kind === 'reject') await setStatusOf(payout, 'rejected');
    if (kind === 'approve') await setStatusOf(payout, 'approved');
    setConfirm(null);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const accountChip = (p: Payout) => {
    const a = p.payoutAccount;
    if (!a || (!a.account_number && !a.mobile_number)) {
      return <Chip color="danger" variant="soft" size="sm"><AlertTriangle size={11} /><Chip.Label>{t('adm.pay.noAccount')}</Chip.Label></Chip>;
    }
    if (a.mobile_number && !a.account_number) {
      return <Chip color="default" variant="soft" size="sm"><Smartphone size={11} /><Chip.Label>{a.mobile_network || t('adm.pay.mobileMoney')}</Chip.Label></Chip>;
    }
    return (
      <Chip color={a.is_verified ? 'success' : 'default'} variant="soft" size="sm">
        {a.is_verified ? <CheckCircle2 size={11} /> : <Landmark size={11} />}
        <Chip.Label>{a.bank_name || t('adm.pay.bank')}{a.is_verified ? ` · ${t('adm.pay.verified')}` : ''}</Chip.Label>
      </Chip>
    );
  };

  const actions = (p: Payout, full = false) => {
    const pending = busy === p.id;
    return (
      <div className={`flex items-center gap-1.5 flex-wrap ${full ? '' : 'lg:justify-end'}`}>
        {!full && <Button variant="ghost" size="sm" className="!px-2.5" onPress={() => setDetail(p)}>{t('adm.pay.details')}</Button>}
        {isAdmin && p.status === 'pending' && (
          <Button variant="primary" size="sm" className="!px-2.5" isPending={pending} onPress={() => setConfirm({ kind: 'approve', payout: p })}>
            <Check size={11} /> {t('adm.pay.approve')}
          </Button>
        )}
        {p.status === 'approved' && (
          <Button variant="primary" size="sm" className="!px-2.5" isPending={pending} onPress={() => setConfirm({ kind: 'execute', payout: p })}>
            <Send size={11} /> {t('adm.pay.execute')}
          </Button>
        )}
        {p.status !== 'paid' && p.status !== 'rejected' && (
          <Button variant="ghost" size="sm" className="!px-2.5 !text-danger" isPending={pending} onPress={() => setConfirm({ kind: 'reject', payout: p })}>
            <XCircle size={11} /> {t('adm.pay.reject')}
          </Button>
        )}
      </div>
    );
  };

  const CopyRow: React.FC<{ label: string; value?: string; k: string }> = ({ label, value, k }) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="v-caption v-quiet" style={{ fontSize: 11 }}>{label}</div>
        <div className="v-ink font-medium truncate" style={{ fontSize: 13 }}>{value || t('adm.pay.notSet')}</div>
      </div>
      {value && (
        <Button variant="tertiary" size="sm" onPress={() => copy(value, k)}>
          {copied === k ? <><Check size={11} /> {t('adm.pay.copied')}</> : <><Copy size={11} /> {t('adm.pay.copy')}</>}
        </Button>
      )}
    </div>
  );

  const stats = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label={t('adm.pay.kpiPending')} value={counts.by.pending || 0} hint={t('adm.pay.kpiPendingHint')} icon={Clock} iconStatus={counts.by.pending ? 'warning' : undefined} />
      <MetricCard label={t('adm.pay.kpiApproved')} value={counts.by.approved || 0} hint={t('adm.pay.kpiApprovedHint')} icon={Send} iconStatus={counts.by.approved ? 'warning' : undefined} />
      <MetricCard label={t('adm.pay.kpiPaid')} value={money(counts.paidVolume)} hint={t('adm.pay.kpiPaidHint', { n: counts.by.paid || 0 })} series={weekSums(payouts, (p) => p.status === 'paid')} chartColor="var(--color-signal-green, #16c784)" icon={DollarSign} iconStatus="success" />
      <MetricCard label={t('adm.pay.kpiEscrow')} value={money(counts.escrow)} hint={t('adm.pay.kpiEscrowHint', { v: money(counts.deposited) })} icon={Wallet} />
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('adm.pay.title')}
      titleAccent={t('adm.pay.titleAccent')}
      description={t('adm.pay.desc')}
      icon={<DollarSign size={18} />}
      actions={
        <a href="https://app.flutterwave.com/dashboard/payments/transfers/new/" target="_blank" rel="noopener noreferrer">
          <Button variant="tertiary" size="md"><ExternalLink size={13} /> {t('adm.pay.flutterwave')}</Button>
        </a>
      }
      stats={stats}
    >
      {error && (
        <EmptyPanel tone="error" size="sm" icon={<AlertTriangle size={20} />} title={t('adm.errTitle')} description={t('adm.errDesc')} actions={<Button variant="primary" size="sm" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>} />
      )}

      {/* Brand escrow */}
      <div>
        <SectionTitle icon={<Building2 size={15} />}>{t('adm.pay.escrow')}</SectionTitle>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="v-talent-card p-4"><div className="v-skel h-4 w-1/2 mb-3" /><div className="v-skel h-3 w-full" /></div>)}</div>
        ) : balances.length === 0 ? (
          <EmptyPanel size="sm" icon={<Building2 size={18} />} title={t('adm.pay.noEscrowTitle')} description={t('adm.pay.noEscrowDesc')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {balances.map((b) => {
              const dep = Number(b.deposited) || 0;
              const com = Number(b.committed) || 0;
              const pct = dep ? Math.min(100, Math.round((com / dep) * 100)) : 0;
              return (
                <article key={b.brandId} className="v-talent-card p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <StoryAvatar name={b.brandEmail} seed={b.brandId} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{b.brandEmail}</div>
                      <div className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('adm.pay.committedPct', { pct })}</div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mt-3" style={{ background: 'var(--color-cool-gray)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--gradient-signature)' }} />
                  </div>
                  <dl className="grid grid-cols-3 gap-2 mt-3">
                    <Fact label={t('adm.pay.deposited')}>{money(dep)}</Fact>
                    <Fact label={t('adm.pay.committed')}>{money(com)}</Fact>
                    <Fact label={t('adm.pay.available')}><span style={{ color: '#0b6e3e' }}>{money(b.available)}</span></Fact>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Queue */}
      <div>
        <SectionTitle icon={<CreditCard size={15} />}>{t('adm.pay.queue')}</SectionTitle>
        <DirectoryToolbar
          search={{ value: search, onChange: setSearch, placeholder: t('adm.pay.searchPh'), widthClass: 'w-full sm:w-[300px]' }}
          count={t('adm.pay.count', { shown: shown.length, total: filtered.length })}
        >
          <Segment size="sm" selectedKey={status} onSelectionChange={(k) => { setStatus(k as StatusFilter); setLimit(PAGE); }} aria-label={t('adm.users.statusFilter')}>
            <Segment.Item id="all">{t('dash.all')} · {payouts.length}</Segment.Item>
            {STATUSES.map((s) => (
              <Segment.Item key={s} id={s}>{t(`adm.pay.status.${s}`)} · {counts.by[s] || 0}</Segment.Item>
            ))}
          </Segment>
        </DirectoryToolbar>

        {loading ? (
          <RowSkeletons n={4} />
        ) : filtered.length === 0 ? (
          <EmptyPanel
            tone={payouts.length === 0 ? 'neutral' : status === 'pending' ? 'success' : 'neutral'}
            icon={<DollarSign size={22} />}
            title={payouts.length === 0 ? t('adm.pay.emptyTitle') : status === 'pending' ? t('adm.pay.clearTitle') : t('common.noMatches')}
            description={payouts.length === 0 ? t('adm.pay.emptyDesc') : status === 'pending' ? t('adm.pay.clearDesc') : t('board.emptyStatus')}
            actions={payouts.length > 0 && (search || status !== 'all') ? <Button variant="tertiary" onPress={() => { setSearch(''); setStatus('all'); }}>{t('board.resetFilters')}</Button> : undefined}
          />
        ) : (
          <>
            <ul className="space-y-3">
              {shown.map((p) => {
                const who = userIdentity(p.creator);
                return (
                  <li key={p.id} className="v-talent-card p-4 grid grid-cols-1 lg:grid-cols-[minmax(220px,1.3fr)_minmax(140px,0.8fr)_auto_minmax(260px,1fr)] gap-4 items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <StoryAvatar src={who.avatar} name={who.name || p.creator?.email} seed={p.creator?.id || p.id} size={44} />
                      <div className="min-w-0">
                        <div className="v-ink font-medium truncate" style={{ fontSize: 14.5 }}>{who.name || p.creator?.email}</div>
                        <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                          {p.creator?.email} · {p.campaign?.title || t('adm.pay.direct')} · {postedLabel(p.created_at)}
                        </div>
                        <div className="mt-1.5">{accountChip(p)}</div>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="v-ink font-medium tabular-nums" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>{money(p.amount)}</div>
                      {p.tx_ref && <div className="v-caption v-quiet truncate" style={{ fontSize: 11 }}>{p.tx_ref}</div>}
                    </div>
                    <Chip color={PAYOUT_COLOR[p.status] || 'default'} variant="soft" size="sm">
                      <Chip.Label>{t(`adm.pay.status.${p.status}`, { defaultValue: p.status })}</Chip.Label>
                    </Chip>
                    {actions(p)}
                  </li>
                );
              })}
            </ul>
            {filtered.length > shown.length && (
              <div className="flex justify-center mt-6">
                <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="v-facet-btn !px-4 !py-2.5">
                  {t('common.loadMore', { n: filtered.length - shown.length })}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Audit trail */}
      {isAdmin && (
        <Panel icon={<ClipboardList size={15} />} title={t('adm.pay.audit')} desc={t('adm.pay.auditDesc')}>
          {!loading && audit.length === 0 ? (
            <p className="v-caption v-quiet" style={{ fontSize: 12.5 }}>{t('adm.dash.noActivity')}</p>
          ) : (
            <ol className="relative pl-5" style={{ borderLeft: '2px solid var(--color-cool-gray)' }}>
              {audit.slice(0, 25).map((l) => {
                let d: any = {};
                try { d = JSON.parse(l.details || '{}'); } catch { /* raw */ }
                const tone = l.action === 'EXECUTED_PAYOUT' ? '#16c784' : l.action === 'REJECTED_PAYOUT' ? '#ff5a5f' : '#6c63ff';
                return (
                  <li key={l.id} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[27px] top-1 inline-block h-3 w-3 rounded-full" style={{ background: tone, boxShadow: '0 0 0 3px var(--color-paper)' }} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="v-ink font-medium" style={{ fontSize: 13 }}>{t(`adm.audit.${l.action}`, { defaultValue: String(l.action || '').replace(/_/g, ' ').toLowerCase() })}</span>
                      {d.amount && <span className="v-ink tabular-nums" style={{ fontSize: 13 }}>{money(d.amount)}</span>}
                      {d.creatorEmail && <span className="v-caption v-quiet" style={{ fontSize: 12 }}>→ {d.creatorEmail}</span>}
                      {d.campaignTitle && <span className="v-caption v-quiet" style={{ fontSize: 12 }}>· {d.campaignTitle}</span>}
                    </div>
                    <div className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{l.user?.email || t('adm.audit.system')}{l.user?.role ? ` (${t(`adm.roles.${l.user.role}`, { defaultValue: l.user.role })})` : ''} · {dateTime(l.created_at)}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      )}

      {/* Details */}
      <Modal isOpen={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="!max-w-lg">
              <Modal.CloseTrigger />
              <Modal.Header>
                <div className="flex items-center gap-3 min-w-0 pr-8">
                  <StoryAvatar src={userIdentity(detail?.creator).avatar} name={userIdentity(detail?.creator).name || detail?.creator?.email} seed={detail?.creator?.id || detail?.id || 'p'} size={40} />
                  <div className="min-w-0">
                    <Modal.Heading className="truncate">{userIdentity(detail?.creator).name || detail?.creator?.email}</Modal.Heading>
                    <p className="v-caption v-quiet truncate" style={{ fontSize: 12 }}>{detail?.creator?.email}</p>
                  </div>
                </div>
              </Modal.Header>
              <Modal.Body>
                {detail && (
                  <div className="space-y-4">
                    <dl className="grid grid-cols-2 gap-2">
                      <Fact label={t('apps.amount')}>{money(detail.amount)}</Fact>
                      <Fact label={t('adm.pay.statusLbl')}>{t(`adm.pay.status.${detail.status}`, { defaultValue: detail.status })}</Fact>
                      <Fact label={t('dash.campaign')}>{detail.campaign?.title || t('adm.pay.direct')}</Fact>
                      <Fact label={t('adm.pay.requested')}>{dateShort(detail.created_at)}</Fact>
                    </dl>
                    <div>
                      <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-1 inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}>
                        <Landmark size={11} /> {t('adm.pay.recipient')}
                      </div>
                      {detail.payoutAccount && (detail.payoutAccount.account_number || detail.payoutAccount.mobile_number) ? (
                        <div className="rounded-xl px-3 divide-y divide-border v-hairline">
                          {detail.payoutAccount.account_number && (
                            <>
                              <CopyRow label={t('adm.pay.bankName')} value={detail.payoutAccount.bank_name} k="bank" />
                              <CopyRow label={t('adm.pay.accountNumber')} value={detail.payoutAccount.account_number} k="acct" />
                              <CopyRow label={t('adm.pay.accountName')} value={detail.payoutAccount.account_name} k="name" />
                              <CopyRow label={t('adm.pay.bankCode')} value={detail.payoutAccount.bank_code} k="code" />
                              <div className="py-2 flex items-center justify-between">
                                <div>
                                  <div className="v-caption v-quiet" style={{ fontSize: 11 }}>{t('adm.pay.currency')}</div>
                                  <div className="v-ink font-medium" style={{ fontSize: 13 }}>{detail.payoutAccount.currency || 'USD'}{detail.payoutAccount.country ? ` · ${detail.payoutAccount.country}` : ''}</div>
                                </div>
                                {detail.payoutAccount.is_verified && (
                                  <Chip color="success" variant="soft" size="sm"><CheckCircle2 size={11} /><Chip.Label>{t('adm.pay.bankVerified')}</Chip.Label></Chip>
                                )}
                              </div>
                            </>
                          )}
                          {detail.payoutAccount.mobile_number && (
                            <CopyRow label={`${t('adm.pay.mobileMoney')} · ${detail.payoutAccount.mobile_network || ''}`} value={detail.payoutAccount.mobile_number} k="mobile" />
                          )}
                        </div>
                      ) : (
                        <EmptyPanel tone="error" size="sm" icon={<AlertTriangle size={18} />} title={t('adm.pay.noAccount')} description={t('adm.pay.noAccountDesc')} />
                      )}
                    </div>
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer>
                <div className="flex-1">{detail && actions(detail, true)}</div>
                <Button variant="ghost" onPress={() => setDetail(null)}>{t('common.close')}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmModal
        open={!!confirm}
        tone={confirm?.kind === 'reject' ? 'danger' : 'primary'}
        pending={!!confirm && busy === confirm.payout.id}
        title={confirm?.kind === 'execute' ? t('adm.pay.executeTitle') : confirm?.kind === 'reject' ? t('adm.pay.rejectTitle') : t('adm.pay.approveTitle')}
        body={
          confirm?.kind === 'execute'
            ? t('adm.pay.executeBody', { amount: money(confirm.payout.amount), who: confirm.payout.creator?.email })
            : confirm?.kind === 'reject'
              ? t('adm.pay.rejectBody', { amount: money(confirm.payout.amount), who: confirm.payout.creator?.email })
              : t('adm.pay.approveBody', { amount: money(confirm?.payout.amount), who: confirm?.payout.creator?.email })
        }
        confirmLabel={confirm?.kind === 'execute' ? t('adm.pay.executeConfirm') : confirm?.kind === 'reject' ? t('adm.pay.reject') : t('adm.pay.approve')}
        onConfirm={onConfirm}
        onClose={() => setConfirm(null)}
      />
    </PageShell>
  );
};

export default AdminPayouts;
