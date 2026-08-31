import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { Avatar, Button, Card, Chip, Modal, SearchField } from '@heroui/react';
import {
  DataGrid,
  EmptyState,
  KPI,
  Segment,
} from '@heroui-pro/react';
import type { DataGridColumn } from '@heroui-pro/react';
import type { Selection } from 'react-aria-components';
import { Briefcase } from 'lucide-react';
import api from '../../lib/api';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { ContractManager } from '../../components/contracts/ContractManager';
import { PageShell } from '../../components/ui';
import PublicCampaigns from '../PublicCampaigns';

/**
 * Creator Applications — two-tab workspace.
 *
 *   "My applications" — the creator's outbound applications with status filters
 *                       and per-card actions (message, view contract, submit).
 *   "Browse campaigns" — the public marketplace, re-rendered inline.
 */

type Application = {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | string;
  pitch?: string;
  created_at?: string;
  campaign?: {
    id?: string;
    title?: string;
    platform?: string;
    budget?: number | string;
    brand?: {
      email?: string;
      brandProfile?: { company_name?: string; logo_url?: string };
    };
  };
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  accepted: 'success',
  pending: 'warning',
  rejected: 'danger',
  declined: 'danger',
};

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm';
const fieldStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  outline: 'none',
};

const formatBudget = (raw?: number | string) => {
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
};

const initials = (name?: string) =>
  (name || 'B')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/* ── Applications DataGrid ──────────────────────────────────────── */
interface ApplicationsTableProps {
  applications: Application[];
  selectedKeys: Selection;
  onSelectionChange: (keys: Selection) => void;
  onChat: (app: Application) => void;
  onContract: (app: Application) => void;
  onSubmit: (app: Application) => void;
}

const ApplicationsTable: React.FC<ApplicationsTableProps> = ({
  applications,
  selectedKeys,
  onSelectionChange,
  onChat,
  onContract,
  onSubmit,
}) => {
  const columns: DataGridColumn<Application>[] = [
    {
      accessorKey: 'campaign',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => {
        const brand = item.campaign?.brand;
        const brandName =
          brand?.brandProfile?.company_name ||
          brand?.email?.split('@')[0] ||
          'Brand';
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar size="sm">
              {brand?.brandProfile?.logo_url && (
                <Avatar.Image
                  src={brand.brandProfile.logo_url}
                  alt={brandName}
                />
              )}
              <Avatar.Fallback>{initials(brandName)}</Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-foreground text-sm font-medium truncate">
                {item.campaign?.title || 'Untitled campaign'}
              </span>
              <span className="text-muted text-xs truncate">{brandName}</span>
            </div>
          </div>
        );
      },
      header: 'Campaign',
      id: 'campaign',
      isRowHeader: true,
      minWidth: 240,
    },
    {
      accessorKey: 'status',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => {
        const statusKey =
          item.status === 'declined' ? 'rejected' : item.status;
        const color = STATUS_COLOR[statusKey] || 'default';
        return (
          <Chip color={color} size="sm" variant="soft">
            <Chip.Label className="capitalize">{statusKey}</Chip.Label>
          </Chip>
        );
      },
      header: 'Status',
      id: 'status',
      minWidth: 120,
    },
    {
      allowsResizing: true,
      cell: (item) => (
        <span className="capitalize text-muted text-sm">
          {item.campaign?.platform || '—'}
        </span>
      ),
      header: 'Platform',
      id: 'platform',
      minWidth: 110,
    },
    {
      align: 'end',
      allowsResizing: true,
      cell: (item) => (
        <span className="font-medium text-foreground tabular-nums">
          {formatBudget(item.campaign?.budget)}
        </span>
      ),
      header: 'Budget',
      id: 'budget',
      minWidth: 110,
    },
    {
      accessorKey: 'pitch',
      allowsResizing: true,
      cell: (item) => (
        <span className="text-muted text-sm line-clamp-1">
          {item.pitch || 'No pitch'}
        </span>
      ),
      header: 'Pitch',
      id: 'pitch',
      minWidth: 240,
    },
    {
      accessorKey: 'created_at',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <span className="text-muted text-sm tabular-nums">
          {item.created_at
            ? new Date(item.created_at).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </span>
      ),
      header: 'Applied',
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
            isIconOnly
            aria-label="Message brand"
            onPress={() => onChat(item)}
          >
            <MessageSquare className="size-3.5" />
          </Button>
          {item.status === 'accepted' && (
            <>
              <Button
                variant="tertiary"
                size="sm"
                isIconOnly
                aria-label="View contract"
                onPress={() => onContract(item)}
              >
                <FileText className="size-3.5" />
              </Button>
              <Button
                variant="primary"
                size="sm"
                onPress={() => onSubmit(item)}
              >
                <LinkIcon className="size-3" /> Submit
              </Button>
            </>
          )}
        </div>
      ),
      header: '',
      id: 'actions',
      minWidth: 160,
      pinned: 'end',
    },
  ];

  return (
    <DataGrid
      allowsColumnResize
      showSelectionCheckboxes
      aria-label="My applications"
      columns={columns}
      contentClassName="min-w-[1100px]"
      data={applications}
      defaultSortDescriptor={{ column: 'created_at', direction: 'descending' }}
      getRowId={(item) => item.id}
      renderEmptyState={() => 'No applications match the filter.'}
      selectedKeys={selectedKeys}
      selectionMode="multiple"
      variant="primary"
      onSelectionChange={onSelectionChange}
    />
  );
};

