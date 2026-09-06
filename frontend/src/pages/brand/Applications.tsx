import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Inbox,
  Layers,
  MessageSquare,
  RotateCcw,
  SearchX,
  Star,
  Users,
  Video,
  XCircle,
  RefreshCw,
  Send,
  ArrowLeftRight,
  ListChecks,
  PlusCircle,
  Plus,
} from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatBudget, postedLabel } from '../../lib/campaignFormat';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_COLOR,
  CURRENCIES,
  PAYMENT_FREQUENCIES,
  hasPaymentDay,
  normalizeApplicationStatus,
  type ApplicationStatus,
} from '../../lib/catalog';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { ContractManager } from '../../components/contracts/ContractManager';
import { toast } from '../../lib/toast';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { BriefDetails } from '../../components/common/BriefDetails';
import { PitchVideo } from '../../components/common/PitchVideo';
import FacetPopover from '../../components/common/FacetPopover';
import { Notice } from '../../components/common/Notice';
import SearchSelect from '../../components/common/SearchSelect';
import { TalentCard, TalentCardSkeleton } from '../../components/common/TalentCard';
import { ActiveFilterChips, DirectoryToolbar, type ActiveChip } from '../../components/common/filters';
import { fieldClass, type Talent } from '../talent/shared';

/**
 * BrandApplications — the applicant inbox. Every applicant is rendered
 * with the same TalentCard as the directory (story ring, platform rail,
 * real follower counts) plus their pitch; review happens in one modal
 * with the pipeline actions: shortlist → accept (with payment terms) or
 * decline, and message / contract once accepted.
 */
type SortKey = 'newest' | 'name';
type StatusFilter = 'all' | ApplicationStatus;

const GRID = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4';

const toTalent = (app: any): Talent => {
  const cp = app.creator?.creatorProfile || {};
  return {
    id: app.creator?.id || app.id,
    _type: 'creator',
    full_name: cp.full_name || [cp.first_name, cp.last_name].filter(Boolean).join(' ') || app.creator?.email?.split('@')[0],
    username: cp.username,
    avatar_url: cp.avatar_url,
    category: cp.category,
    location: cp.location,
    bio: cp.bio,
    social_links: cp.social_links,
    follower_range: cp.follower_range,
    user: { id: app.creator?.id },
  };
};

const creatorName = (app: any) => toTalent(app).full_name || app.creator?.email || 'Creator';

