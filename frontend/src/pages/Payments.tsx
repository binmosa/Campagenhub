import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Layers,
  PlusCircle,
  Search as SearchIcon,
  Clock,
  CreditCard,
  DollarSign,
  RefreshCw,
  Send,
  Shield,
  Smartphone,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Button, Card, Chip, Modal, Separator } from '@heroui/react';
import { DataGrid, EmptyState, KPI, Segment } from '@heroui-pro/react';
import type { DataGridColumn } from '@heroui-pro/react';
import api from '../lib/api';
import PayoutSettings from '../components/PayoutSettings';
import { MetricCard, PageShell } from '../components/ui';
import { EmptyPanel } from '../components/common/EmptyPanel';
import { Notice } from '../components/common/Notice';
import { toast } from '../lib/toast';
import { StoryAvatar } from '../components/common/StoryAvatar';
import { DashPanel, PanelEmpty } from '../components/common/DashPanel';
import { DirectoryToolbar } from '../components/common/filters';
import { formatBudget } from '../lib/campaignFormat';
import { fieldClass as vField } from './talent/shared';
import { Users as TeamIcon, Clock as PendingIcon, ArrowLeftRight as TxIcon } from 'lucide-react';

type Transaction = {
  id?: string;
  tx_ref?: string;
  is_batch?: boolean;
  batch_ref?: string | null;
  amount: number | string;
  currency: string;
  status: 'completed' | 'failed' | 'initiated' | 'processing' | string;
  payment_method?: string;
  created_at: string;
  payee?: { email?: string };
  payer?: { email?: string };
};

const STATUS_COLOR: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  completed: 'success',
  failed: 'danger',
  initiated: 'warning',
  processing: 'warning',
};

/* ── Transactions DataGrid ────────────────────────────────────── */
const TransactionsTable: React.FC<{
  transactions: Transaction[];
  isBrand: boolean;
}> = ({ transactions, isBrand }) => {
  const { t } = useTranslation();
  const columns: DataGridColumn<Transaction>[] = [
    {
      accessorKey: 'tx_ref',
      allowsResizing: true,
      cell: (item) => (
        <span className="font-mono text-xs text-muted">
          {item.tx_ref?.split('-')[0] || 'Payment'}
        </span>
      ),
      header: 'Reference',
      id: 'tx_ref',
      isRowHeader: true,
      minWidth: 130,
    },
    {
      accessorKey: 'status',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => {
        const color = STATUS_COLOR[item.status] || 'default';
        return (
          <Chip color={color} size="sm" variant="soft">
            <Chip.Label className="capitalize">{item.status}</Chip.Label>
          </Chip>
        );
      },
      header: 'Status',
      id: 'status',
      minWidth: 120,
    },
    {
      accessorKey: 'payment_method',
      allowsResizing: true,
      cell: (item) => (
        <span className="uppercase text-muted text-sm">
          {item.payment_method || '—'}
        </span>
      ),
      header: 'Method',
      id: 'payment_method',
      minWidth: 130,
    },
    {
      accessorKey: 'amount',
      align: 'end',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <span
          className={`font-medium text-sm tabular-nums ${
            item.status === 'completed' ? 'text-success' : 'text-foreground'
          }`}
        >
          {isBrand ? '−' : '+'}${Number(item.amount).toLocaleString()}
        </span>
      ),
      header: 'Amount',
      id: 'amount',
      minWidth: 130,
    },
    {
      accessorKey: 'currency',
      align: 'end',
      allowsResizing: true,
      cell: (item) => (
        <span className="text-muted text-xs uppercase">{item.currency}</span>
      ),
      header: 'Currency',
      id: 'currency',
      minWidth: 90,
    },
    {
      allowsResizing: true,
      cell: (item) =>
        item.is_batch ? (
          <span className="text-muted text-sm truncate inline-flex items-center gap-1">
            <Layers size={11} /> {t('ops.pay.tx.batch', { count: transactions.filter((x) => x.batch_ref === item.tx_ref && !x.is_batch).length })}
          </span>
        ) : item.payee?.email || item.payer?.email ? (
          <span className="text-muted text-sm truncate">
            {item.payee?.email
              ? `→ ${item.payee.email}`
              : `← ${item.payer?.email}`}
          </span>
        ) : (
          <span className="text-muted text-sm">—</span>
        ),
      header: 'Counterparty',
      id: 'counterparty',
      minWidth: 200,
    },
    {
      accessorKey: 'created_at',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <span className="text-muted text-sm tabular-nums">
          {new Date(item.created_at).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}{' '}
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
      header: 'Date',
      id: 'created_at',
      minWidth: 180,
    },
  ];

  return (
    <DataGrid
      allowsColumnResize
      aria-label="Transaction history"
      columns={columns}
      contentClassName="min-w-[1100px]"
      data={transactions}
      defaultSortDescriptor={{
        column: 'created_at',
        direction: 'descending',
      }}
      getRowId={(item) => item.id || `${item.tx_ref}-${item.created_at}`}
      renderEmptyState={() => 'No transactions found.'}
      selectionMode="none"
      variant="primary"
    />
  );
};

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted';
const fieldStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  outline: 'none',
};