const CreatorApplications: React.FC = () => {
  const [tab, setTab] = useState<'applications' | 'browse'>('applications');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'accepted' | 'rejected'
  >('all');
  const [query, setQuery] = useState('');

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingApp, setSubmittingApp] = useState<Application | null>(null);
  const [contentLink, setContentLink] = useState('');
  const [submitPending, setSubmitPending] = useState(false);
  const [chatApp, setChatApp] = useState<Application | null>(null);
  const [contractApp, setContractApp] = useState<Application | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setCurrentUserId(res.data.userId))
      .catch(() => {});
    api
      .get('/applications')
      .then((res) => {
        setApplications(res.data || []);
        setLoading(false);
      })
      .catch(() => {
        setApplications([]);
        setLoading(false);
      });
  }, []);

  /* ── Derived ──────────────────────────────────────────────────── */
  const counts = useMemo(() => {
    const c = {
      all: applications.length,
      pending: 0,
      accepted: 0,
      rejected: 0,
    };
    for (const a of applications) {
      const s = a.status === 'declined' ? 'rejected' : a.status;
      if (s in c) (c as any)[s]++;
    }
    return c;
  }, [applications]);

  const totalEarnings = useMemo(
    () =>
      applications
        .filter((a) => a.status === 'accepted')
        .reduce((s, a) => s + (parseFloat(String(a.campaign?.budget)) || 0), 0),
    [applications]
  );

  const filtered = useMemo(() => {
    return applications.filter((a) => {
      const s = a.status === 'declined' ? 'rejected' : a.status;
      if (statusFilter !== 'all' && s !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const title = a.campaign?.title?.toLowerCase() || '';
        const brand =
          a.campaign?.brand?.brandProfile?.company_name?.toLowerCase() || '';
        if (!title.includes(q) && !brand.includes(q)) return false;
      }
      return true;
    });
  }, [applications, statusFilter, query]);

  /* ── Submit content link ──────────────────────────────────────── */
  const handleSubmitContent = async () => {
    if (!submittingApp || !contentLink.trim()) return;
    setSubmitPending(true);
    try {
      await api.post(`/tracking/application/${submittingApp.id}/link`, {
        url: contentLink,
      });
      alert('Content submitted successfully! The AI verifier is analyzing it now.');
      setSubmittingApp(null);
      setContentLink('');
    } catch {
      alert('Failed to submit link');
    } finally {
      setSubmitPending(false);
    }
  };

  return (
    <PageShell
      title="Campaigns"
      description="Track your applications and discover new opportunities."
      icon={<Briefcase size={18} />}
      actions={
        <Segment
          selectedKey={tab}
          onSelectionChange={(k) => setTab(k as typeof tab)}
          size="md"
        >
          <Segment.Item id="applications">My applications</Segment.Item>
          <Segment.Separator />
          <Segment.Item id="browse">Browse</Segment.Item>
        </Segment>
      }
    >
      {tab === 'browse' ? (
        /* Render the public marketplace inline */
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mb-8 lg:-mb-12">
          <PublicCampaigns isDashboard />
        </div>
      ) : (
        <>
          {/* ─── KPI summary ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPI>
              <KPI.Header>
                <KPI.Title>Total submitted</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <KPI.Value value={counts.all} maximumFractionDigits={0} />
                <KPI.Trend trend="neutral">All time</KPI.Trend>
              </KPI.Content>
            </KPI>
            <KPI>
              <KPI.Header>
                <KPI.Title>Accepted</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <KPI.Value value={counts.accepted} maximumFractionDigits={0} />
                <KPI.Trend trend={counts.accepted > 0 ? 'up' : 'neutral'}>
                  {counts.all > 0
                    ? `${Math.round((counts.accepted / counts.all) * 100)}% rate`
                    : 'No data'}
                </KPI.Trend>
              </KPI.Content>
            </KPI>
            <KPI>
              <KPI.Header>
                <KPI.Title>Pending</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <KPI.Value value={counts.pending} maximumFractionDigits={0} />
                <KPI.Trend trend="neutral">Awaiting brand</KPI.Trend>
              </KPI.Content>
            </KPI>
            <KPI>
              <KPI.Header>
                <KPI.Title>Won earnings</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <KPI.Value
                  value={totalEarnings}
                  style="currency"
                  currency="USD"
                  notation="compact"
                  maximumFractionDigits={1}
                />
                <KPI.Trend trend={totalEarnings > 0 ? 'up' : 'neutral'}>
                  From accepted apps
                </KPI.Trend>
              </KPI.Content>
            </KPI>
          </div>

          {/* ─── Toolbar: filter Segment + SearchField ───────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Segment
              selectedKey={statusFilter}
              onSelectionChange={(k) => setStatusFilter(k as typeof statusFilter)}
            >
              <Segment.Item id="all">All · {counts.all}</Segment.Item>
              <Segment.Item id="pending">Pending · {counts.pending}</Segment.Item>
              <Segment.Item id="accepted">Accepted · {counts.accepted}</Segment.Item>
              <Segment.Item id="rejected">Rejected · {counts.rejected}</Segment.Item>
            </Segment>

            <SearchField
              aria-label="Search applications"
              value={query}
              onChange={setQuery}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  className="w-full sm:w-[220px]"
                  placeholder="Search…"
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>

          {/* ─── Content area ────────────────────────────────────── */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <Card.Content className="p-8">
                <EmptyState>
                  <EmptyState.Media>
                    <Activity className="size-7" />
                  </EmptyState.Media>
                  <EmptyState.Title>
                    {applications.length === 0
                      ? 'No applications yet'
                      : 'Nothing matches that filter'}
                  </EmptyState.Title>
                  <EmptyState.Description>
                    {applications.length === 0
                      ? 'Browse open campaigns and apply to your first one.'
                      : 'Try clearing search or switching status filter.'}
                  </EmptyState.Description>
                  <EmptyState.Content>
                    <Button
                      variant="primary"
                      onPress={() =>
                        applications.length === 0
                          ? setTab('browse')
                          : (setQuery(''), setStatusFilter('all'))
                      }
                    >
                      {applications.length === 0 ? (
                        <>
                          <Sparkles size={14} /> Browse campaigns
                        </>
                      ) : (
                        <>
                          <X size={14} /> Clear filters
                        </>
                      )}
                    </Button>
                  </EmptyState.Content>
                </EmptyState>
              </Card.Content>
            </Card>
          ) : (
            <>
              <ApplicationsTable
                applications={filtered}
                selectedKeys={selectedKeys}
                onSelectionChange={setSelectedKeys}
                onChat={(app) => setChatApp(app)}
                onContract={(app) => setContractApp(app)}
                onSubmit={(app) => setSubmittingApp(app)}
              />

              {/* Summary footer */}
              <div className="flex items-center justify-between px-4 text-sm">
                <span className="text-muted">
                  {filtered.length.toLocaleString()} application
                  {filtered.length === 1 ? '' : 's'}
                  {(() => {
                    const count =
                      selectedKeys === 'all'
                        ? filtered.length
                        : (selectedKeys as Set<string | number>).size;
                    return count > 0 ? (
                      <> · {count.toLocaleString()} selected</>
                    ) : null;
                  })()}
                </span>
                {totalEarnings > 0 && (
                  <span className="text-muted">
                    Won:{' '}
                    <span className="text-foreground font-medium tabular-nums">
                      ${totalEarnings.toLocaleString()}
                    </span>
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ─── Submit-content modal ─────────────────────────────────── */}
      <Modal
        isOpen={!!submittingApp}
        onOpenChange={(open) => !open && setSubmittingApp(null)}
      >
        <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Submit deliverables</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-muted text-sm">
                Paste the link to your draft or published content. Our AI verifier
                will analyze it and notify the brand.
              </p>
              <div className="mt-4">
                <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Content link
                </label>
                <div className="relative">
                  <ExternalLink
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                  />
                  <input
                    type="url"
                    className={`${fieldClass} pl-9`}
                    style={fieldStyle}
                    placeholder="https://instagram.com/p/…"
                    value={contentLink}
                    onChange={(e) => setContentLink(e.target.value)}
                  />
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="ghost"
                onPress={() => {
                  setSubmittingApp(null);
                  setContentLink('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                isDisabled={!contentLink.trim()}
                isPending={submitPending}
                onPress={handleSubmitContent}
              >
                <Send size={13} /> Submit
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ─── Chat & contract drawers (existing components) ───────── */}
      {chatApp && tab === 'applications' && (
        <ChatWindow
          applicationId={chatApp.id}
          currentUserId={currentUserId}
          onClose={() => setChatApp(null)}
          brandName={chatApp.campaign?.brand?.email}
        />
      )}
      {contractApp && tab === 'applications' && (
        <ContractManager
          applicationId={contractApp.id}
          isBrand={false}
          onClose={() => setContractApp(null)}
        />
      )}
    </PageShell>
  );
};

export default CreatorApplications;
