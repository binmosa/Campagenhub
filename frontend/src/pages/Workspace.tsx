import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  ExternalLink,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  Label,
  Modal,
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
import { CheckCircle2 as DoneIcon, Clock as TodoIcon } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'reviewed' | string;
  contract_id?: string;
  due_date?: string;
  post_link?: string;
  ai_review?: string;
  assignedTo?: { id?: string; email?: string };
};

type Contract = {
  id: string;
  status: string;
  title?: string;
  opponent_id?: string;
  opponent_email?: string;
};

type Member = {
  id: string;
  email?: string;
  contractId?: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'To do',
  in_progress: 'In progress',
  completed: 'Done',
  reviewed: 'Reviewed',
};

const STATUS_COLOR: Record<
  string,
  'success' | 'warning' | 'accent' | 'default'
> = {
  pending: 'warning',
  in_progress: 'accent',
  completed: 'success',
  reviewed: 'accent',
};

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted';
const fieldStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  outline: 'none',
};

/* ── Add task modal ──────────────────────────────────────────────── */
const AddTaskModal: React.FC<{
  contractId: string;
  members: Member[];
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}> = ({ contractId, members, isOpen, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setAssignedTo(members.length ? [members[0].id] : []);
      setDueDate('');
    }
  }, [isOpen, members]);

  const toggle = (id: string) =>
    setAssignedTo((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const submit = async () => {
    if (!title.trim() || !assignedTo.length) return;
    setSaving(true);
    try {
      await Promise.all(
        assignedTo.map((id) => {
          const m = members.find((x) => x.id === id);
          return api.post('/tasks', {
            contract_id: m?.contractId || contractId,
            title,
            description,
            assigned_to: id,
            due_date: dueDate || undefined,
          });
        })
      );
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create task(s)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>New task</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Title *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Post Instagram Reel"
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task details…"
                  className={`${fieldClass} resize-none`}
                  style={fieldStyle}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-muted text-xs font-medium uppercase tracking-wider">
                    Assign to *
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAssignedTo(
                        assignedTo.length === members.length
                          ? []
                          : members.map((m) => m.id)
                      )
                    }
                    className="text-accent text-[10px] font-medium"
                  >
                    {assignedTo.length === members.length
                      ? 'Deselect all'
                      : 'Select all'}
                  </button>
                </div>
                <div
                  className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg p-2"
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                  }}
                >
                  {members.map((m) => (
                    <Checkbox
                      key={m.id}
                      isSelected={assignedTo.includes(m.id)}
                      onChange={() => toggle(m.id)}
                    >
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Content>
                        <Label className="text-foreground text-sm">
                          {m.email?.split('@')[0] || 'User'}
                        </Label>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Due date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isDisabled={!title.trim() || !assignedTo.length}
              isPending={saving}
              onPress={submit}
            >
              <Plus size={13} /> Create task
              {assignedTo.length > 1 ? 's' : ''}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Submit post modal (creator) ─────────────────────────────────── */
const SubmitPostModal: React.FC<{
  contracts: Contract[];
  myId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}> = ({ contracts, myId, isOpen, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [postLink, setPostLink] = useState('');
  const [contractId, setContractId] = useState(contracts[0]?.id || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setPostLink('');
      setContractId(contracts[0]?.id || '');
    }
  }, [isOpen, contracts]);

  const submit = async () => {
    if (!postLink.trim()) return;
    setSaving(true);
    try {
      const taskRes = await api.post('/tasks', {
        contract_id: contractId,
        title: title.trim() || 'Independent content submission',
        assigned_to: myId,
      });
      const taskId =
        taskRes.data.id ||
        (Array.isArray(taskRes.data) && taskRes.data[0]?.id);
      if (taskId) {
        await api.patch(`/tasks/${taskId}`, {
          status: 'completed',
          post_link: postLink,
        });
      }
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to submit post');
    } finally {
      setSaving(false);
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
              <Sparkles size={16} className="text-accent" />
              Submit content
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Contract / brand
                </label>
                <select
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                >
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title?.replace('Contract with ', '') ||
                        `Contract ${c.id.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Post link *
                </label>
                <input
                  value={postLink}
                  onChange={(e) => setPostLink(e.target.value)}
                  placeholder="https://instagram.com/p/…"
                  className={fieldClass}
                  style={fieldStyle}
                />
                <p className="text-warning text-[10px] font-medium mt-1.5 inline-flex items-center gap-1">
                  <AlertCircle size={10} /> Only Instagram links are currently
                  supported for AI scanning.
                </p>
              </div>
              <div>
                <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Title (optional)
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. My TikTok review"
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isDisabled={!postLink.trim()}
              isPending={saving}
              onPress={submit}
            >
              <ExternalLink size={13} /> Submit & analyze
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Task card ──────────────────────────────────────────────────── */
const TaskCard: React.FC<{
  task: Task;
  isBrand: boolean;
  onUpdate: () => void;
}> = ({ task, isBrand, onUpdate }) => {
  const [linkInput, setLinkInput] = useState(task.post_link || '');
  const [saving, setSaving] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const statusColor = STATUS_COLOR[task.status] || 'default';

  const updateStatus = async (status: string, postLink?: string) => {
    setSaving(true);
    try {
      await api.patch(`/tasks/${task.id}`, { status, post_link: postLink });
      onUpdate();
    } catch {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const completed = task.status === 'completed' || task.status === 'reviewed';

  return (
    <Card>
      <Card.Content className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-foreground text-sm font-semibold">
                {task.title}
              </span>
              <Chip color={statusColor} variant="soft" size="sm">
                {STATUS_LABEL[task.status] || task.status}
              </Chip>
            </div>
            {task.description && (
              <p className="text-muted text-xs line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
          {isBrand && (
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              className="!rounded-lg !text-danger"
              aria-label="Delete task"
              onPress={async () => {
                if (confirm('Delete this task?')) {
                  await api.delete(`/tasks/${task.id}`);
                  onUpdate();
                }
              }}
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 text-muted text-[11px]">
          <span className="inline-flex items-center gap-1">
            <Users size={10} />
            {task.assignedTo?.email?.split('@')[0] || 'Unknown'}
          </span>
          {task.due_date && (
            <span className="inline-flex items-center gap-1">
              <Clock size={10} />
              Due {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Creator: post link input */}
        {!isBrand && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link2
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="Paste Instagram post link…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface text-foreground text-xs placeholder:text-muted"
                  style={fieldStyle}
                />
              </div>
              <Button
                variant={completed ? 'primary' : 'primary'}
                size="sm"
                className="!rounded-lg"
                isDisabled={!linkInput && !task.post_link}
                isPending={saving}
                onPress={() =>
                  updateStatus(
                    task.status === 'pending' || task.status === 'in_progress'
                      ? 'completed'
                      : task.status,
                    linkInput
                  )
                }
              >
                <CheckCircle size={12} />{' '}
                {completed ? 'Update link' : 'Done'}
              </Button>
            </div>
            <p className="text-warning text-[10px] font-medium inline-flex items-center gap-1">
              <AlertCircle size={10} /> Only Instagram links supported for AI
              scanning.
            </p>
          </div>
        )}

        {/* Creator: start working */}
        {task.status === 'pending' && !isBrand && (
          <Button
            variant="outline"
            size="sm"
            fullWidth
            className="!rounded-lg"
            isPending={saving}
            onPress={() => updateStatus('in_progress')}
          >
            <ArrowRight size={12} /> Start working
          </Button>
        )}

        {task.post_link && (
          <a
            href={task.post_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-accent font-medium truncate hover:underline"
            style={{
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <ExternalLink size={11} />
            {task.post_link}
          </a>
        )}

        {/* Brand: review */}
        {isBrand && task.status === 'completed' && (
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              className="!rounded-lg flex-1"
              isPending={saving}
              onPress={() => updateStatus('reviewed')}
            >
              <CheckCircle size={12} /> Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="!rounded-lg flex-1"
              isPending={saving}
              onPress={() => updateStatus('in_progress')}
            >
              <AlertCircle size={12} /> Reject
            </Button>
          </div>
        )}

        {/* AI monitoring badge */}
        {completed && task.post_link && !task.ai_review && (
          <Chip color="accent" variant="soft" size="sm">
            <Sparkles size={11} /> AI bot actively monitoring
          </Chip>
        )}

        {task.ai_review && (
          <div>
            <button
              type="button"
              onClick={() => setShowAi((v) => !v)}
              className="inline-flex items-center gap-1.5 text-accent text-[11px] font-medium"
            >
              <Sparkles size={11} /> AI analysis{' '}
              {showAi ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showAi && (
              <div className="mt-2 p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap bg-accent-soft border border-accent/30 text-foreground">
                {task.ai_review}
              </div>
            )}
          </div>
        )}
      </Card.Content>
    </Card>
  );
};

/* ── Main page ──────────────────────────────────────────────────── */
const WorkspacePage: React.FC = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase();
  const isBrand = role === 'brand';

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeContract, setActiveContract] = useState<string | null>(null);
  const [addModalState, setAddModalState] = useState<{
    contractId: string;
    members: Member[];
  } | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'in_progress' | 'completed'
  >('all');

  const token = localStorage.getItem('token');
  const myId = useMemo(() => {
    if (!token) return '';
    try {
      return JSON.parse(atob(token.split('.')[1])).sub || '';
    } catch {
      return '';
    }
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contractsRes, tasksRes] = await Promise.all([
        api.get('/contracts/mine'),
        isBrand ? api.get('/tasks/assigned') : api.get('/tasks/mine'),
      ]);
      const active = (contractsRes.data || []).filter((c: Contract) =>
        ['active', 'approved'].includes(c.status)
      );
      setContracts(active);
      setTasks(tasksRes.data || []);
      if (isBrand) {
        try {
          const prog = await api.get('/tasks/progress');
          setProgress(prog.data);
        } catch {}
      }
    } catch {}
    setLoading(false);
  }, [isBrand]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (activeContract && t.contract_id !== activeContract) return false;
        if (filter !== 'all' && t.status !== filter) return false;
        return true;
      }),
    [tasks, activeContract, filter]
  );

  const stats = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter(
        (t) => t.status === 'completed' || t.status === 'reviewed'
      ).length,
    }),
    [tasks]
  );

  const openAddTaskModal = () => {
    const contract = activeContract
      ? contracts.find((c) => c.id === activeContract)
      : contracts[0];
    if (!contract) return;
    const memberSet = new Map<string, Member>();
    contracts.forEach((c) => {
      if (c.opponent_id) {
        memberSet.set(c.opponent_id, {
          id: c.opponent_id,
          email: c.opponent_email || 'Talent',
          contractId: c.id,
        });
      }
    });
    if (memberSet.size === 0) {
      tasks.forEach((t) => {
        if (t.assignedTo)
          memberSet.set(t.assignedTo.id || 'u', {
            id: t.assignedTo.id || 'u',
            email: t.assignedTo.email,
            contractId: t.contract_id,
          });
      });
    }
    if (memberSet.size === 0)
      memberSet.set('unknown', { id: 'unknown', email: 'team@member' });
    setAddModalState({
      contractId: contract.id,
      members: Array.from(memberSet.values()),
    });
  };

  return (
    <PageShell
      hero
      containerSize="wide"
      title={isBrand ? 'Team' : 'Your'}
      titleAccent="workspace"
      description={
        isBrand
          ? 'Tasks and deliverables for every creator on an active contract — assign, track, review.'
          : 'Your assigned tasks and deliverables, with the links you submit for review.'
      }
      icon={<ClipboardList size={18} />}
      actions={
        isBrand && contracts.length > 0 ? (
          <Button variant="primary" size="md" onPress={openAddTaskModal}>
            <Plus size={14} /> Assign task
          </Button>
        ) : role === 'creator' && contracts.length > 0 ? (
          <Button variant="primary" size="md" onPress={() => setShowSubmitModal(true)}>
            <Sparkles size={14} /> Submit content
          </Button>
        ) : undefined
      }
      stats={
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Total tasks" value={stats.total} icon={ClipboardList} />
          <MetricCard label="To do" value={stats.pending} hint="pending start" icon={TodoIcon} iconStatus={stats.pending ? 'warning' : undefined} />
          <MetricCard label="In progress" value={stats.in_progress} hint="active now" icon={TrendingUp} />
          <MetricCard
            label="Completed"
            value={stats.completed}
            hint={stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% done` : 'no tasks yet'}
            icon={DoneIcon}
            iconStatus="success"
          />
        </div>
      }
    >

      {/* Brand team progress */}
      {isBrand && progress?.team_breakdown?.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title className="inline-flex items-center gap-2 text-base">
              <TrendingUp size={15} className="text-accent" /> Team progress
            </Card.Title>
          </Card.Header>
          <Separator />
          <Card.Content className="p-5 space-y-2">
            {progress.team_breakdown.map((m: any) => {
              const pct = m.total > 0 ? (m.completed / m.total) * 100 : 0;
              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: 'var(--surface-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Avatar size="sm">
                    <Avatar.Fallback>
                      {(m.email?.[0] || '?').toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground text-sm font-semibold truncate">
                      {m.email?.split('@')[0]}
                    </div>
                    <div
                      className="mt-1 h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'var(--border)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: 'var(--success)',
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-muted text-xs font-medium shrink-0 tabular-nums">
                    {m.completed}/{m.total}
                  </span>
                </div>
              );
            })}
          </Card.Content>
        </Card>
      )}

      {/* Toolbar: status filter (left) + contract filter & primary action (right) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Segment
          selectedKey={filter}
          onSelectionChange={(k) => setFilter(k as typeof filter)}
        >
          <Segment.Item id="all">All · {stats.total}</Segment.Item>
          <Segment.Item id="pending">To do · {stats.pending}</Segment.Item>
          <Segment.Item id="in_progress">
            In progress · {stats.in_progress}
          </Segment.Item>
          <Segment.Item id="completed">Done · {stats.completed}</Segment.Item>
        </Segment>

        <div className="flex items-center gap-2 flex-wrap">
          {contracts.length > 0 && (
            <Segment
              selectedKey={activeContract || 'all'}
              onSelectionChange={(k) =>
                setActiveContract(k === 'all' ? null : (k as string))
              }
              size="sm"
            >
              <Segment.Item id="all">All contracts</Segment.Item>
              {contracts.slice(0, 4).map((c) => (
                <Segment.Item key={c.id} id={c.id}>
                  {(
                    c.title?.replace('Contract with ', '') ||
                    c.id?.slice(0, 8) ||
                    'Contract'
                  ).slice(0, 18)}
                </Segment.Item>
              ))}
            </Segment>
          )}

        </div>
      </div>

      {/* Tasks */}
      {loading ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="v-talent-card p-4">
              <div className="v-skel h-4 w-1/3 mb-2" />
              <div className="v-skel h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <EmptyPanel
          icon={<ClipboardList size={22} />}
          title={tasks.length === 0 ? 'No tasks yet' : 'Nothing in this view'}
          description={
            tasks.length > 0
              ? 'Switch the status or contract filter to see the rest.'
              : isBrand
                ? contracts.length > 0
                  ? 'Assign the first deliverable to someone on your team — they get notified and can submit links here.'
                  : 'Tasks live on contracts. Accept an applicant or invitation first, then assign work here.'
                : 'Tasks assigned to you by brands will appear here with their deadlines.'
          }
          actions={
            tasks.length > 0 ? (
              <Button variant="primary" size="sm" onPress={() => { setFilter('all'); setActiveContract(null); }}>
                Show all tasks
              </Button>
            ) : isBrand && contracts.length > 0 ? (
              <Button variant="primary" onPress={openAddTaskModal}>
                <Plus size={13} /> Assign a task
              </Button>
            ) : isBrand ? (
              <Link to="/dashboard/applications">
                <Button variant="primary">Open the applicant inbox</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isBrand={isBrand}
              onUpdate={load}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {addModalState && (
        <AddTaskModal
          contractId={addModalState.contractId}
          members={addModalState.members}
          isOpen={!!addModalState}
          onClose={() => setAddModalState(null)}
          onCreated={load}
        />
      )}
      {contracts.length > 0 && (
        <SubmitPostModal
          contracts={contracts}
          myId={myId}
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          onCreated={load}
        />
      )}
    </PageShell>
  );
};

export default WorkspacePage;
