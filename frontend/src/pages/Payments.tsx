import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Building2,
  CheckCircle,
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
import {
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  Modal,
  NumberField,
  Radio,
  RadioGroup,
  Separator,
  TextField,
} from '@heroui/react';
import {
  DataGrid,
  EmptyState,
  KPI,
  RadioButtonGroup,
} from '@heroui-pro/react';
import type { DataGridColumn } from '@heroui-pro/react';
import { Input } from 'react-aria-components';
import api from '../lib/api';
import PayoutSettings from '../components/PayoutSettings';
import { MetricCard, PageShell } from '../components/ui';
import { EmptyPanel } from '../components/common/EmptyPanel';
import { Users as TeamIcon, Clock as PendingIcon, ArrowLeftRight as TxIcon } from 'lucide-react';

type Transaction = {
  id?: string;
  tx_ref?: string;
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
        item.payee?.email || item.payer?.email ? (
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
  const [showPay, setShowPay] = useState(false);
  const [payConfig, setPayConfig] = useState<any>({});

  /* Flutterwave redirect-back verification (unchanged) */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const transactionId = params.get('transaction_id');
    const txRef = params.get('tx_ref');
    const status = params.get('status');
    if (!transactionId && !txRef) return;
    const marker = `verified_tx_${transactionId || txRef}`;
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, '1');
    if (txRef) {
      api
        .post('/payments/confirm', {
          txRef,
          transactionId: transactionId || undefined,
          status: status || undefined,
        })
        .catch(() => {});
    }
    api
      .post('/payments/verify', {
        transactionId: transactionId || undefined,
        txRef: txRef || undefined,
      })
      .catch(() => {});
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
        promises.push(api.get('/brands/team').catch(() => ({ data: [] })));
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
        const invitedTeam = results[3]?.data || [];
        const brandTeam = results[4]?.data || [];
        setTeamMembers([...invitedTeam, ...brandTeam]);
      }
    } catch {}
    setLoading(false);
  }, [isBrand]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const totalPaid = transactions
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalPending = transactions
      .filter((t) => ['initiated', 'processing'].includes(t.status))
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const team = isBrand ? contracts.length + teamMembers.length : 0;
    return {
      totalPaid,
      totalPending,
      team,
      count: transactions.length,
    };
  }, [transactions, contracts, teamMembers, isBrand]);

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
          <Button
            variant="primary"
            size="md"
            className="!rounded-xl"
            onPress={() => setShowPay(true)}
          >
            <Send size={14} /> {t('ops.pay.instantPay')}
          </Button>
        ) : null
      }
    >
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
                  isBrand ? (
                    <Button variant="primary" size="sm" onPress={() => setShowPay(true)}>
                      Instant pay
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

      {/* Instant pay modal */}
      {isBrand && showPay && (
        <InstantPayModal
          contracts={contracts}
          teamMembers={teamMembers}
          payConfig={payConfig}
          isOpen={showPay}
          onClose={() => setShowPay(false)}
          onPaid={() => {
            setShowPay(false);
            load();
          }}
        />
      )}
    </PageShell>
  );
};

/* ─── Instant pay modal (brand-only) ────────────────────────────── */
type Payee = {
  id: string;
  userId: string;
  label: string;
  email: string;
  type: string;
  campaignId?: string;
};

