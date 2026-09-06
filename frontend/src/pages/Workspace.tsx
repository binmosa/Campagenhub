import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  ExternalLink,
  Link2,
  ListChecks,
  Lock,
  MessageSquare,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import api from '../lib/api';
import { formatBudget } from '../lib/campaignFormat';
import { parseCampaignTasks, type CampaignTask } from '../lib/catalog';
import { MetricCard, PageShell } from '../components/ui';
import { EmptyPanel } from '../components/common/EmptyPanel';
import { DashPanel, PanelEmpty } from '../components/common/DashPanel';
import { StoryAvatar } from '../components/common/StoryAvatar';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Notice } from '../components/common/Notice';
import { toast } from '../lib/toast';
import { fieldClass } from './talent/shared';

/**
 * Workspace — deliverables, grouped by the campaign each contract was signed
 * for. One panel per active contract: the brand assigns and reviews tasks
 * under it, the creator starts them and submits links. A freshly signed
 * creator sees exactly what is expected next instead of an empty page.
 */
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'reviewed';
type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus | string;
  contract_id?: string;
  campaign?: { id: string; title: string; platform?: string | null } | null;
  platform?: string | null;
  source?: string | null;
  due_date?: string | null;
  post_link?: string | null;
  assignedTo?: { id?: string; email?: string } | null;
  assignedBy?: { id?: string; email?: string } | null;
};
type Contract = {
  id: string;
  status: string;
  title?: string;
  type?: string;
  payment_amount?: number | string | null;
  currency?: string | null;
  payment_frequency?: string | null;
  ends_at?: string | null;
  kind?: string;
  opponent_id?: string;
  opponent_email?: string;
  opponent_name?: string;
  opponent_avatar?: string | null;
  application?: { id: string; campaign?: { id: string; title: string; platform?: string | null; tasks?: unknown } | null } | null;
};
type Section = {
  key: string;
  contract: Contract | null;
  campaignId: string | null;
  title: string;
  platforms: string[];
  templates: CampaignTask[];
  partner: { id: string; name: string; email: string; avatar?: string | null };
  tasks: Task[];
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'accent' | 'default'> = {
  pending: 'warning',
  in_progress: 'accent',
  completed: 'accent',
  reviewed: 'success',
};
const URL_RE = /^https?:\/\/\S+$/i;
const isDone = (s: string) => s === 'completed' || s === 'reviewed';
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '');
const splitPlatforms = (p?: string | null) =>
  String(p || '')
    .split(/[,|]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/* ── One task row ─────────────────────────────────────────────────── */
const TaskItem: React.FC<{ task: Task; isBrand: boolean; onChanged: () => void }> = ({ task, isBrand, onChanged }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState(task.post_link || '');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState('');

  const update = async (status: string, postLink?: string) => {
    setBusy(true);
    setErr('');
    try {
      await api.patch(`/tasks/${task.id}`, { status, ...(postLink !== undefined ? { post_link: postLink } : {}) });
      setLinkOpen(false);
      onChanged();
    } catch (e: any) {
      setErr(e?.response?.data?.message || t('ops.ws.errUpdate'));
    } finally {
      setBusy(false);
    }
  };

  const submitLink = () => {
    const url = link.trim();
    if (!URL_RE.test(url)) return setErr(t('wizard.errMediaUrl'));
    update('completed', url);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/tasks/${task.id}`);
      toast.success(t('ops.ws.deleted'));
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('ops.ws.errUpdate'));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const status = String(task.status);
  const overdue = !!task.due_date && !isDone(status) && new Date(task.due_date).getTime() < Date.now() - 86_400_000;
  const sub = [
    task.platform,
    task.due_date ? t('ops.ws.dueOn', { date: fmtDate(task.due_date) }) : '',
    isBrand && task.assignedTo?.email ? task.assignedTo.email.split('@')[0] : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const hasMore = !!(task.description || task.post_link);

  return (
    <li className="py-2.5 first:pt-0 last:pb-0" data-testid="task-item">
      <div className="flex items-center gap-3">
        <span
          className="shrink-0 inline-flex items-center justify-center rounded-full"
          style={{
            width: 32,
            height: 32,
            background: status === 'reviewed' ? 'rgba(22,199,132,0.14)' : status === 'pending' ? 'var(--color-cool-gray)' : 'rgba(108,99,255,0.12)',
            color: status === 'reviewed' ? 'var(--color-signal-green)' : status === 'pending' ? 'var(--color-slate)' : 'var(--color-campaign-purple)',
          }}
        >
          {status === 'reviewed' ? <CheckCircle2 size={15} /> : status === 'pending' ? <Clock size={15} /> : status === 'completed' ? <Link2 size={15} /> : <Play size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{task.title}</span>
            {task.source === 'brief' && (
              <Chip variant="soft" size="sm" color="default">
                <Chip.Label>{t('ops.ws.fromBrief')}</Chip.Label>
              </Chip>
            )}
          </div>
          <div className="v-caption truncate" style={{ fontSize: 11.5, color: overdue ? '#b3261e' : undefined }}>
            {overdue && <AlertTriangle size={10} className="inline mr-1 -mt-0.5" />}
            {sub || t('ops.ws.noDue')}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <Chip color={STATUS_COLOR[status] || 'default'} variant="soft" size="sm">
            <Chip.Label>{t(`ops.ws.status.${status}`, { defaultValue: status.replace('_', ' ') })}</Chip.Label>
          </Chip>
          {!isBrand && status === 'pending' && (
            <Button variant="tertiary" size="sm" onPress={() => update('in_progress')} isPending={busy}>
              <Play size={11} /> {t('ops.ws.start')}
            </Button>
          )}
          {!isBrand && !isDone(status) && (
            <Button variant="primary" size="sm" onPress={() => setLinkOpen((v) => !v)} isDisabled={busy}>
              <Link2 size={11} /> {t('ops.ws.submitLink')}
            </Button>
          )}
          {!isBrand && status === 'completed' && (
            <>
              <Button variant="ghost" size="sm" onPress={() => setLinkOpen((v) => !v)} isDisabled={busy}>
                {t('ops.ws.updateLink')}
              </Button>
              <Button variant="ghost" size="sm" className="!text-danger" onPress={() => update('in_progress', '')} isPending={busy}>
                {t('ops.ws.withdraw')}
              </Button>
            </>
          )}
          {status === 'reviewed' && (
            <span className="v-caption v-quiet inline-flex items-center gap-1" style={{ fontSize: 11.5 }}>
              <Lock size={11} /> {t('ops.ws.locked')}
            </span>
          )}
          {isBrand && status === 'completed' && (
            <>
              <Button variant="tertiary" size="sm" onPress={() => update('in_progress')} isPending={busy}>
                <RotateCcw size={11} /> {t('ops.ws.sendBack')}
              </Button>
              <Button variant="primary" size="sm" onPress={() => update('reviewed')} isPending={busy}>
                <CheckCircle2 size={11} /> {t('ops.ws.approve')}
              </Button>
            </>
          )}
          {isBrand && status === 'pending' && (
            <Button variant="ghost" size="sm" isIconOnly aria-label={t('ops.ws.delete')} onPress={() => setConfirmDelete(true)} isDisabled={busy}>
              <Trash2 size={13} />
            </Button>
          )}
          {hasMore && (
            <Button variant="ghost" size="sm" isIconOnly aria-label={open ? t('common.close') : t('ops.ws.details')} onPress={() => setOpen((v) => !v)}>
              {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </Button>
          )}
        </div>
      </div>

      {(open || linkOpen || err) && (
        <div className="mt-2 ml-11 space-y-2">
          {err && <Notice tone="error" onDismiss={() => setErr('')}>{err}</Notice>}
          {open && task.description && (
            <p className="v-body v-ink whitespace-pre-wrap" style={{ fontSize: 12.5, lineHeight: 1.55 }}>{task.description}</p>
          )}
          {open && task.post_link && (
            <a href={task.post_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 v-caption font-medium hover:underline" style={{ color: 'var(--color-campaign-purple)', fontSize: 12 }}>
              <ExternalLink size={11} /> {task.post_link}
            </a>
          )}
          {linkOpen && (
            <div className="flex items-center gap-2">
              <input
                className={fieldClass}
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={t('ops.ws.linkPh')}
                inputMode="url"
                aria-label={t('ops.ws.link')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitLink();
                  }
                }}
              />
              <Button variant="primary" size="sm" onPress={submitLink} isPending={busy} isDisabled={!link.trim()}>
                <CheckCircle2 size={11} /> {t('ops.ws.done')}
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        tone="danger"
        pending={busy}
        title={t('ops.ws.deleteTitle')}
        body={t('ops.ws.deleteBody', { title: task.title })}
        confirmLabel={t('ops.ws.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={remove}
        onClose={() => !busy && setConfirmDelete(false)}
      />
    </li>
  );
};

/* ── Brand: assign a task under a campaign ─────────────────────────── */
const AssignTaskModal: React.FC<{
  sections: Section[];
  initialKey: string;
  onClose: () => void;
  onCreated: () => void;
}> = ({ sections, initialKey, onClose, onCreated }) => {
  const { t } = useTranslation();
  const [key, setKey] = useState(initialKey);
  const section = sections.find((s) => s.key === key) || sections[0];
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [due, setDue] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const missingTemplates = useMemo(
    () => (section ? section.templates.filter((tpl) => !section.tasks.some((task) => task.title.trim().toLowerCase() === tpl.title.trim().toLowerCase())) : []),
    [section],
  );

  const prefill = (tpl: CampaignTask) => {
    setTitle(tpl.title);
    setPlatform(tpl.platform || '');
    setDescription(tpl.description || '');
    setDue(tpl.due_days ? new Date(Date.now() + tpl.due_days * 86_400_000).toISOString().slice(0, 10) : '');
  };

  const create = async (items: { title: string; platform?: string; description?: string; due?: string }[]) => {
    if (!section?.contract) return;
    setSaving(true);
    setError('');
    try {
      for (const it of items) {
        await api.post('/tasks', {
          contract_id: section.contract.id,
          campaign_id: section.campaignId,
          title: it.title,
          description: it.description || undefined,
          platform: it.platform || null,
          due_date: it.due || undefined,
          assigned_to: section.partner.id,
        });
      }
      toast.success(t('ops.ws.assigned', { count: items.length, name: section.partner.name }));
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || t('ops.ws.errUpdate'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && !saving && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <ListChecks size={16} style={{ color: 'var(--color-campaign-purple)' }} /> {t('ops.ws.assign')}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
                <div>
                  <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('ops.ws.for')}</label>
                  <select className={fieldClass} value={section?.key} onChange={(e) => setKey(e.target.value)} aria-label={t('ops.ws.for')}>
                    {sections
                      .filter((s) => s.contract)
                      .map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.title} · {s.partner.name}
                        </option>
                      ))}
                  </select>
                </div>
                {missingTemplates.length > 0 && (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }}>
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <span className="v-caption v-ink font-medium" style={{ fontSize: 12.5 }}>{t('ops.ws.templates')}</span>
                      <Button
                        variant="tertiary"
                        size="sm"
                        isPending={saving}
                        onPress={() =>
                          create(
                            missingTemplates.map((tpl) => ({
                              title: tpl.title,
                              platform: tpl.platform,
                              description: tpl.description,
                              due: tpl.due_days ? new Date(Date.now() + tpl.due_days * 86_400_000).toISOString().slice(0, 10) : undefined,
                            })),
                          )
                        }
                      >
                        <Plus size={11} /> {t('ops.ws.addFromBrief', { count: missingTemplates.length })}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {missingTemplates.map((tpl) => (
                        <button key={tpl.key} type="button" className="v-niche-chip" onClick={() => prefill(tpl)} title={t('ops.ws.pickTemplate')}>
                          {tpl.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label htmlFor="task-title" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('ops.ws.taskTitle')} *</label>
                  <input id="task-title" className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('ops.ws.taskTitlePh')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('ops.ws.platform')}</label>
                    <select className={fieldClass} value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label={t('ops.ws.platform')}>
                      <option value="">{t('ops.ws.anyPlatform')}</option>
                      {(section?.platforms || []).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      {platform && !(section?.platforms || []).includes(platform) && <option value={platform}>{platform}</option>}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="task-due" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('ops.ws.due')}</label>
                    <input id="task-due" type="date" className={fieldClass} value={due} onChange={(e) => setDue(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
                  </div>
                </div>
                <div>
                  <label htmlFor="task-desc" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('ops.ws.details')}</label>
                  <textarea id="task-desc" rows={3} className={`${fieldClass} resize-none`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('ops.ws.detailsPh')} />
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={saving}>{t('common.cancel')}</Button>
              <Button variant="primary" onPress={() => create([{ title: title.trim(), platform, description: description.trim(), due }])} isPending={saving} isDisabled={!title.trim() || !section?.contract}>
                <Plus size={13} /> {t('ops.ws.create')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Creator: submit content that was not a listed task ───────────── */
const SubmitContentModal: React.FC<{ sections: Section[]; myId: string; onClose: () => void; onCreated: () => void }> = ({ sections, myId, onClose, onCreated }) => {
  const { t } = useTranslation();
  const withContract = sections.filter((s) => s.contract);
  const [key, setKey] = useState(withContract[0]?.key || '');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const section = withContract.find((s) => s.key === key) || withContract[0];

  const submit = async () => {
    const url = link.trim();
    if (!URL_RE.test(url)) return setError(t('wizard.errMediaUrl'));
    if (!section?.contract) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/tasks', { contract_id: section.contract.id, campaign_id: section.campaignId, title: title.trim() || t('ops.ws.submitDefaultTitle'), assigned_to: myId });
      const id = res.data?.id || (Array.isArray(res.data) && res.data[0]?.id);
      if (id) await api.patch(`/tasks/${id}`, { status: 'completed', post_link: url });
      toast.success(t('ops.ws.submitted'));
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || t('ops.ws.errUpdate'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && !saving && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <Link2 size={16} style={{ color: 'var(--color-campaign-purple)' }} /> {t('ops.ws.submitTitle')}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <p className="v-body v-muted" style={{ fontSize: 13 }}>{t('ops.ws.submitDesc')}</p>
                {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
                <div>
                  <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('ops.ws.submitPick')}</label>
                  <select className={fieldClass} value={section?.key || ''} onChange={(e) => setKey(e.target.value)} aria-label={t('ops.ws.submitPick')}>
                    {withContract.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.title} · {s.partner.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="submit-link" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('ops.ws.link')} *</label>
                  <input id="submit-link" className={fieldClass} inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder={t('ops.ws.linkPh')} />
                  <p className="v-caption v-quiet mt-1.5" style={{ fontSize: 11.5 }}>{t('ops.ws.linkHint')}</p>
                </div>
                <div>
                  <label htmlFor="submit-title" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('ops.ws.taskTitle')}</label>
                  <input id="submit-title" className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('ops.ws.submitTitlePh')} />
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={saving}>{t('common.cancel')}</Button>
              <Button variant="primary" onPress={submit} isPending={saving} isDisabled={!link.trim() || !section}>
                <ExternalLink size={13} /> {t('ops.ws.submitBtn')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Page ─────────────────────────────────────────────────────────── */
const WorkspacePage: React.FC = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const role = (localStorage.getItem('role') || 'creator').toLowerCase();
  const isBrand = role === 'brand';

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [assignKey, setAssignKey] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);

  const myId = useMemo(() => {
    const token = localStorage.getItem('token');
    if (!token) return '';
    try {
      return JSON.parse(atob(token.split('.')[1])).sub || '';
    } catch {
      return '';
    }
  }, []);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [c, tk] = await Promise.all([api.get('/contracts/mine'), api.get(isBrand ? '/tasks/assigned' : '/tasks/mine')]);
      setContracts(Array.isArray(c.data) ? c.data : []);
      setTasks(Array.isArray(tk.data) ? tk.data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [isBrand]);

  useEffect(() => {
    load();
  }, [load]);

  /* One section per active contract, keyed by the campaign it was signed for. */
  const sections = useMemo<Section[]>(() => {
    const active = contracts.filter((c) => ['active', 'approved'].includes(String(c.status)));
    const out: Section[] = active.map((c) => {
      const camp = c.application?.campaign || null;
      return {
        key: c.id,
        contract: c,
        campaignId: camp?.id || null,
        title: c.kind === 'addendum' ? `${camp?.title || ''} · ${c.title?.replace('Extra work: ', '') || t('ops.ws.extraWork')}` : camp?.title || c.title?.replace('Contract with ', '') || t('ops.ws.teamContract'),
        platforms: splitPlatforms(camp?.platform),
        templates: parseCampaignTasks(camp?.tasks),
        partner: { id: c.opponent_id || '', name: c.opponent_name || c.opponent_email?.split('@')[0] || '', email: c.opponent_email || '', avatar: c.opponent_avatar },
        tasks: tasks.filter((task) => task.contract_id === c.id),
      };
    });
    const known = new Set(active.map((c) => c.id));
    const orphans = tasks.filter((task) => !task.contract_id || !known.has(task.contract_id));
    if (orphans.length) {
      out.push({ key: 'other', contract: null, campaignId: null, title: t('ops.ws.otherTitle'), platforms: [], templates: [], partner: { id: '', name: '', email: '' }, tasks: orphans });
    }
    return out;
  }, [contracts, tasks, t]);

  /* Deep links: ?contract=<id> (or ?campaign=<id>) focuses that section; brands land in the assign modal. */
  const focus = params.get('contract') || params.get('campaign') || '';
  useEffect(() => {
    if (loading || !focus) return;
    const section = sections.find((s) => s.key === focus || s.campaignId === focus);
    if (!section) return;
    document.getElementById(`ws-${section.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (isBrand && section.contract) setAssignKey(section.key);
    const next = new URLSearchParams(params);
    next.delete('contract');
    next.delete('campaign');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, focus]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((x) => x.status === 'pending').length,
      in_progress: tasks.filter((x) => x.status === 'in_progress').length,
      completed: tasks.filter((x) => isDone(String(x.status))).length,
      submitted: tasks.filter((x) => x.status === 'completed').length,
    }),
    [tasks],
  );

  const visibleTasks = (list: Task[]) => list.filter((x) => (filter === 'all' ? true : filter === 'completed' ? isDone(String(x.status)) : x.status === filter));
  const assignable = sections.filter((s) => s.contract);

  const kpis = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label={t('ops.ws.kTotal')} value={stats.total} hint={t('ops.ws.kTotalHint', { count: assignable.length })} icon={ClipboardList} />
      <MetricCard label={t('ops.ws.kTodo')} value={stats.pending} hint={t('ops.ws.kTodoHint')} icon={Clock} iconStatus={stats.pending ? 'warning' : undefined} />
      <MetricCard label={t('ops.ws.kProgress')} value={stats.in_progress + stats.submitted} hint={isBrand ? t('ops.ws.kReviewHint', { count: stats.submitted }) : t('ops.ws.kProgressHint')} icon={TrendingUp} />
      <MetricCard label={t('ops.ws.kDone')} value={stats.completed} hint={stats.total > 0 ? t('ops.ws.kDoneHint', { pct: Math.round((stats.completed / stats.total) * 100) }) : t('ops.ws.kNoTasks')} icon={CheckCircle2} iconStatus="success" />
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={isBrand ? t('ops.ws.titleBrand') : t('ops.ws.titleOwn')}
      titleAccent={t('ops.ws.accent')}
      description={isBrand ? t('ops.ws.descBrand') : t('ops.ws.descOwn')}
      icon={<ClipboardList size={18} />}
      actions={
        isBrand && assignable.length > 0 ? (
          <Button variant="primary" size="md" onPress={() => setAssignKey(assignable[0].key)}>
            <Plus size={14} /> {t('ops.ws.assign')}
          </Button>
        ) : !isBrand && assignable.length > 0 ? (
          <Button variant="tertiary" size="md" onPress={() => setSubmitOpen(true)}>
            <Link2 size={14} /> {t('ops.ws.submit')}
          </Button>
        ) : undefined
      }
      stats={kpis}
    >
      {!loading && !error && tasks.length > 0 && (
        <Segment size="sm" selectedKey={filter} onSelectionChange={(k) => setFilter(k as typeof filter)} aria-label={t('ops.ws.filterLabel')}>
          <Segment.Item id="all">{t('ops.ws.fAll')} · {stats.total}</Segment.Item>
          <Segment.Item id="pending">{t('ops.ws.status.pending')} · {stats.pending}</Segment.Item>
          <Segment.Item id="in_progress">{t('ops.ws.status.in_progress')} · {stats.in_progress}</Segment.Item>
          <Segment.Item id="completed">{t('ops.ws.fDone')} · {stats.completed}</Segment.Item>
        </Segment>
      )}

      {loading ? (
        <div className="space-y-4" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="v-talent-card p-4">
              <div className="v-skel h-4 w-1/3 mb-3" />
              <div className="v-skel h-3 w-2/3 mb-2" />
              <div className="v-skel h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyPanel tone="error" icon={<AlertTriangle size={22} />} title={t('board.errTitle')} description={t('board.errDesc')} actions={<Button variant="primary" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>} />
      ) : sections.length === 0 ? (
        <EmptyPanel
          icon={<ClipboardList size={22} />}
          title={t('ops.ws.emptyTitle')}
          description={isBrand ? t('ops.ws.emptyBrandNoContracts') : t('ops.ws.emptyCreatorDesc')}
          actions={
            isBrand ? (
              <Link to="/dashboard/applications">
                <Button variant="primary">{t('ops.ws.openInbox')}</Button>
              </Link>
            ) : (
              <Link to="/dashboard/campaigns">
                <Button variant="primary">{t('cdash.browse')}</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-5">
          {sections.map((s) => {
            const list = visibleTasks(s.tasks);
            const done = s.tasks.filter((x) => isDone(String(x.status))).length;
            const money =
              s.contract?.payment_amount != null
                ? `${formatBudget(Number(s.contract.payment_amount), s.contract.currency || 'USD')}${
                    s.contract.payment_frequency && s.contract.payment_frequency !== 'one_time' ? ` / ${t(`apps.freq.${s.contract.payment_frequency}`, { defaultValue: s.contract.payment_frequency })}` : ''
                  }`
                : '';
            return (
              <div key={s.key} id={`ws-${s.key}`}>
                <DashPanel
                  icon={<ListChecks size={15} />}
                  title={s.title}
                  meta={s.tasks.length ? `${done}/${s.tasks.length}` : undefined}
                  action={
                    isBrand && s.contract ? (
                      <Button variant="primary" size="sm" onPress={() => setAssignKey(s.key)}>
                        <Plus size={12} /> {t('ops.ws.assign')}
                      </Button>
                    ) : !isBrand && s.contract ? (
                      <Link to="/dashboard/messages">
                        <Button variant="ghost" size="sm">
                          <MessageSquare size={12} /> {t('apps.message')}
                        </Button>
                      </Link>
                    ) : undefined
                  }
                >
                  {s.contract && (
                    <div className="flex items-center gap-3 flex-wrap mb-3 pb-3" style={{ borderBottom: '1px solid var(--color-cool-gray)' }}>
                      <StoryAvatar src={s.partner.avatar} name={s.partner.name} seed={s.partner.id || s.partner.name} size={32} />
                      <div className="min-w-0">
                        <div className="v-ink font-medium truncate" style={{ fontSize: 13 }}>{s.partner.name}</div>
                        <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                          {[money, s.contract.ends_at ? t('contract.until', { date: fmtDate(s.contract.ends_at) }) : ''].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {s.platforms.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap ml-auto">
                          {s.platforms.map((p) => (
                            <Chip key={p} variant="soft" size="sm" color="default">
                              <Chip.Label>{p}</Chip.Label>
                            </Chip>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {s.tasks.length === 0 ? (
                    isBrand ? (
                      <PanelEmpty
                        icon={<ListChecks size={16} />}
                        title={t('ops.ws.noTasksBrandTitle')}
                        desc={t('ops.ws.noTasksBrandDesc', { name: s.partner.name })}
                        action={
                          s.contract ? (
                            <Button variant="primary" size="sm" onPress={() => setAssignKey(s.key)}>
                              <Plus size={12} /> {s.templates.length ? t('ops.ws.addFromBrief', { count: s.templates.length }) : t('ops.ws.assign')}
                            </Button>
                          ) : undefined
                        }
                      />
                    ) : (
                      <PanelEmpty icon={<Clock size={16} />} title={t('ops.ws.waitingTitle')} desc={t('ops.ws.waitingDesc', { name: s.partner.name })} />
                    )
                  ) : list.length === 0 ? (
                    <PanelEmpty icon={<ListChecks size={16} />} title={t('ops.ws.emptyView')} desc={t('ops.ws.emptyViewDesc')} action={<Button variant="tertiary" size="sm" onPress={() => setFilter('all')}>{t('ops.ws.showAll')}</Button>} />
                  ) : (
                    <ul className="divide-y divide-border">
                      {list.map((task) => (
                        <TaskItem key={task.id} task={task} isBrand={isBrand} onChanged={load} />
                      ))}
                    </ul>
                  )}
                </DashPanel>
              </div>
            );
          })}
        </div>
      )}

      {assignKey && assignable.length > 0 && (
        <AssignTaskModal sections={assignable} initialKey={assignKey} onClose={() => setAssignKey(null)} onCreated={load} />
      )}
      {submitOpen && assignable.length > 0 && <SubmitContentModal sections={assignable} myId={myId} onClose={() => setSubmitOpen(false)} onCreated={load} />}
    </PageShell>
  );
};

export default WorkspacePage;
