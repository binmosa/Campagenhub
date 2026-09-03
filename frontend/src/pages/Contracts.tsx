import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Download,
  FileText,
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
  KPI,
  Segment,
} from '@heroui-pro/react';
import api from '../lib/api';
import { MetricCard, PageShell } from '../components/ui';
import { EmptyPanel } from '../components/common/EmptyPanel';
import { toast } from '../lib/toast';
import { Link } from 'react-router-dom';
import { CheckCircle2 as ActiveIcon, Archive as EndedIcon } from 'lucide-react';

type Contract = {
  id: string;
  status: string;
  title?: string;
  type?: 'brand_creator' | 'brand_manager' | string;
  monthly_payment?: number | string;
  payment_amount?: number | string;
  payment_frequency?: string;
  payment_day?: number;
  currency?: string;
  next_payment_date?: string;
  ended_at?: string;
  termination_reason?: string;
  created_at?: string;
  content?: string;
  contract_content?: string;
  terms?: string;
  counterparty?: { name?: string; logo_url?: string };
};

const STATUS: Record<
  string,
  { label: string; color: 'success' | 'warning' | 'danger' | 'default' }
> = {
  active: { label: 'Active', color: 'success' },
  approved: { label: 'Active', color: 'success' },
  pending_signature: { label: 'Awaiting signature', color: 'warning' },
  ended: { label: 'Ended', color: 'default' },
  terminated: { label: 'Terminated', color: 'danger' },
};

const initialsOf = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

