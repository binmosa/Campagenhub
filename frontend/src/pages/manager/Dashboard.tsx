import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Clock,
  FileText,
  LayoutDashboard,
  Mail,
  Star,
} from 'lucide-react';
import { Avatar, Button, Card, Chip, Separator } from '@heroui/react';
import { EmptyState, KPI } from '@heroui-pro/react';
import api from '../../lib/api';
import { PageShell } from '../../components/ui';

type Invitation = {
  id: string;
  status: string;
  message?: string;
  sender?: { email?: string };
};

type Contract = {
  id: string;
  status: string;
  title?: string;
  created_at?: string;
};

const STATUS_COLOR: Record<
  string,
  'success' | 'warning' | 'danger' | 'default'
> = {
  pending: 'warning',
  accepted: 'success',
  approved: 'success',
  active: 'success',
  rejected: 'danger',
};

const ManagerDashboard: React.FC = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/invitations/received').catch(() => ({ data: [] })),
      api.get('/contracts/mine').catch(() => ({ data: [] })),
    ]).then(([invs, conts]) => {
      setInvitations(invs.data || []);
      setContracts(conts.data || []);
      setLoading(false);
    });
  }, []);

  const pending = invitations.filter((i) => i.status === 'pending');
  const accepted = invitations.filter((i) => i.status === 'accepted');
  const activeContracts = contracts.filter(
    (c) => c.status === 'active' || c.status === 'approved'
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageShell
      title="Manager dashboard"
      description="Track your brand partnerships and collaboration contracts."
      icon={<LayoutDashboard size={18} />}
      actions={
        <Link to="/dashboard/talent">
          <Button variant="primary" size="md">
            <Star size={14} /> Browse talent
          </Button>
        </Link>
      }
    >
      {/* Pending invitations banner */}
      {pending.length > 0 && (
        <Card className="bg-warning-soft border-warning/40">
          <Card.Content className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-surface text-warning-soft-foreground">
                <Mail size={17} />
              </span>
              <div>
                <p className="text-foreground text-sm font-semibold">
                  {pending.length} brand invitation
                  {pending.length > 1 ? 's' : ''} waiting for you
                </p>
                <p className="text-muted text-xs">
                  Review contracts and accept to start collaborating.
                </p>
              </div>
            </div>
            <Link to="/dashboard/invitations">
              <Button variant="primary" size="sm">
                Review <ArrowRight size={12} />
              </Button>
            </Link>
          </Card.Content>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI>
          <KPI.Header>
            <KPI.Title>Invitations</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={invitations.length} maximumFractionDigits={0} />
            <KPI.Trend trend={invitations.length > 0 ? 'up' : 'neutral'}>
              All time
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Active brands</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={accepted.length} maximumFractionDigits={0} />
            <KPI.Trend trend={accepted.length > 0 ? 'up' : 'neutral'}>
              Collaborating
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Active contracts</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value
              value={activeContracts.length}
              maximumFractionDigits={0}
            />
            <KPI.Trend trend={activeContracts.length > 0 ? 'up' : 'neutral'}>
              Live now
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Pending</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={pending.length} maximumFractionDigits={0} />
            <KPI.Trend trend={pending.length > 0 ? 'neutral' : 'up'}>
              Awaiting reply
            </KPI.Trend>
          </KPI.Content>
        </KPI>
      </div>

      {/* Invitations + Contracts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent invitations */}
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title className="inline-flex items-center gap-2 text-base">
              <Mail size={15} className="text-accent" /> Recent invitations
            </Card.Title>
            <Link to="/dashboard/invitations">
              <Button variant="tertiary" size="sm">
                See all <ArrowRight size={11} />
              </Button>
            </Link>
          </Card.Header>
          <Separator />
          <Card.Content className="p-0">
            {invitations.length === 0 ? (
              <div className="p-6">
                <EmptyState>
                  <EmptyState.Media>
                    <Mail className="size-7" />
                  </EmptyState.Media>
                  <EmptyState.Title>No invitations yet</EmptyState.Title>
                  <EmptyState.Description>
                    Brands will invite you when they need a manager.
                  </EmptyState.Description>
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {invitations.slice(0, 5).map((inv) => {
                  const email = inv.sender?.email || 'Brand';
                  const initial = email[0].toUpperCase();
                  return (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar size="sm">
                          <Avatar.Fallback>{initial}</Avatar.Fallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-foreground text-sm font-semibold truncate">
                            {email.split('@')[0]}
                          </div>
                          <div className="text-muted text-xs truncate">
                            {inv.message?.slice(0, 50) ||
                              'Collaboration invitation'}
                          </div>
                        </div>
                      </div>
                      <Chip
                        color={STATUS_COLOR[inv.status] || 'default'}
                        variant="soft"
                        size="sm"
                      >
                        <Chip.Label className="capitalize">
                          {inv.status}
                        </Chip.Label>
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card.Content>
        </Card>

        {/* My contracts */}
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title className="inline-flex items-center gap-2 text-base">
              <FileText size={15} className="text-accent" /> My contracts
            </Card.Title>
            <Link to="/dashboard/contracts">
              <Button variant="tertiary" size="sm">
                See all <ArrowRight size={11} />
              </Button>
            </Link>
          </Card.Header>
          <Separator />
          <Card.Content className="p-0">
            {contracts.length === 0 ? (
              <div className="p-6">
                <EmptyState>
                  <EmptyState.Media>
                    <FileText className="size-7" />
                  </EmptyState.Media>
                  <EmptyState.Title>No contracts yet</EmptyState.Title>
                  <EmptyState.Description>
                    Accept an invitation to create your first contract.
                  </EmptyState.Description>
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {contracts.slice(0, 5).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground text-sm font-semibold truncate capitalize">
                        {c.title || `Contract #${c.id?.slice(0, 8)}`}
                      </div>
                      <div className="text-muted text-xs">
                        {c.created_at
                          ? new Date(c.created_at).toLocaleDateString()
                          : '—'}
                      </div>
                    </div>
                    <Chip
                      color={STATUS_COLOR[c.status] || 'default'}
                      variant="soft"
                      size="sm"
                    >
                      <Chip.Label className="capitalize">{c.status}</Chip.Label>
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/dashboard/workspace">
          <Card className="hover:border-accent/40 transition-colors h-full">
            <Card.Content className="p-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-accent-soft text-accent-soft-foreground">
                <Briefcase size={17} />
              </span>
              <div>
                <div className="text-foreground text-sm font-semibold">
                  Workspace
                </div>
                <div className="text-muted text-xs">
                  Tasks across all contracts
                </div>
              </div>
            </Card.Content>
          </Card>
        </Link>
        <Link to="/dashboard/offers">
          <Card className="hover:border-accent/40 transition-colors h-full">
            <Card.Content className="p-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-accent-soft text-accent-soft-foreground">
                <Building2 size={17} />
              </span>
              <div>
                <div className="text-foreground text-sm font-semibold">
                  Offers
                </div>
                <div className="text-muted text-xs">
                  Publish your services
                </div>
              </div>
            </Card.Content>
          </Card>
        </Link>
        <Link to="/dashboard/payments">
          <Card className="hover:border-accent/40 transition-colors h-full">
            <Card.Content className="p-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-accent-soft text-accent-soft-foreground">
                <Clock size={17} />
              </span>
              <div>
                <div className="text-foreground text-sm font-semibold">
                  Payments
                </div>
                <div className="text-muted text-xs">
                  Payouts and history
                </div>
              </div>
            </Card.Content>
          </Card>
        </Link>
      </div>
    </PageShell>
  );
};

export default ManagerDashboard;
