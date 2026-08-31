import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Calendar,
  Camera,
  DollarSign,
  Edit3,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  Separator,
  Switch,
} from '@heroui/react';
import { EmptyState, KPI, Segment } from '@heroui-pro/react';
import api from '../lib/api';
import { PageShell } from '../components/ui';

const CURRENCIES = ['NGN', 'USD', 'KES', 'GHS', 'ZAR', 'UGX', 'EUR', 'GBP', 'XOF'];
const FREQUENCIES = ['monthly', 'yearly'];

const fieldClass =
  'w-full px-3 py-2 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

const formatMoney = (amount: number, currency: string) =>
  `${currency} ${Number(amount || 0).toLocaleString()}`;

type Member = {
  id: string;
  member?: { email?: string };
  member_type?: string;
  permissions?: any;
  payment_amount?: number | string;
  payment_frequency?: string;
  currency?: string;
  payment_day?: number;
};

const MemberCard: React.FC<{ member: Member; onUpdate: () => void }> = ({
  member,
  onUpdate,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [perms, setPerms] = useState(member.permissions || {});
  const [payAmount, setPayAmount] = useState(
    member.payment_amount?.toString() || ''
  );
  const [payFreq, setPayFreq] = useState(member.payment_frequency || 'monthly');
  const [payCurr, setPayCurr] = useState(member.currency || 'NGN');
  const [payDay, setPayDay] = useState(member.payment_day || 1);
  const [loading, setLoading] = useState(false);

  const savePerms = async () => {
    setLoading(true);
    try {
      await api.patch(`/invitations/team/${member.id}/permissions`, {
        permissions: perms,
      });
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const savePayment = async () => {
    setLoading(true);
    try {
      await api.patch(`/invitations/team/${member.id}/payment-terms`, {
        payment_amount: payAmount,
        payment_frequency: payFreq,
        currency: payCurr,
        payment_day: payDay,
      });
      setEditMode(false);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async () => {
    if (
      !window.confirm(
        `Remove ${member.member?.email} from your team? Their contract will end.`
      )
    )
      return;
    setLoading(true);
    try {
      await api.delete(`/invitations/team/${member.id}`);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const isManager = member.member_type === 'manager';
  const email = member.member?.email || 'Team member';
  const initial = email[0].toUpperCase();

  const PermissionSwitch: React.FC<{
    label: string;
    field: string;
  }> = ({ label, field }) => (
    <Switch
      isSelected={!!perms[field]}
      onChange={(isSelected) => setPerms({ ...perms, [field]: isSelected })}
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Content>
        <Label className="text-sm">{label}</Label>
      </Switch.Content>
    </Switch>
  );

  return (
    <Card>
      <Card.Content className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar size="lg">
              <Avatar.Fallback>{initial}</Avatar.Fallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-foreground text-sm font-semibold truncate">
                  {email}
                </h3>
                <ShieldCheck size={13} className="text-accent shrink-0" />
              </div>
              <Chip
                color={isManager ? 'accent' : 'default'}
                variant="soft"
                size="sm"
                className="mt-1"
              >
                {isManager ? <Award size={10} /> : <Camera size={10} />}
                <Chip.Label className="capitalize">
                  {member.member_type || 'Member'}
                </Chip.Label>
              </Chip>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label="Edit payment"
              onPress={() => setEditMode((v) => !v)}
            >
              <Edit3 size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label="Remove member"
              isPending={loading}
              onPress={removeMember}
            >
              <Trash2 size={14} className="text-danger" />
            </Button>
          </div>
        </div>

        {/* Payment info */}
        {member.payment_amount && !editMode && (
          <div className="flex flex-wrap gap-2">
            <Chip color="success" variant="soft" size="sm">
              <DollarSign size={11} />
              <Chip.Label>
                {formatMoney(
                  Number(member.payment_amount),
                  member.currency || 'USD'
                )}{' '}
                / {member.payment_frequency}
              </Chip.Label>
            </Chip>
            <Chip color="default" variant="soft" size="sm">
              <Calendar size={11} />
              <Chip.Label>Day {member.payment_day}</Chip.Label>
            </Chip>
          </div>
        )}

        {/* Edit payment */}
        {editMode && (
          <Card className="bg-surface-secondary">
            <Card.Content className="p-4 space-y-3">
              <p className="text-muted text-xs font-medium uppercase tracking-wider">
                Edit payment terms
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                    Amount
                  </Label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                    Currency
                  </Label>
                  <select
                    value={payCurr}
                    onChange={(e) => setPayCurr(e.target.value)}
                    className={fieldClass}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                    Frequency
                  </Label>
                  <select
                    value={payFreq}
                    onChange={(e) => setPayFreq(e.target.value)}
                    className={fieldClass}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                    Payment day
                  </Label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={payDay}
                    onChange={(e) => setPayDay(Number(e.target.value))}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  isPending={loading}
                  onPress={savePayment}
                >
                  Save payment
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => setEditMode(false)}
                >
                  Cancel
                </Button>
              </div>
            </Card.Content>
          </Card>
        )}

        <Separator />

        {/* Permissions */}
        <div>
          <p className="text-muted text-xs font-medium uppercase tracking-wider mb-3">
            Permissions
          </p>
          <div className="flex flex-col gap-2 mb-3">
            <PermissionSwitch
              label="Add campaigns"
              field="can_add_campaigns"
            />
            <PermissionSwitch
              label="View analytics"
              field="can_view_analytics"
            />
            <PermissionSwitch
              label="Manage applications"
              field="can_manage_applications"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            isPending={loading}
            onPress={savePerms}
          >
            Save permissions
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
};

const MyTeam: React.FC = () => {
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'creator' | 'manager'>('all');

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/invitations/team')
      .then((res) => {
        setTeam(res.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = team.filter(
    (m) => filter === 'all' || m.member_type === filter
  );
  const creators = team.filter((m) => m.member_type === 'creator');
  const managers = team.filter((m) => m.member_type === 'manager');

  return (
    <PageShell
      title="My team"
      description="Manage your creators and managers, set permissions and payment terms."
      icon={<Users size={18} />}
      actions={
        <Link to="/dashboard/talent">
          <Button variant="primary" size="md">
            <Plus size={14} /> Recruit talent
          </Button>
        </Link>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPI>
          <KPI.Header>
            <KPI.Title>Total members</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={team.length} maximumFractionDigits={0} />
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Creators</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={creators.length} maximumFractionDigits={0} />
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Managers</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={managers.length} maximumFractionDigits={0} />
          </KPI.Content>
        </KPI>
      </div>

      {/* Filter tabs */}
      <Segment
        selectedKey={filter}
        onSelectionChange={(k) => setFilter(k as typeof filter)}
      >
        <Segment.Item id="all">All · {team.length}</Segment.Item>
        <Segment.Item id="creator">Creators · {creators.length}</Segment.Item>
        <Segment.Item id="manager">Managers · {managers.length}</Segment.Item>
      </Segment>

      {/* Team grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <Card.Content className="p-8">
            <EmptyState>
              <EmptyState.Media>
                <Users className="size-7" />
              </EmptyState.Media>
              <EmptyState.Title>Your team is empty</EmptyState.Title>
              <EmptyState.Description>
                Invite creators and managers from the talent network to build
                your team.
              </EmptyState.Description>
              <EmptyState.Content>
                <Link to="/dashboard/talent">
                  <Button variant="primary" size="md">
                    Browse talent network <ArrowRight size={13} />
                  </Button>
                </Link>
              </EmptyState.Content>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((m) => (
            <MemberCard key={m.id} member={m} onUpdate={load} />
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default MyTeam;
