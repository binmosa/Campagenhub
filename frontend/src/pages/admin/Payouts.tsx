import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  ClipboardList,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  Loader,
  Mail,
  Smartphone,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import { Avatar, Button, Card, Chip, Modal, SearchField, Separator } from '@heroui/react';
import { DataGrid, EmptyState, KPI } from '@heroui-pro/react';
import type { DataGridColumn } from '@heroui-pro/react';
import api from '../../lib/api';
import { PageShell } from '../../components/ui';

type Payout = {
  id: string;
  status: string;
  amount: number | string;
  created_at: string;
  campaign?: { title?: string };
  creator?: {
    email?: string;
    creatorProfile?: { avatar_url?: string };
  };
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
  };
};

type BrandBalance = {
  brandId: string;
  brandEmail: string;
  deposited: number | string;
  committed: number | string;
  available: number | string;
};

type AuditLog = {
  id: string;
  action: string;
  details: string;
  created_at: string;
  user?: { email?: string; role?: string };
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  pending: 'warning',
  approved: 'default',
  paid: 'success',
  rejected: 'danger',
};

const ACTION_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  APPROVED_PAYOUT: 'default',
  EXECUTED_PAYOUT: 'success',
  REJECTED_PAYOUT: 'danger',
};

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

const AdminPayouts: React.FC = () => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmPayoutId, setConfirmPayoutId] = useState<string | null>(null);
  const [detailPayout, setDetailPayout] = useState<Payout | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [brandBalances, setBrandBalances] = useState<BrandBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const currentRole = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  const isAdmin = currentRole === 'admin';
  const isFinance = currentRole === 'finance';

  useEffect(() => {
    api
      .get('/admin/payouts')
      .then((res) => {
        setPayouts(res.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    if (isAdmin) {
      setAuditLoading(true);
      api
        .get('/admin/audit-logs')
        .then((res) => {
          setAuditLogs(res.data || []);
          setAuditLoading(false);
        })
        .catch(() => setAuditLoading(false));
    }

    if (isAdmin || isFinance) {
      setBalancesLoading(true);
      api
        .get('/admin/brand-balances')
        .then((res) => {
          setBrandBalances(res.data || []);
          setBalancesLoading(false);
        })
        .catch(() => setBalancesLoading(false));
    }
  }, [isAdmin, isFinance]);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/admin/payouts/${id}`, { status: newStatus });
      setPayouts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
      );
    } catch {
      alert('Failed to update payout status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExecutePayout = async () => {
    if (!confirmPayoutId) return;
    setActionLoading(confirmPayoutId);
    try {
      await api.post(`/admin/payouts/${confirmPayoutId}/execute`);
      setPayouts((prev) =>
        prev.map((p) =>
          p.id === confirmPayoutId ? { ...p, status: 'paid' } : p
        )
      );
      setConfirmPayoutId(null);
      alert('Transfer dispatched successfully via Flutterwave!');
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          'Failed to execute transfer. Please check escrow budget.'
      );
      setConfirmPayoutId(null);
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const filtered = useMemo(
    () =>
      payouts.filter((p) => {
        const matchesSearch =
          (p.creator?.email || '').toLowerCase().includes(search.toLowerCase()) ||
          (p.campaign?.title || '').toLowerCase().includes(search.toLowerCase()) ||
          p.status.toLowerCase().includes(search.toLowerCase());
        const matchesFilter =
          filterStatus === 'all' || p.status === filterStatus;
        return matchesSearch && matchesFilter;
      }),
    [payouts, search, filterStatus]
  );

  const stats = useMemo(
    () => ({
      pending: payouts.filter((p) => p.status === 'pending').length,
      approved: payouts.filter((p) => p.status === 'approved').length,
      paid: payouts.filter((p) => p.status === 'paid').length,
      total: payouts.reduce((s, p) => s + Number(p.amount || 0), 0),
    }),
    [payouts]
  );

  /* ─── Payouts DataGrid columns ────────────────────────────── */
  const payoutColumns: DataGridColumn<Payout>[] = [
    {
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => {
        const initial = (item.creator?.email || 'C')[0].toUpperCase();
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar size="sm">
              {item.creator?.creatorProfile?.avatar_url && (
                <Avatar.Image
                  src={item.creator.creatorProfile.avatar_url}
                  alt={item.creator.email}
                />
              )}
              <Avatar.Fallback>{initial}</Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-foreground text-sm font-medium truncate">
                {item.creator?.email || 'N/A'}
              </span>
              <span className="text-muted text-xs truncate">
                {item.campaign?.title || 'Direct payment'}
              </span>
            </div>
          </div>
        );
      },
      header: 'Recipient',
      id: 'recipient',
      isRowHeader: true,
      minWidth: 280,
    },
    {
      accessorKey: 'amount',
      align: 'end',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <span className="font-medium text-foreground tabular-nums">
          ${Number(item.amount || 0).toLocaleString()}
        </span>
      ),
      header: 'Amount',
      id: 'amount',
      minWidth: 120,
    },
    {
      accessorKey: 'status',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <Chip
          color={STATUS_COLOR[item.status] || 'default'}
          size="sm"
          variant="soft"
        >
          <Chip.Label className="capitalize">{item.status}</Chip.Label>
        </Chip>
      ),
      header: 'Status',
      id: 'status',
      minWidth: 120,
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
          })}
        </span>
      ),
      header: 'Created',
      id: 'created_at',
      minWidth: 130,
    },
    {
      align: 'end',
      allowsResizing: false,
      cell: (item) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => setDetailPayout(item)}
          >
            Details
          </Button>
          {item.status === 'approved' && (
            <Button
              variant="primary"
              size="sm"
              isPending={actionLoading === item.id}
              onPress={() => setConfirmPayoutId(item.id)}
            >
              <ExternalLink className="size-3" /> Execute
            </Button>
          )}
          {isAdmin && item.status === 'pending' && (
            <Button
              variant="primary"
              size="sm"
              isPending={actionLoading === item.id}
              onPress={() => handleStatusUpdate(item.id, 'approved')}
            >
              Approve
            </Button>
          )}
        </div>
      ),
      header: '',
      id: 'actions',
      minWidth: 240,
      pinned: 'end',
    },
  ];

  /* ─── Brand balances DataGrid columns ──────────────────────── */
  const balanceColumns: DataGridColumn<BrandBalance>[] = [
    {
      accessorKey: 'brandEmail',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <span className="text-foreground text-sm font-medium">
          {item.brandEmail}
        </span>
      ),
      header: 'Brand',
      id: 'brandEmail',
      isRowHeader: true,
      minWidth: 240,
    },
    {
      accessorKey: 'deposited',
      align: 'end',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <span className="text-foreground text-sm tabular-nums">
          ${Number(item.deposited || 0).toLocaleString()}
        </span>
      ),
      header: 'Deposited',
      id: 'deposited',
      minWidth: 130,
    },
    {
      accessorKey: 'committed',
      align: 'end',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <span className="text-muted text-sm tabular-nums">
          ${Number(item.committed || 0).toLocaleString()}
        </span>
      ),
      header: 'Committed',
      id: 'committed',
      minWidth: 130,
    },
    {
      accessorKey: 'available',
      align: 'end',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <span className="text-success text-sm font-medium tabular-nums">
          ${Number(item.available || 0).toLocaleString()}
        </span>
      ),
      header: 'Available',
      id: 'available',
      minWidth: 130,
    },
  ];

  /* ─── Audit DataGrid columns ──────────────────────────────── */
  const auditColumns: DataGridColumn<AuditLog>[] = [
    {
      allowsResizing: true,
      cell: (item) => (
        <div className="flex flex-col min-w-0">
          <span className="text-foreground text-sm font-medium truncate">
            {item.user?.email || 'System'}
          </span>
          <span className="text-muted text-xs capitalize truncate">
            {item.user?.role || 'N/A'}
          </span>
        </div>
      ),
      header: 'User',
      id: 'user',
      isRowHeader: true,
      minWidth: 220,
    },
    {
      accessorKey: 'action',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <Chip
          color={ACTION_COLOR[item.action] || 'default'}
          size="sm"
          variant="soft"
        >
          <Chip.Label>{item.action?.replace(/_/g, ' ')}</Chip.Label>
        </Chip>
      ),
      header: 'Action',
      id: 'action',
      minWidth: 180,
    },
    {
      allowsResizing: true,
      cell: (item) => {
        let details: any = {};
        try {
          details = JSON.parse(item.details || '{}');
        } catch {}
        return (
          <span className="text-muted text-sm">
            {details.creatorEmail && (
              <>
                To <span className="text-foreground font-medium">{details.creatorEmail}</span>
              </>
            )}
            {details.amount && (
              <>
                {' · '}
                <span className="text-foreground font-medium">
                  ${Number(details.amount).toLocaleString()}
                </span>
              </>
            )}
            {details.campaignTitle && ` · ${details.campaignTitle}`}
          </span>
        );
      },
      header: 'Details',
      id: 'details',
      minWidth: 300,
    },
    {
      accessorKey: 'created_at',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <span className="text-muted text-xs tabular-nums whitespace-nowrap">
          {new Date(item.created_at).toLocaleString()}
        </span>
      ),
      header: 'Timestamp',
      id: 'created_at',
      minWidth: 180,
    },
  ];

  const CopyRow: React.FC<{ label: string; value?: string; fieldId: string }> = ({
    label,
    value,
    fieldId,
  }) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-muted text-[10px] font-medium uppercase tracking-wider">
          {label}
        </div>
        <div className="text-foreground text-sm font-medium truncate">
          {value || 'Not set'}
        </div>
      </div>
      {value && (
        <Button
          variant="tertiary"
          size="sm"
          onPress={() => copyToClipboard(value, fieldId)}
        >
          {copiedField === fieldId ? (
            <>
              <CheckCircle className="size-3 text-success" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3" /> Copy
            </>
          )}
        </Button>
      )}
    </div>
  );

  return (
    <PageShell
      title="Payout management"
      description="Review pending payouts and manually dispatch funds via Flutterwave."
      icon={<DollarSign size={18} />}
    >
      {/* KPI stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI>
          <KPI.Header>
            <KPI.Title>Pending</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={stats.pending} maximumFractionDigits={0} />
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Approved</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={stats.approved} maximumFractionDigits={0} />
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Paid</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={stats.paid} maximumFractionDigits={0} />
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Total volume</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value
              value={stats.total}
              style="currency"
              currency="USD"
              notation="compact"
              maximumFractionDigits={1}
            />
          </KPI.Content>
        </KPI>
      </div>

      {/* Brand balances */}
      {(isAdmin || isFinance) && (
        <Card>
          <Card.Header>
            <Card.Title className="text-base">Brand wallet balances</Card.Title>
            <Card.Description>
              Escrow snapshot — funds deposited, committed, and available for transfer.
            </Card.Description>
          </Card.Header>
          <Separator />
          <Card.Content className="p-0">
            {balancesLoading ? (
              <div className="p-8 text-center text-muted text-sm">
                Loading balances…
              </div>
            ) : (
              <DataGrid
                allowsColumnResize
                aria-label="Brand balances"
                columns={balanceColumns}
                contentClassName="min-w-[700px]"
                data={brandBalances}
                getRowId={(item) => item.brandId}
                renderEmptyState={() => 'No brand balances yet.'}
                selectionMode="none"
                variant="primary"
              />
            )}
          </Card.Content>
        </Card>
      )}

      {/* Payouts toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={`${fieldClass} sm:w-44`}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
        <div className="flex items-center gap-3">
          <SearchField
            aria-label="Search payouts"
            value={search}
            onChange={setSearch}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                className="w-full sm:w-[280px]"
                placeholder="Search by creator, campaign, or status…"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <a
            href="https://app.flutterwave.com/dashboard/payments/transfers/new/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="tertiary" size="md" className="whitespace-nowrap">
              <ExternalLink className="size-3.5" /> Flutterwave
            </Button>
          </a>
        </div>
      </div>

      {/* Payouts list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : payouts.length === 0 ? (
        <Card>
          <Card.Content className="p-8">
            <EmptyState>
              <EmptyState.Media>
                <DollarSign className="size-7" />
              </EmptyState.Media>
              <EmptyState.Title>No payouts yet</EmptyState.Title>
              <EmptyState.Description>
                Payouts appear here when brands deposit funds for creators.
              </EmptyState.Description>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <DataGrid
          allowsColumnResize
          aria-label="Payouts"
          columns={payoutColumns}
          contentClassName="min-w-[1100px]"
          data={filtered}
          defaultSortDescriptor={{
            column: 'created_at',
            direction: 'descending',
          }}
          getRowId={(item) => item.id}
          renderEmptyState={() => 'No payouts match the filter.'}
          selectionMode="none"
          variant="primary"
        />
      )}

      {/* Audit logs (admin only) */}
      {isAdmin && (
        <Card>
          <Card.Header>
            <Card.Title className="inline-flex items-center gap-2 text-base">
              <ClipboardList size={15} className="text-accent" />
              Finance & staff activity log
            </Card.Title>
          </Card.Header>
          <Separator />
          <Card.Content className="p-0">
            {auditLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8">
                <EmptyState>
                  <EmptyState.Media>
                    <ClipboardList className="size-6" />
                  </EmptyState.Media>
                  <EmptyState.Title>No activity recorded yet</EmptyState.Title>
                  <EmptyState.Description>
                    Finance staff actions appear here once taken.
                  </EmptyState.Description>
                </EmptyState>
              </div>
            ) : (
              <DataGrid
                allowsColumnResize
                aria-label="Audit logs"
                columns={auditColumns}
                contentClassName="min-w-[900px]"
                data={auditLogs}
                defaultSortDescriptor={{
                  column: 'created_at',
                  direction: 'descending',
                }}
                getRowId={(item) => item.id}
                selectionMode="none"
                variant="primary"
              />
            )}
          </Card.Content>
        </Card>
      )}

      {/* Detail modal */}
      <Modal
        isOpen={!!detailPayout}
        onOpenChange={(open) => !open && setDetailPayout(null)}
      >
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Payout details</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {detailPayout && (
                <div className="space-y-5">
                  {/* Recipient summary */}
                  <Card>
                    <Card.Content className="p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="size-3.5 text-muted" />
                        <span className="text-foreground">
                          {detailPayout.creator?.email || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CreditCard className="size-3.5 text-muted" />
                        <span className="text-foreground">
                          Amount:{' '}
                          <span className="font-semibold">
                            ${Number(detailPayout.amount || 0).toLocaleString()}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="size-3.5 text-muted" />
                        <span className="text-foreground">
                          Campaign:{' '}
                          <span className="font-medium">
                            {detailPayout.campaign?.title || 'Direct'}
                          </span>
                        </span>
                      </div>
                    </Card.Content>
                  </Card>

                  {/* Payout account */}
                  <div>
                    <div className="text-muted text-xs font-medium uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
                      <Building2 className="size-3" /> Recipient payout details
                    </div>
                    {detailPayout.payoutAccount ? (
                      <Card>
                        <Card.Content className="p-4 divide-y divide-border">
                          {(detailPayout.payoutAccount.account_type === 'bank' ||
                            detailPayout.payoutAccount.bank_name) && (
                            <>
                              <CopyRow
                                label="Bank name"
                                value={detailPayout.payoutAccount.bank_name}
                                fieldId={`bank-${detailPayout.id}`}
                              />
                              <CopyRow
                                label="Account number"
                                value={detailPayout.payoutAccount.account_number}
                                fieldId={`acct-${detailPayout.id}`}
                              />
                              <CopyRow
                                label="Account name"
                                value={detailPayout.payoutAccount.account_name}
                                fieldId={`name-${detailPayout.id}`}
                              />
                              <CopyRow
                                label="Bank code"
                                value={detailPayout.payoutAccount.bank_code}
                                fieldId={`code-${detailPayout.id}`}
                              />
                              <div className="py-2">
                                <div className="text-muted text-[10px] font-medium uppercase tracking-wider">
                                  Currency
                                </div>
                                <div className="text-foreground text-sm font-medium">
                                  {detailPayout.payoutAccount.currency || 'USD'}
                                </div>
                              </div>
                            </>
                          )}
                          {detailPayout.payoutAccount.mobile_number && (
                            <CopyRow
                              label={`Mobile money · ${detailPayout.payoutAccount.mobile_network || ''}`}
                              value={detailPayout.payoutAccount.mobile_number}
                              fieldId={`mobile-${detailPayout.id}`}
                            />
                          )}
                          {detailPayout.payoutAccount.is_verified && (
                            <div className="pt-2">
                              <Chip color="success" size="sm" variant="soft">
                                <CheckCircle className="size-3" />
                                <Chip.Label>Bank verified</Chip.Label>
                              </Chip>
                            </div>
                          )}
                        </Card.Content>
                      </Card>
                    ) : (
                      <Card className="bg-danger-soft border-danger/40">
                        <Card.Content className="p-3 flex items-center gap-2 text-sm font-medium text-danger-soft-foreground">
                          <AlertCircle className="size-3.5" />
                          <span>
                            No payout account configured. Recipient must set bank
                            details first.
                          </span>
                        </Card.Content>
                      </Card>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-col gap-2">
                    {detailPayout.status === 'approved' && (
                      <Button
                        variant="primary"
                        fullWidth
                        isPending={actionLoading === detailPayout.id}
                        onPress={() => {
                          setConfirmPayoutId(detailPayout.id);
                          setDetailPayout(null);
                        }}
                      >
                        <ExternalLink className="size-3.5" /> Execute transfer
                      </Button>
                    )}
                    {isAdmin && detailPayout.status === 'pending' && (
                      <Button
                        variant="primary"
                        fullWidth
                        isPending={actionLoading === detailPayout.id}
                        onPress={() => {
                          handleStatusUpdate(detailPayout.id, 'approved');
                          setDetailPayout(null);
                        }}
                      >
                        <CheckCircle className="size-3.5" /> Approve payout
                      </Button>
                    )}
                    {detailPayout.status !== 'paid' &&
                      detailPayout.status !== 'rejected' && (
                        <Button
                          variant="danger-soft"
                          fullWidth
                          isPending={actionLoading === detailPayout.id}
                          onPress={() => {
                            handleStatusUpdate(detailPayout.id, 'rejected');
                            setDetailPayout(null);
                          }}
                        >
                          <XCircle className="size-3.5" /> Reject payout
                        </Button>
                      )}
                  </div>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={() => setDetailPayout(null)}>
                Close
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Confirm transfer modal */}
      <Modal
        isOpen={!!confirmPayoutId}
        onOpenChange={(open) => !open && setConfirmPayoutId(null)}
      >
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="inline-flex items-center gap-2">
                <UserIcon className="size-4" />
                Confirm escrow transfer
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-muted text-sm">
                You're about to securely dispatch funds from the platform escrow
                to the recipient's bank via Flutterwave. The system automatically
                validates the brand's escrow deposit.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="ghost"
                onPress={() => setConfirmPayoutId(null)}
                isDisabled={actionLoading === confirmPayoutId}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                isPending={actionLoading === confirmPayoutId}
                onPress={handleExecutePayout}
              >
                {actionLoading === confirmPayoutId ? (
                  <Loader className="size-4 animate-spin" />
                ) : (
                  <CheckCircle className="size-4" />
                )}
                Confirm dispatch
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </PageShell>
  );
};

export default AdminPayouts;
