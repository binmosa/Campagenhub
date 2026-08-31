import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  LayoutDashboard,
  Mail,
  Megaphone,
  Plus,
  Shield,
  Star,
  Users,
} from 'lucide-react';
import { Avatar, Button, Card, Chip, Separator } from '@heroui/react';
import { EmptyState, KPI } from '@heroui-pro/react';
import api from '../../lib/api';
import { PageShell } from '../../components/ui';

type TeamMember = {
  id: string;
  member?: { email?: string };
  member_type?: string;
  payment_amount?: number | string;
  currency?: string;
};

type Campaign = {
  id: string;
  title: string;
  status?: string;
  payout_range?: string;
  budget_range?: string;
};

type Invitation = { id: string; status: string };

type Contract = { id: string; status: string };

const BrandDashboard: React.FC = () => {
  const [data, setData] = useState({
    campaigns: 0,
    team: 0,
    pending_invites: 0,
    active_contracts: 0,
  });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/campaigns/mine').catch(() => ({ data: [] })),
      api.get('/invitations/team').catch(() => ({ data: [] })),
      api.get('/invitations/sent').catch(() => ({ data: [] })),
      api.get('/contracts/mine').catch(() => ({ data: [] })),
    ]).then(([camps, teamRes, invRes, conts]) => {
      const campData: Campaign[] = camps.data || [];
      const teamData: TeamMember[] = teamRes.data || [];
      const invData: Invitation[] = invRes.data || [];
      const contData: Contract[] = conts.data || [];

      setData({
        campaigns: campData.length,
        team: teamData.length,
        pending_invites: invData.filter((i) => i.status === 'pending').length,
        active_contracts: contData.filter(
          (c) => c.status === 'active' || c.status === 'approved'
        ).length,
      });
      setCampaigns(campData.slice(0, 4));
      setTeam(teamData.slice(0, 4));
      setInvitations(invData.filter((i) => i.status === 'pending').slice(0, 3));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageShell
      title="Brand Dashboard"
      description="Manage your campaigns, team, and collaborations."
      icon={<LayoutDashboard size={18} />}
      actions={
        <div className="flex items-center gap-2">
          <Link to="/dashboard/talent">
            <Button variant="tertiary" size="md">
              <Star size={14} /> Find talent
            </Button>
          </Link>
          <Link to="/dashboard/campaigns">
            <Button variant="primary" size="md">
              <Plus size={14} /> New campaign
            </Button>
          </Link>
        </div>
      }
    >
      {/* Pending invitations banner */}
      {invitations.length > 0 && (
        <Card className="bg-warning-soft border-warning/40">
          <Card.Content className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-surface text-warning-soft-foreground">
                <Mail size={17} />
              </span>
              <div>
                <p className="text-foreground text-sm font-semibold">
                  {invitations.length} invitation
                  {invitations.length > 1 ? 's' : ''} awaiting response
                </p>
                <p className="text-muted text-xs">
                  Track who accepted or declined your collaboration invites.
                </p>
              </div>
            </div>
            <Link to="/dashboard/invitations">
              <Button variant="primary" size="sm">
                Manage <ArrowRight size={12} />
              </Button>
            </Link>
          </Card.Content>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI>
          <KPI.Header>
            <KPI.Title>Campaigns</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={data.campaigns} maximumFractionDigits={0} />
            <KPI.Trend trend={data.campaigns > 0 ? 'up' : 'neutral'}>
              Total active
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Team members</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={data.team} maximumFractionDigits={0} />
            <KPI.Trend trend={data.team > 0 ? 'up' : 'neutral'}>
              On contracts
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Pending invites</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={data.pending_invites} maximumFractionDigits={0} />
            <KPI.Trend trend={data.pending_invites > 0 ? 'neutral' : 'up'}>
              Awaiting response
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Active contracts</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value
              value={data.active_contracts}
              maximumFractionDigits={0}
            />
            <KPI.Trend trend={data.active_contracts > 0 ? 'up' : 'neutral'}>
              Live now
            </KPI.Trend>
          </KPI.Content>
        </KPI>
      </div>

      {/* Team + Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My Team */}
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title className="inline-flex items-center gap-2 text-base">
              <Shield size={15} className="text-accent" /> My team
            </Card.Title>
            <Link to="/dashboard/my-team">
              <Button variant="tertiary" size="sm">
                Manage <ArrowRight size={11} />
              </Button>
            </Link>
          </Card.Header>
          <Separator />
          <Card.Content className="p-0">
            {team.length === 0 ? (
              <div className="p-6">
                <EmptyState>
                  <EmptyState.Media>
                    <Users className="size-7" />
                  </EmptyState.Media>
                  <EmptyState.Title>No team members yet</EmptyState.Title>
                  <EmptyState.Description>
                    Invite creators or browse the talent network.
                  </EmptyState.Description>
                  <EmptyState.Content>
                    <Link to="/dashboard/talent">
                      <Button variant="primary" size="sm">
                        <Star size={12} /> Browse talent
                      </Button>
                    </Link>
                  </EmptyState.Content>
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {team.map((m) => {
                  const email = m.member?.email || 'Team member';
                  const initial = email[0].toUpperCase();
                  return (
                    <li
                      key={m.id}
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
                          <div className="text-muted text-xs capitalize truncate">
                            {m.member_type || 'Member'}
                          </div>
                        </div>
                      </div>
                      {m.payment_amount && (
                        <Chip color="success" variant="soft" size="sm">
                          <Chip.Label>
                            {m.currency || 'USD'}{' '}
                            {Number(m.payment_amount).toLocaleString()}
                          </Chip.Label>
                        </Chip>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card.Content>
        </Card>

        {/* My Campaigns */}
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title className="inline-flex items-center gap-2 text-base">
              <Megaphone size={15} className="text-accent" /> My campaigns
            </Card.Title>
            <Link to="/dashboard/campaigns">
              <Button variant="tertiary" size="sm">
                See all <ArrowRight size={11} />
              </Button>
            </Link>
          </Card.Header>
          <Separator />
          <Card.Content className="p-0">
            {campaigns.length === 0 ? (
              <div className="p-6">
                <EmptyState>
                  <EmptyState.Media>
                    <Megaphone className="size-7" />
                  </EmptyState.Media>
                  <EmptyState.Title>No campaigns yet</EmptyState.Title>
                  <EmptyState.Description>
                    Create your first campaign to start receiving applications.
                  </EmptyState.Description>
                  <EmptyState.Content>
                    <Link to="/dashboard/campaigns">
                      <Button variant="primary" size="sm">
                        <Plus size={12} /> Create campaign
                      </Button>
                    </Link>
                  </EmptyState.Content>
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {campaigns.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground text-sm font-semibold truncate">
                        {c.title}
                      </div>
                      <div className="text-muted text-xs capitalize">
                        {c.status || 'active'}
                      </div>
                    </div>
                    <Chip color="accent" variant="soft" size="sm">
                      <Chip.Label>
                        {c.payout_range || c.budget_range || 'N/A'}
                      </Chip.Label>
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
        <Link to="/dashboard/applications">
          <Card className="hover:border-accent/40 transition-colors h-full">
            <Card.Content className="p-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-accent-soft text-accent-soft-foreground">
                <FileText size={17} />
              </span>
              <div>
                <div className="text-foreground text-sm font-semibold">
                  Applications inbox
                </div>
                <div className="text-muted text-xs">
                  Review pitches from creators
                </div>
              </div>
            </Card.Content>
          </Card>
        </Link>
        <Link to="/dashboard/messages">
          <Card className="hover:border-accent/40 transition-colors h-full">
            <Card.Content className="p-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-accent-soft text-accent-soft-foreground">
                <Mail size={17} />
              </span>
              <div>
                <div className="text-foreground text-sm font-semibold">
                  Messages
                </div>
                <div className="text-muted text-xs">
                  Chat with your collaborators
                </div>
              </div>
            </Card.Content>
          </Card>
        </Link>
        <Link to="/dashboard/analytics">
          <Card className="hover:border-accent/40 transition-colors h-full">
            <Card.Content className="p-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-accent-soft text-accent-soft-foreground">
                <Megaphone size={17} />
              </span>
              <div>
                <div className="text-foreground text-sm font-semibold">
                  Analytics
                </div>
                <div className="text-muted text-xs">
                  Performance across campaigns
                </div>
              </div>
            </Card.Content>
          </Card>
        </Link>
      </div>
    </PageShell>
  );
};

export default BrandDashboard;