/* ── Payment terms (accept + schedule) ───────────────────────────── */
const PaymentScheduleModal: React.FC<{
  app: any | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ app, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [frequency, setFrequency] = useState<string>('one_time');
  const [day, setDay] = useState('1');
  const [notes, setNotes] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [terms, setTerms] = useState('');
  const [termsTouched, setTermsTouched] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const existing = app?.contract && ['pending_signature', 'countered', 'active', 'approved'].includes(String(app.contract.status)) ? app.contract : null;

  const fetchDraft = useCallback(
    async (f: { amount: string; currency: string; frequency: string; day: string; notes: string; endsAt: string }) => {
      if (!app) return;
      const n = Number(f.amount);
      if (!f.amount || !Number.isFinite(n) || n <= 0) return;
      if (f.frequency !== 'one_time' && !f.endsAt) return;
      setDrafting(true);
      try {
        const res = await api.get(`/contracts/application/${app.id}/draft`, {
          params: { payment_amount: n, currency: f.currency, payment_frequency: f.frequency, payment_day: hasPaymentDay(f.frequency) ? Number(f.day) : '', ends_at: f.frequency !== 'one_time' ? f.endsAt : '', notes: f.notes },
        });
        setTerms(res.data?.terms || '');
        setTermsTouched(false);
      } catch {
        /* the brand can still write the text by hand */
      } finally {
        setDrafting(false);
      }
    },
    [app],
  );

  useEffect(() => {
    if (!app) return;
    const a = app.payment_amount != null ? String(Number(app.payment_amount)) : app.campaign?.budget != null ? String(Number(app.campaign.budget)) : '';
    const c = app.currency || app.campaign?.currency || 'USD';
    // the application row carries column defaults (monthly / day 1) before any terms were ever set — ignore those
    const hasTerms = app.payment_amount != null || !!existing;
    const f = hasTerms ? app.payment_frequency || 'one_time' : 'one_time';
    const d = String((hasTerms && app.payment_day) || 1);
    const n = app.notes || '';
    const e = existing?.ends_at ? String(existing.ends_at).slice(0, 10) : '';
    setAmount(a);
    setCurrency(c);
    setFrequency(f);
    setDay(d);
    setNotes(n);
    setEndsAt(e);
    setError('');
    if (existing?.terms) {
      setTerms(existing.terms);
      setTermsTouched(true);
    } else {
      setTerms('');
      fetchDraft({ amount: a, currency: c, frequency: f, day: d, notes: n, endsAt: e });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app]);

  // Keep the text in step with the money while the brand has not edited it by hand.
  useEffect(() => {
    if (!app || termsTouched) return;
    const h = setTimeout(() => fetchDraft({ amount, currency, frequency, day, notes, endsAt }), 450);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, currency, frequency, day, notes, endsAt]);

  const save = async () => {
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) {
      setError(t('apps.errAmount'));
      return;
    }
    if (frequency !== 'one_time' && !endsAt) {
      setError(t('apps.errEndsAt'));
      return;
    }
    if (!terms.trim()) {
      setError(t('contract.errTerms'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/applications/${app.id}/payment-schedule`, {
        payment_amount: n,
        currency,
        payment_frequency: frequency,
        payment_day: hasPaymentDay(frequency) ? Number(day) : 1,
        ends_at: frequency !== 'one_time' ? endsAt : null,
        notes,
        terms,
      });
      toast.success(t('apps.contractSent', { name: creatorName(app) }));
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || t('apps.errSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!app} onOpenChange={(open) => !open && !saving && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-3xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <Send size={17} style={{ color: 'var(--color-campaign-purple)' }} />
                {t('apps.acceptTitle', { name: app ? creatorName(app) : '' })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <p className="v-body v-muted">
                  {t('apps.acceptIntro', { name: app ? creatorName(app) : '', title: app?.campaign?.title || '' })}
                </p>
                {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
                {existing?.status === 'countered' && existing.counter && (
                  <Notice tone="info">
                    <span className="inline-flex items-center gap-1.5">
                      <ArrowLeftRight size={13} />
                      {t('contract.counterFrom', { name: app ? creatorName(app) : '' })}: {formatBudget(existing.counter.payment_amount, existing.counter.currency || currency)}
                      {existing.counter.payment_frequency && existing.counter.payment_frequency !== 'one_time' ? ` / ${t(`apps.freq.${existing.counter.payment_frequency}`)}` : ''}
                    </span>
                  </Notice>
                )}
                <div className="grid grid-cols-[120px_1fr] gap-3">
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('wizard.currency')}</label>
                    <select className={fieldClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="send-amount" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.amount')}</label>
                    <input id="send-amount" type="number" min={0} step="0.01" className={fieldClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.frequency')}</label>
                    <select className={fieldClass} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                      {PAYMENT_FREQUENCIES.map((f) => (
                        <option key={f} value={f}>{t(`apps.freq.${f}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={hasPaymentDay(frequency) ? undefined : { opacity: 0.45, pointerEvents: 'none' }}>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.paymentDay')}</label>
                    <select className={fieldClass} value={day} onChange={(e) => setDay(e.target.value)} disabled={!hasPaymentDay(frequency)}>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {frequency !== 'one_time' && (
                  <div>
                    <label htmlFor="send-ends" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>
                      {t('apps.runsUntil', { freq: t(`apps.freq.${frequency}`) })}
                    </label>
                    <input id="send-ends" type="date" min={new Date().toISOString().slice(0, 10)} className={fieldClass} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                    <p className="v-caption v-quiet mt-1.5" style={{ fontSize: 11.5 }}>{t('apps.runsUntilHint')}</p>
                  </div>
                )}
                <div>
                  <label htmlFor="send-notes" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.notes')}</label>
                  <textarea id="send-notes" className={`${fieldClass} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('apps.notesPh')} />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <label htmlFor="send-terms" className="v-caption v-ink font-medium" style={{ fontSize: 12.5 }}>{t('apps.agreement')}</label>
                    <button
                      type="button"
                      className="v-caption font-medium inline-flex items-center gap-1"
                      style={{ color: 'var(--color-campaign-purple)', fontSize: 12 }}
                      onClick={() => fetchDraft({ amount, currency, frequency, day, notes, endsAt })}
                      disabled={drafting}
                      title={termsTouched ? t('apps.regenerateNote') : undefined}
                    >
                      <RefreshCw size={11} className={drafting ? 'animate-spin' : ''} /> {t('apps.regenerate')}
                    </button>
                  </div>
                  <textarea
                    id="send-terms"
                    data-testid="agreement-editor"
                    className={`${fieldClass} resize-y`}
                    style={{ fontSize: 12.5, lineHeight: 1.6, minHeight: 280 }}
                    value={terms}
                    onChange={(e) => {
                      setTerms(e.target.value);
                      setTermsTouched(true);
                    }}
                    placeholder={drafting ? '…' : t('contract.termsPh')}
                  />
                  <p className="v-caption v-quiet mt-1.5" style={{ fontSize: 11.5 }}>{t('apps.agreementHint')}</p>
                </div>
                <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('apps.termsNote')}</p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={saving}>{t('common.cancel')}</Button>
              <Button variant="primary" onPress={save} isPending={saving} isDisabled={drafting}>
                <Send size={13} /> {existing ? t('apps.saveTerms') : t('apps.acceptBtn')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Extra work on a signed agreement ─────────────────────────────── */
const ExtraWorkModal: React.FC<{ app: any | null; onClose: () => void; onSaved: () => void }> = ({ app, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState('');
  const [tasks, setTasks] = useState<{ key: string; title: string; platform?: string; due_days?: number }[]>([]);
  const [taskDraft, setTaskDraft] = useState({ title: '', platform: '', due_days: '7' });
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [frequency, setFrequency] = useState('one_time');
  const [day, setDay] = useState('1');
  const [endsAt, setEndsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [termsTouched, setTermsTouched] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const platforms: string[] = String(app?.campaign?.platform || '')
    .split(/[,|]+/)
    .map((x: string) => x.trim())
    .filter(Boolean);

  useEffect(() => {
    if (!app) return;
    setTitle('');
    setScope('');
    setTasks([]);
    setTaskDraft({ title: '', platform: '', due_days: '7' });
    setAmount('');
    setCurrency(app.currency || app.campaign?.currency || 'USD');
    setFrequency('one_time');
    setDay('1');
    setEndsAt('');
    setNotes('');
    setTerms('');
    setTermsTouched(false);
    setError('');
  }, [app]);

  const fetchDraft = useCallback(async () => {
    if (!app) return;
    const n = Number(amount);
    if (!title.trim() || !amount || !Number.isFinite(n) || n <= 0) return;
    if (frequency !== 'one_time' && !endsAt) return;
    setDrafting(true);
    try {
      const res = await api.get(`/contracts/application/${app.id}/addendum-draft`, {
        params: { title: title.trim(), scope, tasks: JSON.stringify(tasks), payment_amount: n, currency, payment_frequency: frequency, payment_day: hasPaymentDay(frequency) ? Number(day) : '', ends_at: frequency !== 'one_time' ? endsAt : '', notes },
      });
      setTerms(res.data?.terms || '');
      setTermsTouched(false);
    } catch {
      /* the brand can still write the text by hand */
    } finally {
      setDrafting(false);
    }
  }, [app, title, scope, tasks, amount, currency, frequency, day, endsAt, notes]);

  useEffect(() => {
    if (!app || termsTouched) return;
    const h = setTimeout(fetchDraft, 450);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, scope, tasks, amount, currency, frequency, day, endsAt, notes]);

  const addTask = () => {
    const tt = taskDraft.title.trim();
    if (!tt) return;
    const days = Number(taskDraft.due_days);
    setTasks((prev) => [...prev, { key: `x${Date.now().toString(36)}`, title: tt, ...(taskDraft.platform ? { platform: taskDraft.platform } : {}), ...(Number.isFinite(days) && days > 0 ? { due_days: Math.round(days) } : {}) }]);
    setTaskDraft({ title: '', platform: taskDraft.platform, due_days: taskDraft.due_days });
  };

  const save = async () => {
    const n = Number(amount);
    if (!title.trim()) return setError(t('apps.errExtraTitle'));
    if (!amount || !Number.isFinite(n) || n <= 0) return setError(t('apps.errAmount'));
    if (frequency !== 'one_time' && !endsAt) return setError(t('apps.errEndsAt'));
    if (!terms.trim()) return setError(t('contract.errTerms'));
    setSaving(true);
    setError('');
    try {
      await api.post(`/contracts/application/${app.id}/addendum`, {
        title: title.trim(),
        scope,
        tasks,
        payment_amount: n,
        currency,
        payment_frequency: frequency,
        payment_day: hasPaymentDay(frequency) ? Number(day) : 1,
        ends_at: frequency !== 'one_time' ? endsAt : null,
        notes,
        terms,
      });
      toast.success(t('apps.extraSent', { name: creatorName(app) }));
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || t('apps.errSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!app} onOpenChange={(open) => !open && !saving && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-3xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <PlusCircle size={17} style={{ color: 'var(--color-campaign-purple)' }} />
                {t('apps.extraTitle', { name: app ? creatorName(app) : '' })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <p className="v-body v-muted">{t('apps.extraIntro', { title: app?.campaign?.title || '' })}</p>
                {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
                <div>
                  <label htmlFor="extra-title" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.extraWhat')} *</label>
                  <input id="extra-title" className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('apps.extraWhatPh')} />
                </div>
                <div>
                  <label htmlFor="extra-scope" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.extraScope')}</label>
                  <textarea id="extra-scope" rows={2} className={`${fieldClass} resize-none`} value={scope} onChange={(e) => setScope(e.target.value)} placeholder={t('apps.extraScopePh')} />
                </div>
                <div>
                  <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('wizard.tasks')}</label>
                  {tasks.length > 0 && (
                    <ol className="space-y-1 mb-2">
                      {tasks.map((task, i) => (
                        <li key={task.key} className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }}>
                          <span className="v-caption v-quiet tabular-nums" style={{ fontSize: 11 }}>{i + 1}.</span>
                          <span className="v-ink flex-1 truncate" style={{ fontSize: 13 }}>{task.title}{task.platform ? ` · ${task.platform}` : ''}{task.due_days ? ` · ${t('wizard.taskDueDays', { count: task.due_days })}` : ''}</span>
                          <button type="button" className="v-shell-btn" style={{ width: 26, height: 26 }} aria-label={t('wizard.removeTask')} onClick={() => setTasks((prev) => prev.filter((_, idx) => idx !== i))}>
                            <XCircle size={12} />
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-[1fr_140px_90px_auto] gap-2">
                    <input className={`${fieldClass} col-span-2 sm:col-span-1`} value={taskDraft.title} onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })} placeholder={t('wizard.taskTitlePh')} aria-label={t('wizard.taskTitle')} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }} />
                    <select className={fieldClass} value={taskDraft.platform} onChange={(e) => setTaskDraft({ ...taskDraft, platform: e.target.value })} aria-label={t('wizard.taskPlatform')}>
                      <option value="">{t('wizard.taskAnyPlatform')}</option>
                      {platforms.map((pf) => (
                        <option key={pf} value={pf}>{pf}</option>
                      ))}
                    </select>
                    <input type="number" min={1} max={365} className={fieldClass} value={taskDraft.due_days} onChange={(e) => setTaskDraft({ ...taskDraft, due_days: e.target.value })} aria-label={t('wizard.taskDue')} title={t('wizard.taskDue')} />
                    <Button variant="tertiary" size="md" onPress={addTask} isDisabled={!taskDraft.title.trim()} className="col-span-2 sm:col-auto">
                      <Plus size={13} /> {t('wizard.addTask')}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-3">
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('wizard.currency')}</label>
                    <select className={fieldClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="extra-amount" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.extraFee')}</label>
                    <input id="extra-amount" type="number" min={0} step="0.01" className={fieldClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.frequency')}</label>
                    <select className={fieldClass} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                      {PAYMENT_FREQUENCIES.map((f) => (
                        <option key={f} value={f}>{t(`apps.freq.${f}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={hasPaymentDay(frequency) ? undefined : { opacity: 0.45, pointerEvents: 'none' }}>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.paymentDay')}</label>
                    <select className={fieldClass} value={day} onChange={(e) => setDay(e.target.value)} disabled={!hasPaymentDay(frequency)}>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {frequency !== 'one_time' && (
                  <div>
                    <label htmlFor="extra-ends" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.runsUntil', { freq: t(`apps.freq.${frequency}`) })}</label>
                    <input id="extra-ends" type="date" min={new Date().toISOString().slice(0, 10)} className={fieldClass} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                  </div>
                )}
                <div>
                  <label htmlFor="extra-notes" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.notes')}</label>
                  <textarea id="extra-notes" className={`${fieldClass} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('apps.notesPh')} />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <label htmlFor="extra-terms" className="v-caption v-ink font-medium" style={{ fontSize: 12.5 }}>{t('apps.agreement')}</label>
                    <button type="button" className="v-caption font-medium inline-flex items-center gap-1" style={{ color: 'var(--color-campaign-purple)', fontSize: 12 }} onClick={fetchDraft} disabled={drafting}>
                      <RefreshCw size={11} className={drafting ? 'animate-spin' : ''} /> {t('apps.regenerate')}
                    </button>
                  </div>
                  <textarea
                    id="extra-terms"
                    data-testid="addendum-editor"
                    className={`${fieldClass} resize-y`}
                    style={{ fontSize: 12.5, lineHeight: 1.6, minHeight: 220 }}
                    value={terms}
                    onChange={(e) => {
                      setTerms(e.target.value);
                      setTermsTouched(true);
                    }}
                    placeholder={drafting ? '…' : t('apps.extraTermsPh')}
                  />
                </div>
                <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('apps.extraNote')}</p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={saving}>{t('common.cancel')}</Button>
              <Button variant="primary" onPress={save} isPending={saving} isDisabled={drafting}>
                <Send size={13} /> {t('apps.extraSend')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

/* ── Page ────────────────────────────────────────────────────────── */
const BrandApplications: React.FC = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const [apps, setApps] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>(() => {
    const s = params.get('status');
    return s && (APPLICATION_STATUSES as readonly string[]).includes(s) ? (s as ApplicationStatus) : 'all';
  });
  const [campaignId, setCampaignId] = useState(params.get('campaign') || '');
  const [sort, setSort] = useState<SortKey>('newest');

  const [reviewing, setReviewing] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [paymentApp, setPaymentApp] = useState<any | null>(null);
  const [chatApp, setChatApp] = useState<any | null>(null);
  const [contractApp, setContractApp] = useState<any | null>(null);
  const [contractView, setContractView] = useState<string | undefined>(undefined);
  const [extraApp, setExtraApp] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [a, c] = await Promise.all([
        api.get('/applications'),
        api.get('/campaigns/mine').catch(() => ({ data: [] })),
      ]);
      setApps(Array.isArray(a.data) ? a.data : []);
      setCampaigns(Array.isArray(c.data) ? c.data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get('/auth/me').then((r) => setCurrentUserId(r.data?.userId || r.data?.id || '')).catch(() => {});
  }, [load]);

  /* Keep the URL in sync so campaign cards can deep-link here */
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (campaignId) next.set('campaign', campaignId);
    else next.delete('campaign');
    if (status !== 'all') next.set('status', status);
    else next.delete('status');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, status]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: apps.length, pending: 0, shortlisted: 0, offered: 0, accepted: 0, rejected: 0, refunded: 0 };
    for (const a of apps) c[normalizeApplicationStatus(a.status)]++;
    return c;
  }, [apps]);

  const campaignOptions = useMemo(() => {
    const perCampaign = new Map<string, number>();
    for (const a of apps) if (a.campaign?.id) perCampaign.set(a.campaign.id, (perCampaign.get(a.campaign.id) || 0) + 1);
    const seen = new Set<string>();
    const opts = campaigns.map((c) => {
      seen.add(c.id);
      return { value: c.id, label: c.title, hint: String(perCampaign.get(c.id) || 0) };
    });
    for (const a of apps) {
      if (a.campaign?.id && !seen.has(a.campaign.id)) {
        seen.add(a.campaign.id);
        opts.push({ value: a.campaign.id, label: a.campaign.title, hint: String(perCampaign.get(a.campaign.id) || 0) });
      }
    }
    return opts;
  }, [apps, campaigns]);
  const campaignTitle = (id: string) => campaignOptions.find((o) => o.value === id)?.label || '';

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = apps.filter((a) => {
      if (status !== 'all' && normalizeApplicationStatus(a.status) !== status) return false;
      if (campaignId && a.campaign?.id !== campaignId) return false;
      if (q) {
        const talent = toTalent(a);
        const hay = `${talent.full_name || ''} ${talent.username || ''} ${a.creator?.email || ''} ${a.pitch || ''} ${a.campaign?.title || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) =>
      sort === 'name'
        ? (toTalent(a).full_name || '').localeCompare(toTalent(b).full_name || '')
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return list;
  }, [apps, search, status, campaignId, sort]);

  const activeChips = useMemo(() => {
    const chips: ActiveChip[] = [];
    if (search) chips.push({ key: 'search', label: t('talent.searchChip', { q: search }), onClear: () => setSearch('') });
    if (status !== 'all') chips.push({ key: 'status', label: t(`appStatus.${status}`), onClear: () => setStatus('all') });
    if (campaignId) chips.push({ key: 'campaign', label: campaignTitle(campaignId) || t('dash.campaign'), onClear: () => setCampaignId('') });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, campaignId, campaignOptions, t]);
  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setCampaignId('');
  };

  /* ── Actions ───────────────────────────────────────────────────── */
  const openReview = (app: any) => {
    setReviewing(app);
    setSubmissions([]);
    api
      .get(`/tracking/application/${app.id}/submissions`)
      .then((r) => setSubmissions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSubmissions([]));
  };

  const setStatusOf = async (app: any, next: ApplicationStatus) => {
    setBusy(true);
    try {
      await api.patch(`/applications/${app.id}/status`, { status: next });
      setNotice({ tone: 'success', text: t(`apps.statusChanged.${next}`, { name: creatorName(app) }) });
      setReviewing(null);
      await load();
    } catch (e: any) {
      setNotice({ tone: 'error', text: e?.response?.data?.message || t('apps.errSave') });
    } finally {
      setBusy(false);
    }
  };

  /* ── Render ────────────────────────────────────────────────────── */
  const kpis = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label={t('appStatus.pending')} value={counts.pending} hint={t('apps.kpiPendingHint')} icon={Clock} iconStatus={counts.pending ? 'warning' : undefined} />
      <MetricCard label={t('appStatus.shortlisted')} value={counts.shortlisted} hint={t('apps.kpiShortHint')} icon={Star} />
      <MetricCard label={t('appStatus.accepted')} value={counts.accepted} hint={t('apps.kpiAcceptedHint')} icon={CheckCircle2} iconStatus="success" />
      <MetricCard label={t('appStatus.rejected')} value={counts.rejected + counts.refunded} hint={t('apps.kpiRejectedHint')} icon={XCircle} />
    </div>
  );

  const reviewStatus = reviewing ? normalizeApplicationStatus(reviewing.status) : 'pending';
  const reviewVideo = reviewing?.video_pitch_url || null;

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('apps.title')}
      titleAccent={t('apps.titleAccent')}
      description={t('apps.desc')}
      icon={<Users size={18} />}
      stats={kpis}
    >
      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice>
      )}

      <div>
        <DirectoryToolbar
          leading={
            <Segment size="sm" selectedKey={status} onSelectionChange={(k) => setStatus(k as StatusFilter)} aria-label="Status">
              <Segment.Item id="all">{t('dash.all')} · {counts.all}</Segment.Item>
              <Segment.Item id="pending">{t('appStatus.pending')} · {counts.pending}</Segment.Item>
              <Segment.Item id="shortlisted">{t('appStatus.shortlisted')} · {counts.shortlisted}</Segment.Item>
              <Segment.Item id="offered">{t('appStatus.offered')} · {counts.offered}</Segment.Item>
              <Segment.Item id="accepted">{t('appStatus.accepted')} · {counts.accepted}</Segment.Item>
              <Segment.Item id="rejected">{t('appStatus.rejected')} · {counts.rejected}</Segment.Item>
            </Segment>
          }
          search={{ value: search, onChange: setSearch, placeholder: t('apps.searchPh'), widthClass: 'w-full sm:w-[240px]' }}
          count={loading ? t('common.searching') : t('board.count', { shown: visible.length, total: apps.length })}
        >
          <FacetPopover label={t('dash.campaign')} width={300} badge={campaignId ? campaignTitle(campaignId) : undefined}>
            <SearchSelect
              aria-label="Campaign"
              placeholder={campaignOptions.length ? t('apps.pickCampaign') : t('dash.noCampaignsTitle')}
              disabled={campaignOptions.length === 0}
              options={campaignOptions}
              value={campaignId}
              onChange={setCampaignId}
            />
          </FacetPopover>
          <Segment size="sm" selectedKey={sort} onSelectionChange={(k) => setSort(k as SortKey)} aria-label="Sort">
            <Segment.Item id="newest">{t('board.sortNewest')}</Segment.Item>
            <Segment.Item id="name">{t('talent.sortAZ')}</Segment.Item>
          </Segment>
        </DirectoryToolbar>
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
      </div>

      {loading ? (
        <div className={GRID} aria-label="Loading applicants">
          {Array.from({ length: 6 }).map((_, i) => (
            <TalentCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyPanel
          tone="error"
          icon={<AlertTriangle size={22} />}
          title={t('board.errTitle')}
          description={t('board.errDesc')}
          actions={<Button variant="primary" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>}
        />
      ) : apps.length === 0 ? (
        <EmptyPanel
          icon={<Inbox size={22} />}
          title={t('apps.emptyTitle')}
          description={t('apps.emptyDesc')}
          actions={
            <>
              <Link to="/dashboard/campaigns?new=1">
                <Button variant="primary">
                  <Briefcase size={13} /> {t('dash.newCampaign')}
                </Button>
              </Link>
              <Link to="/dashboard/talent">
                <Button variant="tertiary">{t('dash.browseTalent')}</Button>
              </Link>
            </>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyPanel
          size="sm"
          icon={<SearchX size={20} />}
          title={t('board.emptyTitle')}
          description={t('board.emptyStatus')}
          actions={<Button variant="primary" size="sm" onPress={resetFilters}>{t('board.resetFilters')}</Button>}
        />
      ) : (
        <div className={GRID}>
          {visible.map((app, i) => {
            const s = normalizeApplicationStatus(app.status);
            const when = postedLabel(app.created_at);
            return (
              <TalentCard
                key={app.id}
                talent={toTalent(app)}
                index={i}
                canInvite={false}
                loggedIn
                viewerIsCreator={false}
                onInvite={() => {}}
                badge={
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <Chip color={APPLICATION_STATUS_COLOR[s]} variant="soft" size="sm">
                      <Chip.Label>{t(`appStatus.${s}`)}</Chip.Label>
                    </Chip>
                    {app.contract?.status === 'countered' && (
                      <Chip color="warning" variant="soft" size="sm">
                        <ArrowLeftRight size={10} />
                        <Chip.Label>{t('apps.counterBadge')}</Chip.Label>
                      </Chip>
                    )}
                    {(app.addenda || []).some((a: any) => a.status === 'countered') ? (
                      <Chip color="warning" variant="soft" size="sm">
                        <ArrowLeftRight size={10} />
                        <Chip.Label>{t('apps.extraCounterBadge')}</Chip.Label>
                      </Chip>
                    ) : (app.addenda || []).some((a: any) => a.status === 'pending_signature') ? (
                      <Chip color="default" variant="soft" size="sm">
                        <Chip.Label>{t('apps.extraPendingBadge')}</Chip.Label>
                      </Chip>
                    ) : null}
                  </span>
                }
                extra={
                  <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="v-caption v-quiet font-medium uppercase tracking-wider inline-flex items-center gap-1" style={{ fontSize: 10 }}>
                        <Layers size={10} /> {t('apps.pitch')}
                      </span>
                      <span className="v-caption v-quiet inline-flex items-center gap-2" style={{ fontSize: 10.5 }}>
                        {app.video_pitch_url && (
                          <span className="inline-flex items-center gap-0.5" style={{ color: 'var(--color-campaign-purple)' }}>
                            <Video size={10} /> {t('apps.video')}
                          </span>
                        )}
                        {when}
                      </span>
                    </div>
                    <p className="v-body v-ink line-clamp-3" style={{ fontSize: 12.5, minHeight: 54 }}>
                      {app.pitch || t('apps.noPitch')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCampaignId(app.campaign?.id || '')}
                      className="mt-2 v-caption inline-flex items-center gap-1 hover:underline truncate max-w-full"
                      style={{ fontSize: 11, color: 'var(--color-campaign-purple)' }}
                      title={app.campaign?.title}
                    >
                      <Briefcase size={10} className="shrink-0" /> <span className="truncate">{app.campaign?.title}</span>
                    </button>
                  </div>
                }
                actions={
                  <Button variant={s === 'pending' ? 'primary' : 'tertiary'} size="sm" onPress={() => openReview(app)}>
                    {s === 'pending' ? t('apps.review') : t('apps.open')}
                  </Button>
                }
              />
            );
          })}
        </div>
      )}

      {/* ── Review modal ───────────────────────────────────────────── */}
      <Modal isOpen={!!reviewing} onOpenChange={(open) => !open && !busy && setReviewing(null)}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <Modal.Container>
            <Modal.Dialog className="!max-w-2xl">
              <Modal.CloseTrigger />
              {reviewing && (
                <>
                  <Modal.Header>
                    <Modal.Heading className="flex items-center gap-2 flex-wrap">
                      {creatorName(reviewing)}
                      <Chip color={APPLICATION_STATUS_COLOR[reviewStatus]} variant="soft" size="sm">
                        <Chip.Label>{t(`appStatus.${reviewStatus}`)}</Chip.Label>
                      </Chip>
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-3 flex-wrap v-caption" style={{ fontSize: 12.5 }}>
                        <span className="inline-flex items-center gap-1.5 v-muted">
                          <Briefcase size={12} /> {reviewing.campaign?.title}
                        </span>
                        {reviewing.campaign?.budget != null && (
                          <span className="v-ink font-medium tabular-nums inline-flex items-center gap-1">
                            <DollarSign size={12} style={{ color: '#0b6e3e' }} />
                            {formatBudget(reviewing.campaign.budget, reviewing.campaign.currency || 'USD')} · {t('card.budget')}
                          </span>
                        )}
                      </div>

                      <BriefDetails campaign={reviewing.campaign} compact />

                      {reviewVideo && (
                        <div>
                          <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2 inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}>
                            <Video size={11} style={{ color: 'var(--color-campaign-purple)' }} /> {t('board.videoPitch')}
                          </div>
                          <PitchVideo url={reviewing.video_pitch_url} maxHeight={320} />
                        </div>
                      )}

                      <div>
                        <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2 inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}>
                          <Layers size={11} /> {t('board.writtenPitch')}
                        </div>
                        <div className="rounded-xl p-4 v-body v-ink whitespace-pre-wrap" style={{ background: 'rgba(244,242,255,0.5)', border: '1px solid var(--color-cool-gray)', fontSize: 13.5, lineHeight: 1.6 }}>
                          {reviewing.pitch || t('apps.noPitch')}
                        </div>
                      </div>

                      {reviewStatus === 'accepted' && (
                        <div className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'linear-gradient(135deg, rgba(22,199,132,0.10) 0%, rgba(0,212,199,0.12) 100%)', border: '1px solid rgba(22,199,132,0.20)' }}>
                          <div>
                            <div className="v-caption font-medium" style={{ color: '#0b6e3e', fontSize: 11.5 }}>{t('apps.termsTitle')}</div>
                            <div className="font-semibold tabular-nums" style={{ color: '#0b6e3e', fontSize: 20 }}>
                              {reviewing.payment_amount ? formatBudget(reviewing.payment_amount, reviewing.currency || 'USD') : '—'}
                              {reviewing.payment_frequency && (
                                <span className="v-caption font-normal" style={{ fontSize: 12, opacity: 0.8 }}> / {t(`apps.freq.${reviewing.payment_frequency}`, { defaultValue: reviewing.payment_frequency })}</span>
                              )}
                            </div>
                          </div>
                          {hasPaymentDay(reviewing.payment_frequency) && (
                            <span className="v-caption" style={{ color: '#0b6e3e', fontSize: 11.5 }}>
                              {t('apps.dayN', { n: reviewing.payment_day || 1 })}
                            </span>
                          )}
                        </div>
                      )}

                      <div>
                        <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2 inline-flex items-center gap-1.5" style={{ fontSize: 10.5 }}>
                          <FileText size={11} /> {t('apps.deliverables')}
                        </div>
                        {submissions.length === 0 ? (
                          <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('apps.noDeliverables')}</p>
                        ) : (
                          <ul className="space-y-2 max-h-56 overflow-y-auto">
                            {submissions.map((sub: any) => (
                              <li key={sub.id} className="rounded-lg p-3 v-hairline flex items-center justify-between gap-3">
                                <a href={sub.url} target="_blank" rel="noopener noreferrer" className="v-body truncate hover:underline" style={{ color: 'var(--color-campaign-purple)', fontSize: 12.5 }}>
                                  {sub.url}
                                </a>
                                <Chip color={sub.ai_verification_status === 'verified' ? 'success' : 'warning'} variant="soft" size="sm">
                                  <Chip.Label>{sub.ai_verification_status || 'pending'}</Chip.Label>
                                </Chip>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </Modal.Body>
                  <Modal.Footer>
                    <div className="flex items-center justify-between w-full gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {(reviewStatus === 'pending' || reviewStatus === 'shortlisted' || reviewStatus === 'offered') && (
                          <Button variant="ghost" className="!text-danger" onPress={() => setStatusOf(reviewing, 'rejected')} isDisabled={busy}>
                            <XCircle size={13} /> {t('apps.decline')}
                          </Button>
                        )}
                        {reviewStatus === 'offered' && (
                          <Button variant="tertiary" onPress={() => setChatApp(reviewing)}>
                            <MessageSquare size={13} /> {t('apps.message')}
                          </Button>
                        )}
                        {(reviewStatus === 'rejected' || reviewStatus === 'refunded') && (
                          <Button variant="ghost" onPress={() => setStatusOf(reviewing, 'pending')} isDisabled={busy}>
                            <RotateCcw size={13} /> {t('apps.reconsider')}
                          </Button>
                        )}
                        {reviewStatus === 'accepted' && (
                          <>
                            <Button variant="tertiary" onPress={() => setChatApp(reviewing)}>
                              <MessageSquare size={13} /> {t('apps.message')}
                            </Button>
                            <Button variant="tertiary" onPress={() => setContractApp(reviewing)}>
                              <FileText size={13} /> {t('apps.contract')}
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {reviewStatus === 'pending' && (
                          <Button variant="tertiary" onPress={() => setStatusOf(reviewing, 'shortlisted')} isDisabled={busy}>
                            <Star size={13} /> {t('apps.shortlist')}
                          </Button>
                        )}
                        {(reviewStatus === 'pending' || reviewStatus === 'shortlisted') && (
                          <Button variant="primary" onPress={() => setPaymentApp(reviewing)} isDisabled={busy}>
                            <Check size={13} /> {t('apps.accept')}
                          </Button>
                        )}
                        {reviewStatus === 'offered' && (
                          <>
                            <Button variant="tertiary" onPress={() => setPaymentApp(reviewing)} isDisabled={busy}>
                              <DollarSign size={13} /> {t('contract.editResend')}
                            </Button>
                            <Button variant="primary" onPress={() => setContractApp(reviewing)} isDisabled={busy}>
                              {reviewing.contract?.status === 'countered' ? <ArrowLeftRight size={13} /> : <FileText size={13} />}{' '}
                              {reviewing.contract?.status === 'countered' ? t('apps.reviewCounter') : t('apps.viewContract')}
                            </Button>
                          </>
                        )}
                        {reviewStatus === 'accepted' && (
                          <>
                            <Button variant="tertiary" onPress={() => setExtraApp(reviewing)}>
                              <PlusCircle size={13} /> {t('contract.proposeExtra')}
                            </Button>
                            <Link to={`/dashboard/workspace?contract=${reviewing.contract?.id || ''}`}>
                              <Button variant="primary">
                                <ListChecks size={13} /> {t('apps.assignTasks')}
                              </Button>
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <PaymentScheduleModal
        app={paymentApp}
        onClose={() => setPaymentApp(null)}
        onSaved={() => {
          setNotice({ tone: 'success', text: t('apps.statusChanged.accepted', { name: paymentApp ? creatorName(paymentApp) : '' }) });
          setReviewing(null);
          load();
        }}
      />

      {chatApp && (
        <ChatWindow
          applicationId={chatApp.id}
          currentUserId={currentUserId}
          onClose={() => setChatApp(null)}
          creatorName={creatorName(chatApp)}
          avatarUrl={toTalent(chatApp).avatar_url}
          subtitle={chatApp.campaign?.title}
        />
      )}
      {contractApp && (
        <ContractManager
          applicationId={contractApp.id}
          isBrand
          application={contractApp}
          contractId={contractView}
          onClose={() => {
            setContractApp(null);
            setContractView(undefined);
          }}
          onEdit={() => {
            setPaymentApp(contractApp);
            setContractApp(null);
          }}
          onProposeExtra={() => {
            setExtraApp(contractApp);
            setContractApp(null);
          }}
          onChanged={load}
        />
      )}
      {extraApp && (
        <ExtraWorkModal app={extraApp} onClose={() => setExtraApp(null)} onSaved={load} />
      )}
    </PageShell>
  );
};

export default BrandApplications;