const ContractCard: React.FC<{ contract: Contract; onChange: () => void }> = ({
  contract,
  onChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS[contract.status] || STATUS.active;
  const text =
    contract.content || contract.contract_content || contract.terms || '';

  const downloadContract = () => {
    const fallback = `COLLABORATION AGREEMENT\n\nContract #${contract.id}\nStatus: ${contract.status}\nPayment: ${contract.currency || 'USD'} ${contract.payment_amount || contract.monthly_payment || 0}\n\nBound by the platform terms of Campgains Hub, digitally accepted.`;
    const blob = new Blob([text || fallback], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-${contract.id?.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const endContract = async () => {
    if (
      !window.confirm(
        'Are you sure you want to officially end this contract? Both parties will be notified.'
      )
    )
      return;
    try {
      await api.patch(`/contracts/${contract.id}/end`);
      onChange();
    } catch {
      toast.error('Failed to end contract');
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Top accent bar */}
      <div
        className="h-1"
        style={{
          background:
            cfg.color === 'success'
              ? 'linear-gradient(90deg, var(--success) 0%, var(--accent-2, var(--accent)) 100%)'
              : cfg.color === 'warning'
              ? 'linear-gradient(90deg, var(--warning) 0%, var(--accent) 100%)'
              : cfg.color === 'danger'
              ? 'linear-gradient(90deg, var(--danger) 0%, var(--accent) 100%)'
              : 'var(--border)',
        }}
      />
      <Card.Content className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar size="sm">
              {contract.counterparty?.logo_url && (
                <Avatar.Image
                  src={contract.counterparty.logo_url}
                  alt={contract.counterparty.name}
                />
              )}
              <Avatar.Fallback>
                {initialsOf(contract.counterparty?.name) || 'CT'}
              </Avatar.Fallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-foreground text-sm font-semibold capitalize truncate">
                  {contract.title || `Contract #${(contract.id || '').slice(0, 8)}`}
                </span>
                <Chip color={cfg.color} variant="soft" size="sm">
                  {cfg.label}
                </Chip>
              </div>
              <div className="text-muted text-xs mt-0.5">
                {contract.type === 'brand_creator'
                  ? 'Brand × Creator'
                  : contract.type === 'brand_manager'
                  ? 'Brand × Manager'
                  : 'Collaboration'}
                {contract.created_at &&
                  ` · ${new Date(contract.created_at).toLocaleDateString()}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {contract.status === 'active' && (
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                className="!rounded-lg !text-danger hover:!bg-danger-soft"
                aria-label="End contract"
                onPress={endContract}
              >
                <XCircle size={14} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              className="!rounded-lg"
              aria-label="Download"
              onPress={downloadContract}
            >
              <Download size={14} />
            </Button>
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

        {/* Payment summary chips */}
        {(contract.monthly_payment || contract.payment_amount) && (
          <div className="flex flex-wrap gap-2">
            <Chip color="success" variant="soft" size="sm">
              <DollarSign size={11} />
              {contract.currency || 'USD'}{' '}
              {Number(
                contract.monthly_payment || contract.payment_amount
              ).toLocaleString()}{' '}
              / {contract.payment_frequency || 'monthly'}
            </Chip>
            {contract.payment_day && (
              <Chip variant="secondary" size="sm">
                <Calendar size={11} /> Day {contract.payment_day}
              </Chip>
            )}
            {contract.next_payment_date && contract.status === 'active' && (
              <Chip color="accent" variant="soft" size="sm">
                <Clock size={11} />
                Next: {new Date(contract.next_payment_date).toLocaleDateString()}
              </Chip>
            )}
          </div>
        )}

        {contract.status === 'ended' && contract.ended_at && (
          <div className="mt-3 text-muted text-xs flex items-center gap-1.5">
            <XCircle size={12} className="text-danger" />
            Ended {new Date(contract.ended_at).toLocaleDateString()}
            {contract.termination_reason && ` · ${contract.termination_reason}`}
          </div>
        )}

        {expanded && text && (
          <>
            <Separator className="!my-4" />
            <div className="text-muted text-[10px] uppercase tracking-wider font-medium mb-2">
              Contract text
            </div>
            <div
              className="rounded-lg p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap max-h-52 overflow-y-auto"
              style={{
                background: 'var(--surface-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
            >
              {text}
            </div>
          </>
        )}
      </Card.Content>
    </Card>
  );
};

const ContractsPage: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all');
  const role = (localStorage.getItem('role') || 'creator').toLowerCase();

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/contracts/mine')
      .then((res) => {
        setContracts(res.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const active = contracts.filter((c) =>
      ['active', 'approved'].includes(c.status)
    ).length;
    const ended = contracts.filter((c) =>
      ['ended', 'terminated'].includes(c.status)
    ).length;
    return { all: contracts.length, active, ended };
  }, [contracts]);

  const filtered = useMemo(() => {
    if (filter === 'all') return contracts;
    if (filter === 'active')
      return contracts.filter((c) => ['active', 'approved'].includes(c.status));
    return contracts.filter((c) => ['ended', 'terminated'].includes(c.status));
  }, [contracts, filter]);

  return (
    <PageShell
      hero
      title={role === 'brand' ? 'Team' : 'Your'}
      titleAccent="contracts"
      description={
        role === 'brand'
          ? 'Every agreement with your creators and managers — terms, payment schedule and status in one place.'
          : 'Your active and past collaboration agreements, with the payment terms you signed.'
      }
      icon={<FileText size={18} />}
      stats={
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Contracts" value={counts.all} hint="all time" icon={FileText} />
          <MetricCard label="Active" value={counts.active} hint="currently signed" icon={ActiveIcon} iconStatus={counts.active ? 'success' : undefined} />
          <MetricCard label="Ended" value={counts.ended} hint="completed or terminated" icon={EndedIcon} />
        </div>
      }
    >

      {/* Filter */}
      <Segment
        selectedKey={filter}
        onSelectionChange={(k) => setFilter(k as typeof filter)}
        size="md"
      >
        <Segment.Item id="all">All · {counts.all}</Segment.Item>
        <Segment.Separator />
        <Segment.Item id="active">Active · {counts.active}</Segment.Item>
        <Segment.Separator />
        <Segment.Item id="ended">Ended · {counts.ended}</Segment.Item>
      </Segment>

      {/* List */}
      {loading ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="v-talent-card p-4">
              <div className="v-skel h-4 w-1/3 mb-2" />
              <div className="v-skel h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyPanel
          icon={<FileText size={22} />}
          title={filter === 'all' ? 'No contracts yet' : filter === 'active' ? 'No active contracts' : 'No ended contracts'}
          description={
            filter !== 'all' && contracts.length > 0
              ? 'Switch the filter to see your other agreements.'
              : role === 'brand'
                ? 'A contract is created the moment you accept an applicant with payment terms, or a creator accepts your invitation.'
                : 'Contracts appear here once a brand accepts your application or you accept an invitation.'
          }
          actions={
            filter !== 'all' && contracts.length > 0 ? (
              <Button variant="primary" size="sm" onPress={() => setFilter('all')}>
                Show all
              </Button>
            ) : role === 'brand' ? (
              <Link to="/dashboard/applications">
                <Button variant="primary">Open the applicant inbox</Button>
              </Link>
            ) : (
              <Link to="/campaigns">
                <Button variant="primary">Browse open briefs</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => (
            <ContractCard key={c.id} contract={c} onChange={load} />
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default ContractsPage;