/* ─── Main page ─────────────────────────────────────────────────── */
const Payments: React.FC = () => {
  const { t } = useTranslation();
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  const isBrand = role === 'brand';

  const [contracts, setContracts] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [payConfig, setPayConfig] = useState<any>({});
  const [paying, setPaying] = useState<Payee[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, PayoutStatus>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [readyFilter, setReadyFilter] = useState<'all' | 'ready' | 'missing' | 'extra'>('all');

  /* Flutterwave redirect-back verification (unchanged) */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const transactionId = params.get('transaction_id');
    const txRef = params.get('tx_ref');
    const status = params.get('status');
    if (!transactionId && !txRef) return;
    const marker = `verified_tx_${transactionId || txRef}`;
    if (sessionStorage.getItem(marker)) return;

    /*
     * Reconciling the redirect back from the gateway. The "already handled"
     * marker is written only once the server has actually answered — it used
     * to be set first, so one transient failure suppressed the retry
     * permanently, even on reload, and the payment was never recorded.
     */
    (async () => {
      try {
        if (txRef) {
          await api.post('/payments/confirm', { txRef, transactionId: transactionId || undefined });
        }
        await api.post('/payments/verify', {
          transactionId: transactionId || undefined,
          txRef: txRef || undefined,
        });
        sessionStorage.setItem(marker, '1');
        load();
      } catch {
        // Left unmarked on purpose: reloading the page retries.
        toast.error(t('ops.pay.errReconcile', { ref: txRef || transactionId || '—' }));
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [
        api.get('/payments/transactions'),
        api.get('/payments/config'),
      ];
      if (isBrand) {
        promises.push(api.get('/contracts/mine'));
        promises.push(api.get('/invitations/team').catch(() => ({ data: [] })));
      }
      const results = await Promise.all(promises);
      setTransactions(results[0].data || []);
      setPayConfig(results[1].data || {});
      if (isBrand) {
        setContracts(
          (results[2]?.data || []).filter((c: any) =>
            ['active', 'approved'].includes(c.status)
          )
        );
        setTeamMembers((results[3]?.data || []).filter((m: any) => m.is_active !== false));
      }
    } catch {}
    setLoading(false);
  }, [isBrand]);

  useEffect(() => {
    load();
  }, [load]);

  const payees = useMemo(() => buildPayees(contracts, teamMembers, t), [contracts, teamMembers, t]);

  useEffect(() => {
    payees.forEach((p) => {
      if (statuses[p.userId]) return;
      api
        .get(`/payout-accounts/user/${p.userId}/status`)
        .then((res) => setStatuses((prev) => ({ ...prev, [p.userId]: { has_bank: !!res.data?.has_bank, bank_verified: !!res.data?.bank_verified, account_type: res.data?.account_type || null } })))
        .catch(() => setStatuses((prev) => ({ ...prev, [p.userId]: { has_bank: false, bank_verified: false, account_type: null } })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payees]);

  const campaignOptions = useMemo(() => {
    const map = new Map<string, string>();
    payees.forEach((p) => p.items.forEach((it) => it.campaignId && map.set(it.campaignId, it.campaignTitle || '')));
    return [...map.entries()];
  }, [payees]);

  const visiblePayees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payees.filter((p) => {
      if (q && !`${p.name} ${p.email} ${p.items.map((i) => i.label).join(' ')}`.toLowerCase().includes(q)) return false;
      if (campaignFilter && !p.items.some((i) => i.campaignId === campaignFilter)) return false;
      const st = statuses[p.userId];
      if (readyFilter === 'ready' && !st?.has_bank) return false;
      if (readyFilter === 'missing' && st?.has_bank !== false) return false;
      if (readyFilter === 'extra' && !p.items.some((i) => i.kind === 'addendum')) return false;
      return true;
    });
  }, [payees, search, campaignFilter, readyFilter, statuses]);

  const selectedPayees = useMemo(() => payees.filter((p) => selected.has(p.userId)), [payees, selected]);
  const selectedTotal = selectedPayees.reduce((sum, p) => sum + p.total, 0);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allVisibleSelected = visiblePayees.length > 0 && visiblePayees.every((p) => selected.has(p.userId));

  const stats = useMemo(() => {
    const totalPaid = transactions
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalPending = transactions
      .filter((t) => ['initiated', 'processing'].includes(t.status))
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const team = isBrand ? payees.length : 0;
    return {
      totalPaid,
      totalPending,
      team,
      count: transactions.length,
    };
  }, [transactions, payees, isBrand]);

  const fmt = (n: number) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <PageShell
      hero
      containerSize="wide"
      title={isBrand ? t('ops.pay.titleBrand') : t('ops.pay.titleOwn')}
      titleAccent={t('ops.pay.accent')}
      stats={
        <div className={`grid grid-cols-2 gap-3 ${isBrand ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          <MetricCard label={t('ops.pay.kPaid')} value={fmt(stats.totalPaid)} hint={t('ops.pay.kPaidHint')} icon={DollarSign} iconStatus={stats.totalPaid > 0 ? 'success' : undefined} />
          <MetricCard label={t('ops.pay.kPending')} value={fmt(stats.totalPending)} hint={t('ops.pay.kPendingHint')} icon={PendingIcon} iconStatus={stats.totalPending > 0 ? 'warning' : undefined} />
          {isBrand && <MetricCard label={t('ops.pay.kPayees')} value={stats.team} hint={t('ops.pay.kPayeesHint')} icon={TeamIcon} />}
          <MetricCard label={t('ops.pay.kTx')} value={stats.count} hint={t('ops.pay.kTxHint')} icon={TxIcon} />
        </div>
      }
      description={isBrand ? t('ops.pay.descBrand') : t('ops.pay.descOwn')}
      icon={<Wallet size={18} />}
      actions={
        isBrand ? (
          selectedPayees.length > 0 ? (
            <Button variant="primary" size="md" onPress={() => setPaying(selectedPayees)}>
              <Send size={14} /> {t('ops.pay.list.paySelected', { count: selectedPayees.length, amount: money(selectedTotal) })}
            </Button>
          ) : (
            <Button variant="primary" size="md" onPress={() => document.getElementById('payees')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <Send size={14} /> {t('ops.pay.instantPay')}
            </Button>
          )
        ) : null
      }
    >
      {/* Who can be paid — one row per person, every signed item listed */}
      {isBrand && (
        <div id="payees">
          <DashPanel
            icon={<Users size={15} />}
            title={t('ops.pay.list.title')}
            meta={t('ops.pay.list.count', { shown: visiblePayees.length, total: payees.length })}
            action={
              selectedPayees.length > 0 ? (
                <Button variant="primary" size="sm" onPress={() => setPaying(selectedPayees)}>
                  <Send size={12} /> {t('ops.pay.list.paySelected', { count: selectedPayees.length, amount: money(selectedTotal) })}
                </Button>
              ) : undefined
            }
          >
            {payees.length > 0 && (
              <div className="mb-3">
                <DirectoryToolbar
                  search={{ value: search, onChange: setSearch, placeholder: t('ops.pay.list.searchPh'), ariaLabel: t('ops.pay.list.searchPh') }}
                  leading={
                    <label className="inline-flex items-center gap-2 v-caption v-ink shrink-0" style={{ fontSize: 12.5 }}>
                      <input
                        type="checkbox"
                        className="size-4"
                        style={{ accentColor: 'var(--color-campaign-purple)' }}
                        checked={allVisibleSelected}
                        onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visiblePayees.map((p) => p.userId)))}
                        aria-label={t('ops.pay.list.selectAll')}
                      />
                      {t('ops.pay.list.selectAll')}
                    </label>
                  }
                >
                  {campaignOptions.length > 1 && (
                    <select className={`${vField} !w-auto`} value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} aria-label={t('ops.pay.list.campaign')}>
                      <option value="">{t('ops.pay.list.allCampaigns')}</option>
                      {campaignOptions.map(([id, title]) => (
                        <option key={id} value={id}>{title}</option>
                      ))}
                    </select>
                  )}
                  <Segment size="sm" selectedKey={readyFilter} onSelectionChange={(k) => setReadyFilter(k as typeof readyFilter)} aria-label={t('ops.pay.list.filterLabel')}>
                    <Segment.Item id="all">{t('ops.pay.list.fAll')}</Segment.Item>
                    <Segment.Item id="ready">{t('ops.pay.list.fReady')}</Segment.Item>
                    <Segment.Item id="missing">{t('ops.pay.list.fMissing')}</Segment.Item>
                    <Segment.Item id="extra">{t('ops.pay.list.fExtra')}</Segment.Item>
                  </Segment>
                </DirectoryToolbar>
              </div>
            )}
            {loading ? (
              <div className="space-y-3" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="v-skel h-9 w-9 !rounded-full" />
                    <div className="flex-1"><div className="v-skel h-3.5 w-1/3 mb-2" /><div className="v-skel h-3 w-1/2" /></div>
                  </div>
                ))}
              </div>
            ) : payees.length === 0 ? (
              <PanelEmpty icon={<Users size={16} />} title={t('ops.pay.list.emptyTitle')} desc={t('ops.pay.list.emptyDesc')} />
            ) : visiblePayees.length === 0 ? (
              <PanelEmpty icon={<SearchIcon size={16} />} title={t('board.emptyTitle')} desc={t('ops.pay.list.emptyFilter')} action={<Button variant="tertiary" size="sm" onPress={() => { setSearch(''); setCampaignFilter(''); setReadyFilter('all'); }}>{t('board.resetFilters')}</Button>} />
            ) : (
              <ul className="divide-y divide-border">
                {visiblePayees.map((p) => {
                  const st = statuses[p.userId];
                  return (
                    <li key={p.userId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" data-testid="payee-row">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0"
                        style={{ accentColor: 'var(--color-campaign-purple)' }}
                        checked={selected.has(p.userId)}
                        onChange={() => toggle(p.userId)}
                        aria-label={t('ops.pay.list.select', { name: p.name })}
                      />
                      <StoryAvatar src={p.avatar} name={p.name} seed={p.userId} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{p.name}</span>
                          <span className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>{p.role === 'manager' ? t('talent.managerFallback') : t('talent.creatorFallback')} · {p.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {p.items.map((it) => (
                            <Chip key={it.id} variant="soft" size="sm" color={it.kind === 'addendum' ? 'accent' : 'default'} className="max-w-full">
                              {it.kind === 'addendum' && <PlusCircle size={10} />}
                              <Chip.Label className="truncate">
                                {it.label} · {money(it.amount, it.currency)}{it.frequency && it.frequency !== 'one_time' ? ` / ${t(`apps.freq.${it.frequency}`, { defaultValue: it.frequency }).toLowerCase()}` : ''}
                              </Chip.Label>
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {st ? (
                          <Chip color={st.has_bank ? 'success' : 'warning'} variant="soft" size="sm" className="hidden md:inline-flex">
                            {st.has_bank ? <Building2 size={10} /> : <AlertTriangle size={10} />}
                            <Chip.Label>{st.has_bank ? (st.account_type === 'mobile_money' ? t('ops.pay.m.mobile') : t('ops.pay.m.bank')) : t('ops.pay.m.noBank')}</Chip.Label>
                          </Chip>
                        ) : null}
                        <span className="v-ink font-semibold tabular-nums" style={{ fontSize: 14, color: '#0b6e3e' }}>{money(p.total, p.currency)}</span>
                        <Button variant="primary" size="sm" onPress={() => setPaying([p])}>
                          <Send size={11} /> {t('ops.pay.list.pay')}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashPanel>
        </div>
      )}

      {/* Transaction history */}
      <Card>
        <Card.Header className="flex-row items-center justify-between">
          <Card.Title className="inline-flex items-center gap-2 text-base">
            <CreditCard size={15} className="text-accent" />
            {t('ops.pay.history')}
          </Card.Title>
          <Button
            variant="tertiary"
            size="sm"
            isIconOnly
            aria-label={t('ops.pay.refresh')}
            onPress={load}
          >
            <RefreshCw size={13} />
          </Button>
        </Card.Header>
        <Separator />
        <Card.Content className="p-0">
          {loading ? (
            <div className="p-4 space-y-2" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="v-skel h-10 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-4">
              <EmptyPanel
                size="sm"
                icon={<DollarSign size={18} />}
                title={t('ops.pay.emptyTitle')}
                description={isBrand ? t('ops.pay.emptyBrandDesc') : t('ops.pay.emptyOwnDesc')}
                actions={
                  isBrand && payees.length > 0 ? (
                    <Button variant="primary" size="sm" onPress={() => setPaying([payees[0]])}>
                      {t('ops.pay.instantPay')}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <TransactionsTable transactions={transactions} isBrand={isBrand} />
          )}
        </Card.Content>
      </Card>

      {/* Payout settings for non-brand */}
      {!isBrand && <PayoutSettings />}

      {/* Pay one person, or everyone selected, in one checkout */}
      {isBrand && paying && (
        <PayModal
          payees={paying}
          statuses={statuses}
          payConfig={payConfig}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setPaying(null);
            setSelected(new Set());
            load();
          }}
        />
      )}
    </PageShell>
  );
};

/* ─── Payees + pay modal ────────────────────────────────────────── */
type PayItem = { id: string; kind: 'main' | 'addendum' | 'team'; label: string; amount: number; currency: string; frequency?: string | null; ends_at?: string | null; campaignId?: string; campaignTitle?: string };
type Payee = { userId: string; name: string; email: string; avatar?: string | null; role: 'creator' | 'manager'; items: PayItem[]; total: number; currency: string; primaryId: string; campaignId?: string };
type PayoutStatus = { has_bank: boolean; bank_verified: boolean; account_type: string | null };

const money = (n: number, currency = 'USD') => formatBudget(n, currency);

/** One row per person, with every signed item (main agreement, extra work, team retainer) they can be paid for. */
const buildPayees = (contracts: any[], teamMembers: any[], t: (k: string, o?: any) => string): Payee[] => {
  const map = new Map<string, Payee>();
  const ensure = (userId: string, seed: Partial<Payee>) => {
    let p = map.get(userId);
    if (!p) {
      p = { userId, name: seed.name || '', email: seed.email || '', avatar: seed.avatar, role: seed.role || 'creator', items: [], total: 0, currency: seed.currency || 'USD', primaryId: seed.primaryId || '', campaignId: seed.campaignId };
      map.set(userId, p);
    }
    return p;
  };
  const sorted = [...contracts].sort((a, b) => (a.kind === 'addendum' ? 1 : 0) - (b.kind === 'addendum' ? 1 : 0));
  sorted.forEach((c: any) => {
    const userId = c.opponent_id || c.application?.creator?.id;
    if (!userId) return;
    const email = c.opponent_email || c.application?.creator?.email || '';
    const campaign = c.application?.campaign;
    const p = ensure(userId, {
      name: c.opponent_name || email.split('@')[0],
      email,
      avatar: c.opponent_avatar,
      role: c.type === 'brand_manager' ? 'manager' : 'creator',
      currency: c.currency || 'USD',
      primaryId: c.kind === 'addendum' ? '' : c.id,
      campaignId: campaign?.id,
    });
    if (!p.primaryId && c.kind !== 'addendum') p.primaryId = c.id;
    if (!p.campaignId && campaign?.id) p.campaignId = campaign.id;
    const amount = Number(c.payment_amount) || 0;
    p.items.push({
      id: c.id,
      kind: c.kind === 'addendum' ? 'addendum' : 'main',
      label: c.kind === 'addendum' ? String(c.title || '').replace('Extra work: ', '') || t('ops.ws.extraWork') : campaign?.title || t('ops.pay.m.teamContract'),
      amount,
      currency: c.currency || 'USD',
      frequency: c.payment_frequency,
      ends_at: c.ends_at,
      campaignId: campaign?.id,
      campaignTitle: campaign?.title,
    });
    p.total += amount;
  });
  teamMembers.forEach((m: any) => {
    const u = m.member || m.user || {};
    const userId = u.id || m.user_id;
    if (!userId) return;
    const email = u.email || m.email || '';
    const p = ensure(userId, {
      name: u.creatorProfile?.full_name || u.managerProfile?.full_name || email.split('@')[0],
      email,
      avatar: u.creatorProfile?.avatar_url || u.managerProfile?.avatar_url || null,
      role: m.member_type === 'manager' ? 'manager' : 'creator',
      currency: m.currency || 'USD',
      primaryId: m.invitation_id || m.id,
    });
    if (p.items.length > 0) return; // already covered by a contract row
    const amount = Number(m.payment_amount) || 0;
    p.items.push({ id: m.id, kind: 'team', label: t('ops.pay.list.teamRetainer'), amount, currency: m.currency || 'USD', frequency: m.payment_frequency });
    p.total += amount;
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
};

const PayModal: React.FC<{
  payees: Payee[];
  statuses: Record<string, PayoutStatus>;
  payConfig: any;
  onClose: () => void;
  onPaid: () => void;
}> = ({ payees, statuses, payConfig, onClose, onPaid }) => {
  const { t } = useTranslation();
  const multi = payees.length > 1;
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(payees.map((p) => [p.userId, p.total > 0 ? String(p.total) : ''])));
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'flutterwave' | 'telebirr'>('flutterwave');
  const [telebirrInfo, setTelebirrInfo] = useState('');
  const [escrowInfo, setEscrowInfo] = useState<any>(null);

  const single = multi ? null : payees[0];
  useEffect(() => {
    setEscrowInfo(null);
    if (!single?.campaignId) return;
    api
      .get(`/payments/campaign/${single.campaignId}/escrow`)
      .then((res) => setEscrowInfo(res.data))
      .catch(() => {});
  }, [single?.campaignId]);

  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const total = payees.reduce((sum, p) => sum + num(amounts[p.userId] || ''), 0);
  const below = payees.filter((p) => num(amounts[p.userId] || '') + 0.005 < p.total);
  const allValid = payees.every((p) => num(amounts[p.userId] || '') > 0) && below.length === 0;
  const bonus = payees.reduce((sum, p) => sum + Math.max(0, num(amounts[p.userId] || '') - p.total), 0);
  const missing = payees.filter((p) => statuses[p.userId]?.has_bank === false);
  const types = new Set(payees.map((p) => statuses[p.userId]?.account_type || 'none'));
  const available = escrowInfo ? Number(escrowInfo.available || 0) : null;

  const handlePay = async () => {
    if (below.length) return setError(t('ops.pay.m.errBelow', { name: below[0].name, amount: money(below[0].total, below[0].currency) }));
    if (!allValid) return setError(t('ops.pay.m.errAmount'));
    if (single && available != null && total > available) return setError(t('ops.pay.m.errEscrow', { amount: money(available) }));
    setError('');
    setSending(true);
    try {
      const redirectUrl = window.location.origin + '/dashboard/payments?payment=completed';
      const res = multi
        ? await api.post('/payments/initiate-bulk', {
            items: payees.map((p) => ({ payeeId: p.userId, amount: num(amounts[p.userId]), applicationId: p.primaryId || undefined, campaignId: p.campaignId || undefined, note: note || undefined })),
            paymentMethod,
            redirectUrl,
            currency: 'USD',
          })
        : await api.post('/payments/initiate', {
            amount: total,
            currency: 'USD',
            email: single!.email || 'team@campaignhub.com',
            name: single!.name,
            campaignTitle: `Instant Payment: ${note || 'Team Payment'}`,
            applicationId: single!.primaryId,
            campaignId: single!.campaignId || undefined,
            payeeId: single!.userId,
            paymentMethod,
            redirectUrl,
          });
      if (paymentMethod === 'telebirr' && res.data?.telebirrRawRequest) {
        setTelebirrInfo(`https://developerportal.ethiotelebirr.et:38443/telebirr/checkout?${res.data.telebirrRawRequest}`);
        setSuccess(true);
      } else if (res.data?.paymentLink) {
        window.location.href = res.data.paymentLink;
        return;
      } else if (res.data?.data) {
        // Success is decided in the callback, not here: the checkout window
        // has not even opened yet at this point.
        launchFlutterwaveCheckout(res.data.data, payConfig.publicKey, (result) => {
          setSending(false);
          if (result.ok) {
            setSuccess(true);
            onPaid();
            return;
          }
          if (result.reason === 'closed') {
            setError(t('ops.pay.m.errClosed'));
            return;
          }
          setError(result.reason === 'sdk' ? t('ops.pay.m.errSdk') : t('ops.pay.m.errUnconfirmed', { ref: result.txRef || '—' }));
        });
        return;
      } else {
        setError(t('ops.pay.m.errNoLink'));
      }
    } catch (e: any) {
      const respMsg = e?.response?.data?.message;
      setError(typeof respMsg === 'string' ? respMsg : Array.isArray(respMsg) ? respMsg.join(', ') : t('ops.pay.m.errFailed'));
    } finally {
      setSending(false);
    }
  };

  const stepLabel = (n: number, text: string) => (
    <div className="flex items-center gap-2 mb-2">
      <span className="inline-flex items-center justify-center rounded-full text-white font-medium shrink-0" style={{ width: 20, height: 20, fontSize: 11, background: 'var(--gradient-signature)' }}>
        {n}
      </span>
      <span className="v-ink font-medium" style={{ fontSize: 13.5 }}>{text}</span>
    </div>
  );
  const accountLabel = (st?: PayoutStatus) => (!st ? '' : st.has_bank ? (st.account_type === 'mobile_money' ? t('ops.pay.m.mobile') : t('ops.pay.m.bank')) : t('ops.pay.m.noBank'));

  return (
    <Modal isOpen onOpenChange={(open) => !open && !sending && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <span className="v-hero-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                  <Send size={15} />
                </span>
                {multi ? t('ops.pay.m.titleMulti', { count: payees.length }) : t('ops.pay.m.titleOne', { name: single!.name })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {success ? (
                <div className="text-center py-6" role="status">
                  <span className="inline-flex items-center justify-center rounded-full mb-3" style={{ width: 56, height: 56, background: 'rgba(22,199,132,0.14)', color: 'var(--color-signal-green)' }}>
                    <CheckCircle2 size={26} />
                  </span>
                  <div className="v-ink font-medium" style={{ fontSize: 17 }}>{t('ops.pay.m.okTitle')}</div>
                  <p className="v-body v-muted" style={{ fontSize: 13, maxWidth: '40ch', margin: '6px auto 0' }}>
                    {paymentMethod === 'telebirr' ? t('ops.pay.m.okTb') : t('ops.pay.m.okFw')}
                  </p>
                  {paymentMethod === 'telebirr' && telebirrInfo && (
                    <Button variant="primary" className="mt-4" onPress={() => window.open(telebirrInfo, '_blank')}>
                      <Smartphone size={14} /> {t('ops.pay.m.openTb')}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="v-body v-muted" style={{ fontSize: 13 }}>{multi ? t('ops.pay.m.descMulti') : t('ops.pay.m.desc')} {t('ops.pay.m.floorRule')}</p>
                  {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}

                  {/* 1 · review */}
                  <section>
                    {stepLabel(1, multi ? t('ops.pay.m.reviewMulti') : t('ops.pay.m.reviewOne'))}
                    <ul className="divide-y divide-border rounded-xl px-3" style={{ border: '1px solid var(--color-cool-gray)' }} data-testid="pay-lines">
                      {payees.map((p) => {
                        const st = statuses[p.userId];
                        const v = amounts[p.userId] || '';
                        return (
                          <li key={p.userId} className="py-3 space-y-2">
                            <div className="flex items-center gap-3">
                              <StoryAvatar src={p.avatar} name={p.name} seed={p.userId} size={36} />
                              <div className="min-w-0 flex-1">
                                <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{p.name}</div>
                                <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>{p.email}</div>
                              </div>
                              {st && (
                                <Chip color={st.has_bank ? 'success' : 'warning'} variant="soft" size="sm" className="shrink-0">
                                  {st.has_bank ? <Building2 size={10} /> : <AlertTriangle size={10} />}
                                  <Chip.Label>{accountLabel(st)}</Chip.Label>
                                </Chip>
                              )}
                              <div className="relative shrink-0" style={{ width: 150 }}>
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet pointer-events-none" style={{ fontSize: 13 }}>$</span>
                                <input
                                  inputMode="decimal"
                                  className={`${vField} pl-7 tabular-nums`}
                                  value={v}
                                  onChange={(e) => setAmounts((prev) => ({ ...prev, [p.userId]: e.target.value.replace(/[^\d.]/g, '') }))}
                                  placeholder={p.total > 0 ? String(p.total) : '0.00'}
                                  aria-label={t('ops.pay.m.amountFor', { name: p.name })}
                                  aria-invalid={num(v) + 0.005 < p.total || undefined}
                                  data-testid="pay-amount"
                                />
                              </div>
                            </div>
                            <ul className="ml-12 space-y-0.5">
                              {p.items.map((it) => (
                                <li key={it.id} className="flex items-center justify-between gap-3 v-caption" style={{ fontSize: 12 }}>
                                  <span className="inline-flex items-center gap-1.5 min-w-0">
                                    {it.kind === 'addendum' ? <PlusCircle size={11} style={{ color: 'var(--color-campaign-purple)' }} /> : <Layers size={11} className="v-quiet" />}
                                    <span className="v-ink truncate">{it.label}</span>
                                    {it.kind === 'addendum' && <span className="v-quiet">· {t('ops.ws.extraWork')}</span>}
                                  </span>
                                  <span className="v-quiet tabular-nums shrink-0">
                                    {money(it.amount, it.currency)}{it.frequency && it.frequency !== 'one_time' ? ` / ${t(`apps.freq.${it.frequency}`, { defaultValue: it.frequency }).toLowerCase()}` : ''}
                                  </span>
                                </li>
                              ))}
                              {p.total > 0 && (
                                <li className="flex items-center justify-between gap-3 v-caption pt-1" style={{ fontSize: 12 }}>
                                  <span className="v-quiet">{t('ops.pay.m.agreed', { amount: money(p.total, p.currency) })}</span>
                                  {num(v) + 0.005 < p.total ? (
                                    <button type="button" className="font-medium hover:underline inline-flex items-center gap-1" style={{ color: '#b3261e' }} onClick={() => setAmounts((prev) => ({ ...prev, [p.userId]: String(p.total) }))} data-testid="pay-short">
                                      <AlertTriangle size={11} /> {t('ops.pay.m.short', { amount: money(p.total - num(v), p.currency) })}
                                    </button>
                                  ) : num(v) > p.total + 0.005 ? (
                                    <span className="font-medium tabular-nums" style={{ color: '#0b6e3e' }} data-testid="pay-bonus">
                                      {t('ops.pay.m.bonus', { amount: money(num(v) - p.total, p.currency) })}
                                    </span>
                                  ) : null}
                                </li>
                              )}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                    {missing.length > 0 && (
                      <Notice tone="info">{t('ops.pay.m.noBankSelected', { name: missing.map((p) => p.name).join(', ') })}</Notice>
                    )}
                    {escrowInfo && (
                      <div className="rounded-xl p-3 mt-3" style={{ background: 'linear-gradient(135deg, rgba(22,199,132,0.10) 0%, rgba(0,212,199,0.12) 100%)', border: '1px solid rgba(22,199,132,0.20)' }}>
                        <div className="flex items-center justify-between gap-3 flex-wrap v-caption" style={{ fontSize: 12 }}>
                          <span className="font-medium uppercase tracking-wider" style={{ color: '#0b6e3e', fontSize: 10.5 }}>{t('ops.pay.m.escrow')}</span>
                          <span className="tabular-nums" style={{ color: '#0b6e3e' }}>
                            {t('ops.pay.m.deposited')} {money(Number(escrowInfo.deposited || 0))} · {t('ops.pay.m.committed')} {money(Number(escrowInfo.committed || 0))} ·{' '}
                            <strong>{t('ops.pay.m.available')} {money(Number(escrowInfo.available || 0))}</strong>
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3">
                      <label htmlFor="pay-note" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('ops.pay.m.note')}</label>
                      <input id="pay-note" className={vField} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('ops.pay.m.notePh')} />
                    </div>
                  </section>

                  {/* 2 · method */}
                  <section>
                    {stepLabel(2, t('ops.pay.m.method'))}
                    <div role="radiogroup" aria-label={t('ops.pay.m.method')} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'flutterwave', icon: <CreditCard size={15} />, label: t('ops.pay.m.fw'), hint: t('ops.pay.m.fwHint') },
                          { id: 'telebirr', icon: <Smartphone size={15} />, label: t('ops.pay.m.tb'), hint: t('ops.pay.m.tbHint') },
                        ] as const
                      ).map((m) => (
                        <button key={m.id} type="button" role="radio" aria-checked={paymentMethod === m.id} className="v-option-tile items-start" data-active={paymentMethod === m.id || undefined} onClick={() => setPaymentMethod(m.id)}>
                          <span style={{ color: 'var(--color-campaign-purple)' }}>{m.icon}</span>
                          <span className="flex-1 min-w-0 text-left">
                            <span className="block">{m.label}</span>
                            <span className="block v-caption v-quiet font-normal" style={{ fontSize: 11 }}>{m.hint}</span>
                          </span>
                          <Shield size={12} className="v-quiet shrink-0 mt-0.5" />
                        </button>
                      ))}
                    </div>
                    {multi && (
                      <Notice tone="info">
                        {types.size === 1 && !types.has('none') ? t('ops.pay.m.bulkSame', { count: payees.length, kind: accountLabel(statuses[payees[0].userId]).toLowerCase() }) : t('ops.pay.m.bulkMixed', { count: payees.length })}
                      </Notice>
                    )}
                  </section>

                  {/* total */}
                  <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(244,242,255,0.6)', border: '1px solid var(--color-cool-gray)' }}>
                    <span className="v-ink font-medium" style={{ fontSize: 13.5 }}>
                      {multi ? t('ops.pay.m.totalMulti', { count: payees.length }) : t('ops.pay.m.total')}
                      {bonus > 0.005 && <span className="v-caption v-quiet font-normal"> · {t('ops.pay.m.bonus', { amount: money(bonus) })}</span>}
                    </span>
                    <span className="font-semibold tabular-nums" style={{ fontSize: 20, color: '#0b6e3e', letterSpacing: '-0.018em' }} data-testid="pay-total">{money(total)}</span>
                  </div>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              {success ? (
                <Button variant="primary" onPress={onPaid}>
                  {t('ops.pay.m.done')}
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onPress={onClose} isDisabled={sending}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" isDisabled={!allValid} isPending={sending} onPress={handlePay}>
                    <Send size={13} /> {allValid ? t('ops.pay.m.payBtn', { amount: money(total) }) : t('ops.pay.m.send')}
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ─── Flutterwave inline checkout ───────────────────────────────── */
/**
 * The result of a checkout, as the server sees it.
 *
 * This used to swallow both the confirm and the verify call in empty
 * catches and then report success unconditionally: the card was charged,
 * the platform had no record, and the brand was told it worked. Nothing is
 * called a success now unless the server says the transaction completed.
 */
export type CheckoutResult = { ok: boolean; txRef?: string; reason?: 'closed' | 'unconfirmed' | 'sdk' };

function launchFlutterwaveCheckout(
  paymentData: any,
  publicKey: string,
  onSettled: (result: CheckoutResult) => void,
) {
  if (!(window as any).FlutterwaveCheckout) {
    const script = document.createElement('script');
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.onload = () => doCheckout(paymentData, publicKey, onSettled);
    // Without this the modal claimed success while the checkout never opened.
    script.onerror = () => onSettled({ ok: false, txRef: paymentData?.tx_ref, reason: 'sdk' });
    document.head.appendChild(script);
  } else {
    doCheckout(paymentData, publicKey, onSettled);
  }
}

function doCheckout(data: any, publicKey: string, onSettled: (result: CheckoutResult) => void) {
  let settled = false;
  const finish = (result: CheckoutResult) => {
    if (settled) return;
    settled = true;
    onSettled(result);
  };

  (window as any).FlutterwaveCheckout({
    public_key: publicKey,
    tx_ref: data.tx_ref,
    amount: data.amount,
    currency: data.currency || 'USD',
    customer: data.customer,
    customizations: data.customizations || { title: 'CampaignHub Payment' },
    callback: async (response: any) => {
      const transactionId = response?.transaction_id || response?.id;
      const txRef = String(response?.tx_ref || data?.tx_ref || '');
      let completed = false;

      try {
        const confirmed = await api.post('/payments/confirm', {
          txRef,
          transactionId: transactionId ? String(transactionId) : undefined,
        });
        completed = confirmed.data?.status === 'completed';
      } catch {
        completed = false;
      }

      if (!completed && transactionId) {
        try {
          const verified = await api.post('/payments/verify', { transactionId: String(transactionId), txRef });
          const status = verified.data?.data?.status || verified.data?.status;
          completed = typeof status === 'string' && ['successful', 'success', 'completed'].includes(status.toLowerCase());
        } catch {
          completed = false;
        }
      }

      finish({ ok: completed, txRef, reason: completed ? undefined : 'unconfirmed' });
    },
    onclose: () => finish({ ok: false, txRef: data?.tx_ref, reason: 'closed' }),
  });
}

export default Payments;