const InstantPayModal: React.FC<{
  contracts: any[];
  teamMembers: any[];
  payConfig: any;
  isOpen: boolean;
  onClose: () => void;
  onPaid: () => void;
}> = ({ contracts, teamMembers, payConfig, isOpen, onClose, onPaid }) => {
  const [selectedPayee, setSelectedPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'flutterwave' | 'telebirr'>(
    'flutterwave'
  );
  const [telebirrInfo, setTelebirrInfo] = useState('');
  const [escrowInfo, setEscrowInfo] = useState<any>(null);
  const [bankStatuses, setBankStatuses] = useState<Record<string, boolean>>({});

  const payeeList = useMemo<Payee[]>(() => {
    const list: Payee[] = [];
    contracts.forEach((c: any) => {
      const email =
        c.opponent_email ||
        c.application?.creator?.email ||
        c.application?.creator?.user?.email ||
        '';
      const name =
        c.application?.creator?.full_name ||
        c.application?.creator?.user?.creatorProfile?.full_name ||
        email.split('@')[0] ||
        'Creator';
      const userId =
        c.opponent_id ||
        c.application?.creator?.id ||
        c.application?.creator?.user?.id ||
        '';
      const campaignId = c?.application?.campaign?.id || '';
      if (!userId) return;
      list.push({
        id: c.id,
        userId,
        label: `${name} (Contract)`,
        email,
        type: 'contract',
        campaignId,
      });
    });
    teamMembers.forEach((m: any) => {
      const email = m.user?.email || m.email || '';
      const name =
        m.user?.creatorProfile?.full_name ||
        m.user?.managerProfile?.full_name ||
        email.split('@')[0] ||
        'Member';
      const userId = m.user?.id || m.user_id || '';
      if (!userId) return;
      if (!list.find((l) => l.userId === userId)) {
        list.push({
          id: m.id,
          userId,
          label: `${name} (${m.role || 'Team'})`,
          email,
          type: 'team',
        });
      }
    });
    return list;
  }, [contracts, teamMembers]);

  useEffect(() => {
    payeeList.forEach((p) => {
      if (p.userId) {
        api
          .get(`/payout-accounts/user/${p.userId}/status`)
          .then((res) => {
            setBankStatuses((prev) => ({
              ...prev,
              [p.userId]: res.data?.has_bank || false,
            }));
          })
          .catch(() => {});
      }
    });
  }, [payeeList]);

  const selectedP = payeeList.find((p) => p.id === selectedPayee);

  const resolveCampaignIdForPayee = (payee?: Payee) => {
    if (!payee) return '';
    if (payee.campaignId) return payee.campaignId;
    const normalize = (v: any) => String(v || '').trim().toLowerCase();
    const payeeUserId = normalize(payee.userId);
    const payeeId = normalize(payee.id);
    const payeeEmail = normalize(
      payeeList.find((p) => p.id === payee.id)?.email
    );
    const fromContract = contracts.find((c: any) => {
      const contractPayeeUserId = normalize(
        c?.opponent_id ||
          c?.application?.creator?.id ||
          c?.application?.creator?.user?.id
      );
      const contractId = normalize(c?.id);
      const contractEmail = normalize(
        c?.opponent_email ||
          c?.application?.creator?.email ||
          c?.application?.creator?.user?.email
      );
      const contractCampaignId = c?.application?.campaign?.id;
      if (!contractCampaignId) return false;
      return (
        (payeeUserId && contractPayeeUserId === payeeUserId) ||
        (payeeId && contractId === payeeId) ||
        (payeeEmail && contractEmail === payeeEmail)
      );
    });
    return fromContract?.application?.campaign?.id || '';
  };

  useEffect(() => {
    const loadEscrow = async () => {
      setEscrowInfo(null);
      if (!selectedP) return;
      const campaignId = resolveCampaignIdForPayee(selectedP);
      if (!campaignId) return;
      try {
        const res = await api.get(`/payments/campaign/${campaignId}/escrow`);
        setEscrowInfo(res.data);
      } catch {}
    };
    loadEscrow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPayee]);

  const handlePay = async () => {
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (!selectedPayee) {
      setError('Select who to pay');
      return;
    }
    if (escrowInfo && Number(amount) > Number(escrowInfo.available || 0)) {
      setError(
        `Insufficient escrow. Available $${Number(
          escrowInfo.available || 0
        ).toLocaleString()} USD.`
      );
      return;
    }
    setError('');
    setSending(true);

    try {
      const campaignId = resolveCampaignIdForPayee(selectedP);
      if (!selectedP?.userId) {
        setError('Selected payee is missing a linked user account.');
        setSending(false);
        return;
      }
      const res = await api.post('/payments/initiate', {
        amount: Number(amount),
        currency: 'USD',
        email: selectedP?.email || 'team@campaignhub.com',
        name: selectedP?.label || 'Team Member',
        campaignTitle: `Instant Payment: ${note || 'Team Payment'}`,
        applicationId: selectedPayee,
        campaignId: campaignId || undefined,
        payeeId: selectedP?.userId || '',
        paymentMethod,
        redirectUrl:
          window.location.origin + '/dashboard/payments?payment=completed',
      });

      if (paymentMethod === 'telebirr' && res.data?.telebirrRawRequest) {
        const telebirrWebUrl = `https://developerportal.ethiotelebirr.et:38443/telebirr/checkout?${res.data.telebirrRawRequest}`;
        setTelebirrInfo(telebirrWebUrl);
        setSuccess(true);
      } else if (res.data?.paymentLink) {
        window.location.href = res.data.paymentLink;
        return;
      } else if (res.data?.data) {
        launchFlutterwaveCheckout(res.data.data, payConfig.publicKey, onPaid);
        setSuccess(true);
      } else {
        setError('Payment initiation failed: no link returned');
      }
    } catch (e: any) {
      const respMsg = e?.response?.data?.message;
      let safeError = 'Payment failed';
      if (typeof respMsg === 'string') safeError = respMsg;
      else if (Array.isArray(respMsg)) safeError = respMsg.join(', ');
      else if (respMsg) safeError = JSON.stringify(respMsg);
      setError(safeError);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="inline-flex items-center gap-2">
              <Send size={16} className="text-accent" /> Instant pay
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {success ? (
              <div className="text-center py-4">
                <span
                  className="inline-flex h-14 w-14 rounded-full items-center justify-center mb-3 bg-success-soft text-success-soft-foreground"
                >
                  <CheckCircle size={26} />
                </span>
                <p className="text-foreground text-base font-semibold">
                  Payment initiated
                </p>
                {paymentMethod === 'telebirr' ? (
                  <>
                    <p className="text-muted text-sm mt-2">
                      Telebirr transaction generated. Open the secure checkout to
                      finish.
                    </p>
                    <Button
                      variant="primary"
                      fullWidth
                      className="!rounded-xl !mt-4"
                      onPress={() => window.open(telebirrInfo, '_blank')}
                    >
                      <Smartphone size={14} /> Open Telebirr checkout
                    </Button>
                  </>
                ) : (
                  <p className="text-muted text-sm mt-2">
                    Flutterwave checkout opened. Funds transfer automatically once
                    completed.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Payee */}
                <div>
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Pay to
                  </Label>
                  {payeeList.length === 0 ? (
                    <Card className="bg-warning-soft border-warning/40">
                      <Card.Content className="p-3 flex items-center gap-2 text-sm text-warning-soft-foreground">
                        <AlertTriangle size={14} />
                        <span>
                          No team members or contracts found. Invite or accept
                          creators first.
                        </span>
                      </Card.Content>
                    </Card>
                  ) : (
                    <RadioGroup
                      aria-label="Pay to"
                      value={selectedPayee}
                      onChange={setSelectedPayee}
                      className="max-h-56 overflow-y-auto p-1.5 rounded-lg border border-border space-y-1.5"
                    >
                      {payeeList.map((p) => {
                        const hasBank = bankStatuses[p.userId] || false;
                        return (
                          <Radio
                            key={p.id}
                            value={p.id}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-surface data-[selected=true]:bg-accent-soft data-[selected=true]:border-accent/40 cursor-pointer"
                          >
                            <Radio.Control>
                              <Radio.Indicator />
                            </Radio.Control>
                            <Radio.Content className="flex items-center gap-3 flex-1 min-w-0">
                              <Avatar size="sm">
                                <Avatar.Fallback>
                                  <Users size={13} />
                                </Avatar.Fallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="text-foreground text-sm font-semibold truncate">
                                  {p.label}
                                </div>
                                <div className="text-muted text-xs truncate">
                                  {p.email}
                                </div>
                              </div>
                              {hasBank ? (
                                <Chip
                                  color="success"
                                  variant="soft"
                                  size="sm"
                                  className="shrink-0"
                                >
                                  <Building2 size={10} /> Bank
                                </Chip>
                              ) : (
                                <Chip
                                  color="warning"
                                  variant="soft"
                                  size="sm"
                                  className="shrink-0"
                                >
                                  <AlertTriangle size={10} /> No bank
                                </Chip>
                              )}
                            </Radio.Content>
                          </Radio>
                        );
                      })}
                    </RadioGroup>
                  )}
                </div>

                {/* No-bank warning */}
                {selectedP && !bankStatuses[selectedP.userId] && (
                  <Card className="bg-warning-soft border-warning/40">
                    <Card.Content className="p-3 flex items-center gap-2 text-xs text-warning-soft-foreground font-medium">
                      <AlertTriangle size={13} />
                      This user hasn't set up their bank account. They'll be
                      notified via Telegram + web to configure it.
                    </Card.Content>
                  </Card>
                )}

                {/* Amount */}
                <NumberField
                  value={amount === '' ? NaN : Number(amount)}
                  onChange={(v) => setAmount(Number.isNaN(v) ? '' : String(v))}
                  minValue={1}
                  step={0.01}
                  formatOptions={{
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  }}
                  aria-label="Amount in USD"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Amount (USD)
                  </Label>
                  {escrowInfo && (
                    <div className="mb-2 text-[11px] font-medium px-3 py-2 rounded-lg bg-surface-secondary border border-border text-foreground">
                      Campaign escrow · deposited $
                      {Number(escrowInfo.deposited || 0).toLocaleString()} ·
                      committed $
                      {Number(escrowInfo.committed || 0).toLocaleString()} ·{' '}
                      <span className="text-success font-semibold">
                        available $
                        {Number(escrowInfo.available || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <NumberField.Group>
                    <NumberField.Input placeholder="0.00" />
                    <NumberField.DecrementButton />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>

                {/* Note */}
                <TextField
                  value={note}
                  onChange={setNote}
                  aria-label="Payment note"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Payment note (optional)
                  </Label>
                  <Input
                    className={fieldClass}
                    style={fieldStyle}
                    placeholder="e.g. Payment for Instagram Reel campaign"
                  />
                </TextField>

                {/* Method */}
                <div>
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Payment method
                  </Label>
                  <RadioButtonGroup
                    aria-label="Payment method"
                    value={paymentMethod}
                    onChange={(v) =>
                      setPaymentMethod(v as 'flutterwave' | 'telebirr')
                    }
                    layout="flex"
                  >
                    <RadioButtonGroup.Item value="flutterwave">
                      <RadioButtonGroup.ItemIcon>
                        <CreditCard size={16} />
                      </RadioButtonGroup.ItemIcon>
                      <RadioButtonGroup.ItemContent>
                        Flutterwave
                      </RadioButtonGroup.ItemContent>
                      <RadioButtonGroup.Indicator />
                    </RadioButtonGroup.Item>
                    <RadioButtonGroup.Item value="telebirr">
                      <RadioButtonGroup.ItemIcon>
                        <Smartphone size={16} />
                      </RadioButtonGroup.ItemIcon>
                      <RadioButtonGroup.ItemContent>
                        Telebirr
                      </RadioButtonGroup.ItemContent>
                      <RadioButtonGroup.Indicator />
                    </RadioButtonGroup.Item>
                  </RadioButtonGroup>
                </div>

                {/* Method info */}
                <Card className="bg-accent-soft border-accent/30">
                  <Card.Content className="p-3 flex items-center gap-2.5">
                    {paymentMethod === 'flutterwave' ? (
                      <Shield
                        size={16}
                        className="text-accent-soft-foreground shrink-0"
                      />
                    ) : (
                      <Smartphone
                        size={16}
                        className="text-accent-soft-foreground shrink-0"
                      />
                    )}
                    <div>
                      <div className="text-foreground text-xs font-semibold">
                        {paymentMethod === 'flutterwave'
                          ? 'Flutterwave secure checkout'
                          : 'Telebirr checkout'}
                      </div>
                      <div className="text-muted text-[11px]">
                        {paymentMethod === 'flutterwave'
                          ? 'Supports cards, bank transfer, mobile money, and more.'
                          : 'Pay directly using your Ethio Telecom Telebirr account.'}
                      </div>
                    </div>
                  </Card.Content>
                </Card>

                {error && (
                  <Card className="bg-danger-soft border-danger/40">
                    <Card.Content className="p-3 flex items-center gap-2 text-sm font-medium text-danger-soft-foreground">
                      <AlertTriangle size={14} /> {error}
                    </Card.Content>
                  </Card>
                )}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            {success ? (
              <Button variant="primary" onPress={onPaid}>
                Finish & close
              </Button>
            ) : (
              <>
                <Button variant="ghost" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  isDisabled={payeeList.length === 0}
                  isPending={sending}
                  onPress={handlePay}
                >
                  <Send size={13} /> Send payment
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

/* ─── Flutterwave inline checkout (unchanged) ───────────────────── */
function launchFlutterwaveCheckout(
  paymentData: any,
  publicKey: string,
  onSuccess: () => void
) {
  if (!(window as any).FlutterwaveCheckout) {
    const script = document.createElement('script');
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.onload = () => doCheckout(paymentData, publicKey, onSuccess);
    document.head.appendChild(script);
  } else {
    doCheckout(paymentData, publicKey, onSuccess);
  }
}

function doCheckout(data: any, publicKey: string, onSuccess: () => void) {
  (window as any).FlutterwaveCheckout({
    public_key: publicKey,
    tx_ref: data.tx_ref,
    amount: data.amount,
    currency: data.currency || 'USD',
    customer: data.customer,
    customizations: data.customizations || { title: 'CampaignHub Payment' },
    callback: async (response: any) => {
      const transactionId = response?.transaction_id || response?.id;
      const txRef = response?.tx_ref || data?.tx_ref;
      const status = response?.status;
      if (txRef) {
        try {
          await api.post('/payments/confirm', {
            txRef: String(txRef),
            transactionId: transactionId ? String(transactionId) : undefined,
            status: status ? String(status) : undefined,
          });
        } catch {}
      }
      if (transactionId) {
        try {
          await api.post('/payments/verify', {
            transactionId: String(transactionId),
            txRef: txRef ? String(txRef) : undefined,
          });
        } catch {}
      }
      onSuccess();
    },
    onclose: () => {},
  });
}

export default Payments;
