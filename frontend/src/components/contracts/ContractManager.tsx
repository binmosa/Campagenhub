import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Check, FileText, History, ListChecks, Pencil, PlusCircle, Send, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Chip, Modal } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatBudget } from '../../lib/campaignFormat';
import { CURRENCIES, PAYMENT_FREQUENCIES, hasPaymentDay } from '../../lib/catalog';
import { fieldClass } from '../../pages/talent/shared';
import { Notice } from '../common/Notice';
import { ConfirmModal } from '../common/ConfirmModal';
import { StoryAvatar } from '../common/StoryAvatar';

/**
 * ContractManager — the agreement between a brand and a creator, as one
 * modal both sides open from the application.
 *
 *  - Brand: reads what was sent, sees the creator's counter-offer and
 *    accepts / declines it, or goes back to "edit & resend" (the send
 *    modal owns the editable text and the money fields).
 *  - Creator: reads the full agreement with both parties named, then
 *    accepts & signs, declines, or proposes other terms. Nothing is binding
 *    until both sides have accepted; then the contract locks.
 */
type Party = { id?: string; name: string; email: string; avatar?: string | null; contact?: string | null };
type Counter = { payment_amount: number; currency: string; payment_frequency: string; payment_day?: number | null; ends_at?: string | null; note?: string | null; by: string; at: string };
type HistoryItem = { at: string; by: 'brand' | 'creator'; action: string; payment_amount?: number; currency?: string; payment_frequency?: string; payment_day?: number | null; note?: string | null };
interface Contract {
  id: string;
  kind?: string;
  parent_id?: string | null;
  title?: string | null;
  scope?: string | null;
  tasks?: { key: string; title: string; platform?: string; due_days?: number; description?: string }[] | null;
  status: string;
  terms: string | null;
  payment_amount: number | string | null;
  currency: string | null;
  payment_frequency: string | null;
  payment_day: number | null;
  ends_at: string | null;
  notes: string | null;
  offered_at: string | null;
  signed_at: string | null;
  counter: Counter | null;
  history: HistoryItem[] | null;
  parties: { brand: Party; creator: Party };
  campaign: { id: string; title: string };
  application_status: string;
}

interface ContractManagerProps {
  applicationId: string;
  isBrand: boolean;
  onClose: () => void;
  /** The application row (for the title while loading). */
  application?: any;
  /** Open a specific agreement (an extra-work addendum) instead of the main one. */
  contractId?: string;
  /** Brand only: open the send/edit modal for this application. */
  onEdit?: () => void;
  /** Brand only: open the extra-work proposal modal. */
  onProposeExtra?: () => void;
  /** Called after any action that changed the contract, so lists can refresh. */
  onChanged?: () => void;
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success',
  approved: 'success',
  pending_signature: 'warning',
  countered: 'warning',
  rejected: 'danger',
  ended: 'default',
  draft: 'default',
};

type Action = 'accept' | 'decline' | 'accept_counter' | 'decline_counter';

const dateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

export function ContractManager({ applicationId, isBrand, onClose, application, contractId, onEdit, onProposeExtra, onChanged }: ContractManagerProps) {
  const { t } = useTranslation();
  const [viewId, setViewId] = useState<string | null>(contractId || null);
  const [addenda, setAddenda] = useState<Contract[]>([]);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Action | 'counter' | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  // creator's counter-offer form
  const [counterOpen, setCounterOpen] = useState(false);
  const [cAmount, setCAmount] = useState('');
  const [cCurrency, setCCurrency] = useState('USD');
  const [cFrequency, setCFrequency] = useState('one_time');
  const [cDay, setCDay] = useState('1');
  const [cEndsAt, setCEndsAt] = useState('');
  const [cNote, setCNote] = useState('');
  const [justSigned, setJustSigned] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, all] = await Promise.all([
        viewId ? api.get(`/contracts/${viewId}/detail`) : api.get(`/contracts/application/${applicationId}`),
        api.get(`/contracts/application/${applicationId}/all`).catch(() => ({ data: [] })),
      ]);
      const c: Contract | null = res.data || null;
      setContract(c);
      setAddenda((Array.isArray(all.data) ? all.data : []).filter((x: Contract) => x.kind === 'addendum'));
      if (c) {
        setCAmount(c.payment_amount != null ? String(Number(c.payment_amount)) : '');
        setCCurrency(c.currency || 'USD');
        setCFrequency(c.payment_frequency || 'one_time');
        setCDay(String(c.payment_day || 1));
        setCEndsAt(c.ends_at ? String(c.ends_at).slice(0, 10) : '');
      }
    } catch {
      setError(t('contract.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [applicationId, viewId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const status = contract?.status || 'none';
  const money = (amount: number | string | null | undefined, currency?: string | null, frequency?: string | null, day?: number | null, endsAt?: string | null) => {
    if (amount == null || amount === '') return '—';
    const f = frequency || 'one_time';
    const base = `${formatBudget(Number(amount), currency || 'USD')} ${f === 'one_time' ? t('apps.freq.one_time').toLowerCase() : `/ ${t(`apps.freq.${f}`, { defaultValue: f }).toLowerCase()}`}`;
    const withDay = hasPaymentDay(f) && day ? `${base} · ${t('apps.dayN', { n: day })}` : base;
    return endsAt && f !== 'one_time' ? `${withDay} · ${t('contract.until', { date: new Date(endsAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) })}` : withDay;
  };

  const finish = async (message: string) => {
    await load();
    setDone(message);
    setCounterOpen(false);
    onChanged?.();
  };

  const run = async (action: Action) => {
    setBusy(action);
    setError('');
    setDone('');
    try {
      if (action === 'accept' || action === 'decline') {
        await api.put(contract?.kind === 'addendum' ? `/contracts/${contract.id}/respond` : `/contracts/application/${applicationId}/respond`, { action });
        await finish(action === 'accept' ? t('contract.signedNext') : t('contract.declined'));
        if (action === 'accept') setJustSigned(true);
      } else {
        await api.put(contract?.kind === 'addendum' ? `/contracts/${contract.id}/brand-respond` : `/contracts/application/${applicationId}/brand-respond`, { action });
        await finish(action === 'accept_counter' ? t('contract.counterAccepted') : t('contract.counterDeclined'));
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || t('contract.errRespond'));
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const sendCounter = async () => {
    const n = Number(cAmount);
    if (!cAmount || !Number.isFinite(n) || n <= 0) return setError(t('contract.errAmount'));
    if (cFrequency !== 'one_time' && !cEndsAt) return setError(t('apps.errEndsAt'));
    setBusy('counter');
    setError('');
    try {
      await api.put(contract?.kind === 'addendum' ? `/contracts/${contract.id}/respond` : `/contracts/application/${applicationId}/respond`, {
        action: 'counter',
        counter: { payment_amount: n, currency: cCurrency, payment_frequency: cFrequency, payment_day: hasPaymentDay(cFrequency) ? Number(cDay) : null, ends_at: cFrequency !== 'one_time' ? cEndsAt : null, note: cNote.trim() || null },
      });
      await finish(t('contract.countered'));
    } catch (e: any) {
      setError(e?.response?.data?.message || t('contract.errRespond'));
    } finally {
      setBusy(null);
    }
  };

  const campaignTitle = contract?.campaign?.title || application?.campaign?.title || '';
  const brand = contract?.parties?.brand;
  const creator = contract?.parties?.creator;
  const canEditAsBrand = isBrand && !!onEdit && contract?.kind !== 'addendum' && !['active', 'approved', 'ended'].includes(status);
  const label = (a: Action) => t(`contract.confirm.${a}Title`);
  const body = (a: Action) => t(`contract.confirm.${a}Body`);

  const partyCard = (p: Party | undefined, role: 'brand' | 'creator', stamp: React.ReactNode) => (
    <div className="v-talent-card v-static p-3 flex items-center gap-3 min-w-0">
      <StoryAvatar src={p?.avatar} name={p?.name || ''} seed={p?.id || p?.name || role} size={36} />
      <div className="min-w-0 flex-1">
        <div className="v-caption v-quiet uppercase tracking-wider" style={{ fontSize: 10 }}>{t(`contract.${role}`)}</div>
        <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{p?.name || '—'}</div>
        <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>{p?.email || ''}</div>
        <div className="v-caption mt-0.5" style={{ fontSize: 11 }}>{stamp}</div>
      </div>
    </div>
  );

  return (
    <>
      <Modal isOpen onOpenChange={(open) => !open && !busy && onClose()}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <Modal.Container>
            <Modal.Dialog className="!max-w-3xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="flex items-center gap-2 flex-wrap">
                  <span className="v-hero-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                    <FileText size={15} />
                  </span>
                  {contract?.kind === 'addendum' ? t('contract.extraTitle') : t('contract.title')}
                  {!loading && contract && (
                    <Chip color={STATUS_COLOR[status] || 'default'} variant="soft" size="sm">
                      <Chip.Label>{t(`contractStatus.${status}`, { defaultValue: status.replace('_', ' ') })}</Chip.Label>
                    </Chip>
                  )}
                </Modal.Heading>
              </Modal.Header>

              <Modal.Body>
                {loading ? (
                  <div className="space-y-3" aria-hidden>
                    <div className="v-skel h-4 w-1/3" />
                    <div className="v-skel h-16 w-full" />
                    <div className="v-skel h-40 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {campaignTitle && (
                      <p className="v-body v-muted" style={{ fontSize: 13 }}>
                        {contract?.kind === 'addendum' ? t('contract.extraFor', { campaign: campaignTitle }) : t('contract.forCampaign', { campaign: campaignTitle })}
                        {contract?.kind === 'addendum' && (
                          <>
                            {' '}
                            <button type="button" className="font-medium hover:underline" style={{ color: 'var(--color-campaign-purple)' }} onClick={() => setViewId(null)}>
                              {t('contract.backToMain')}
                            </button>
                          </>
                        )}
                      </p>
                    )}
                    {contract?.kind === 'addendum' && (
                      <div className="rounded-xl p-4" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }}>
                        <div className="v-ink font-medium" style={{ fontSize: 15 }}>{contract.title}</div>
                        {contract.scope && <p className="v-body v-ink mt-1 whitespace-pre-wrap" style={{ fontSize: 13 }}>{contract.scope}</p>}
                        {!!contract.tasks?.length && (
                          <ol className="mt-2 space-y-1">
                            {contract.tasks.map((task, i) => (
                              <li key={task.key || i} className="flex items-start gap-2 v-body v-ink" style={{ fontSize: 13 }}>
                                <span className="v-caption v-quiet tabular-nums shrink-0 mt-0.5" style={{ fontSize: 11 }}>{i + 1}.</span>
                                <span>
                                  <span className="font-medium">{task.title}</span>
                                  {(task.platform || task.due_days) && <span className="v-caption v-quiet"> · {[task.platform, task.due_days ? t('board.dueDays', { count: task.due_days }) : ''].filter(Boolean).join(' · ')}</span>}
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                    {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
                    {done && <Notice tone="success" onDismiss={() => setDone('')}>{done}</Notice>}

                    {!contract ? (
                      <Notice tone="info">
                        {isBrand ? t('contract.noContractBrand') : t('contract.noContractCreator')}
                      </Notice>
                    ) : (
                      <>
                        {/* Parties */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {partyCard(brand, 'brand', contract.offered_at ? <span className="v-quiet">{t('contract.sentOn', { when: dateTime(contract.offered_at) })}</span> : <span className="v-quiet">—</span>)}
                          {partyCard(
                            creator,
                            'creator',
                            contract.signed_at ? (
                              <span className="inline-flex items-center gap-1" style={{ color: 'var(--color-signal-green)' }}>
                                <Check size={11} /> {t('contract.signedOn', { when: dateTime(contract.signed_at) })}
                              </span>
                            ) : (
                              <span className="v-quiet">{t('contract.notSigned')}</span>
                            ),
                          )}
                        </div>

                        {/* Money */}
                        <div
                          className="flex items-center justify-between gap-3 flex-wrap rounded-xl p-4"
                          style={{ background: 'linear-gradient(135deg, rgba(22,199,132,0.10) 0%, rgba(0,212,199,0.12) 100%)', border: '1px solid rgba(22,199,132,0.20)' }}
                        >
                          <div>
                            <div className="v-caption font-medium uppercase tracking-wider" style={{ color: '#0b6e3e', fontSize: 10.5 }}>{t('contract.amount')}</div>
                            <div className="font-semibold tabular-nums" style={{ color: '#0b6e3e', fontSize: 22, letterSpacing: '-0.018em' }}>
                              {money(contract.payment_amount, contract.currency, contract.payment_frequency, contract.payment_day, contract.ends_at)}
                            </div>
                          </div>
                          {contract.notes && (
                            <div className="v-caption" style={{ color: '#0b6e3e', fontSize: 12, maxWidth: '48ch' }}>
                              {contract.notes}
                            </div>
                          )}
                        </div>

                        {/* Counter-offer on the table */}
                        {contract.counter && (
                          <div className="rounded-xl p-4" style={{ background: 'rgba(255,181,71,0.10)', border: '1px solid rgba(255,181,71,0.35)' }}>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <div className="v-caption font-medium uppercase tracking-wider inline-flex items-center gap-1.5" style={{ fontSize: 10.5, color: '#8a5a00' }}>
                                  <ArrowLeftRight size={11} /> {t('contract.counterFrom', { name: creator?.name || t('contract.creator') })}
                                </div>
                                <div className="v-ink font-semibold tabular-nums" style={{ fontSize: 18, letterSpacing: '-0.015em' }}>
                                  {money(contract.counter.payment_amount, contract.counter.currency, contract.counter.payment_frequency, contract.counter.payment_day, contract.counter.ends_at)}
                                </div>
                                {contract.counter.note && <p className="v-body v-ink mt-1" style={{ fontSize: 13 }}>{contract.counter.note}</p>}
                                <div className="v-caption v-quiet mt-1" style={{ fontSize: 11 }}>{dateTime(contract.counter.at)}</div>
                              </div>
                              {isBrand ? (
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button variant="tertiary" size="sm" onPress={() => setConfirm('decline_counter')} isDisabled={!!busy}>
                                    <XCircle size={12} /> {t('contract.declineCounter')}
                                  </Button>
                                  <Button variant="primary" size="sm" onPress={() => setConfirm('accept_counter')} isDisabled={!!busy}>
                                    <Check size={12} /> {t('contract.acceptCounter')}
                                  </Button>
                                </div>
                              ) : (
                                <span className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('contract.counterWaiting')}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {!isBrand && status === 'pending_signature' && <Notice tone="info">{t('contract.creatorNote')}</Notice>}
                        {isBrand && status === 'pending_signature' && <Notice tone="info">{t('contract.brandWaiting', { name: creator?.name || t('contract.creator') })}</Notice>}
                        {status === 'rejected' && <Notice tone="error">{isBrand ? t('contract.rejectedBrand') : t('contract.rejectedCreator')}</Notice>}

                        {/* Agreement text */}
                        <div>
                          <div className="v-caption v-ink font-medium mb-1.5" style={{ fontSize: 12.5 }}>{t('contract.agreement')}</div>
                          <div
                            className="rounded-xl p-4 v-body v-ink whitespace-pre-wrap"
                            style={{ background: 'rgba(244,242,255,0.5)', border: '1px solid var(--color-cool-gray)', fontSize: 13, lineHeight: 1.65, maxHeight: 360, overflow: 'auto' }}
                            data-testid="agreement-text"
                          >
                            {contract.terms || t('contract.noTerms')}
                          </div>
                        </div>

                        {/* Creator counter-offer form */}
                        {!isBrand && counterOpen && status === 'pending_signature' && (
                          <div className="rounded-xl p-4 space-y-3" style={{ border: '1px solid var(--color-cool-gray)' }}>
                            <div className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 14 }}>
                              <ArrowLeftRight size={14} style={{ color: 'var(--color-campaign-purple)' }} /> {t('contract.counterTitle')}
                            </div>
                            <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('contract.counterHint')}</p>
                            <div className="grid grid-cols-[110px_1fr] gap-3">
                              <div>
                                <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('wizard.currency')}</label>
                                <select className={fieldClass} value={cCurrency} onChange={(e) => setCCurrency(e.target.value)}>
                                  {CURRENCIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label htmlFor="counter-amount" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.amount')}</label>
                                <input id="counter-amount" type="number" min={0} step="0.01" className={fieldClass} value={cAmount} onChange={(e) => setCAmount(e.target.value)} />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.frequency')}</label>
                                <select className={fieldClass} value={cFrequency} onChange={(e) => setCFrequency(e.target.value)}>
                                  {PAYMENT_FREQUENCIES.map((f) => (
                                    <option key={f} value={f}>{t(`apps.freq.${f}`)}</option>
                                  ))}
                                </select>
                              </div>
                              <div style={hasPaymentDay(cFrequency) ? undefined : { opacity: 0.45, pointerEvents: 'none' }}>
                                <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.paymentDay')}</label>
                                <select className={fieldClass} value={cDay} onChange={(e) => setCDay(e.target.value)} disabled={!hasPaymentDay(cFrequency)}>
                                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            {cFrequency !== 'one_time' && (
                              <div>
                                <label htmlFor="counter-ends" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('apps.runsUntil', { freq: t(`apps.freq.${cFrequency}`) })}</label>
                                <input id="counter-ends" type="date" min={new Date().toISOString().slice(0, 10)} className={fieldClass} value={cEndsAt} onChange={(e) => setCEndsAt(e.target.value)} />
                              </div>
                            )}
                            <div>
                              <label htmlFor="counter-note" className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('contract.counterNote')}</label>
                              <textarea id="counter-note" className={`${fieldClass} resize-none`} rows={2} value={cNote} onChange={(e) => setCNote(e.target.value)} placeholder={t('contract.counterNotePh')} />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onPress={() => setCounterOpen(false)} isDisabled={busy === 'counter'}>{t('common.cancel')}</Button>
                              <Button variant="primary" size="sm" onPress={sendCounter} isPending={busy === 'counter'}>
                                <Send size={12} /> {t('contract.sendCounter')}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Extra work on top of this agreement */}
                        {contract.kind !== 'addendum' && (addenda.length > 0 || (isBrand && status === 'active' && onProposeExtra)) && (
                          <div className="rounded-xl p-3" style={{ border: '1px solid var(--color-cool-gray)' }}>
                            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                              <span className="v-caption v-ink font-medium inline-flex items-center gap-1.5" style={{ fontSize: 12.5 }}>
                                <PlusCircle size={12} /> {t('contract.extraList')}
                              </span>
                              {isBrand && status === 'active' && onProposeExtra && (
                                <Button variant="tertiary" size="sm" onPress={onProposeExtra} isDisabled={!!busy}>
                                  <PlusCircle size={12} /> {t('contract.proposeExtra')}
                                </Button>
                              )}
                            </div>
                            {addenda.length === 0 ? (
                              <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('contract.extraNone')}</p>
                            ) : (
                              <ul className="divide-y divide-border">
                                {addenda.map((a) => (
                                  <li key={a.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                                    <div className="min-w-0 flex-1">
                                      <div className="v-ink font-medium truncate" style={{ fontSize: 13 }}>{a.title}</div>
                                      <div className="v-caption v-quiet tabular-nums" style={{ fontSize: 11.5 }}>{money(a.payment_amount, a.currency, a.payment_frequency, a.payment_day, a.ends_at)}</div>
                                    </div>
                                    <Chip color={STATUS_COLOR[a.status] || 'default'} variant="soft" size="sm">
                                      <Chip.Label>{t(`contractStatus.${a.status}`, { defaultValue: a.status.replace('_', ' ') })}</Chip.Label>
                                    </Chip>
                                    <Button variant={['pending_signature', 'countered'].includes(a.status) ? 'primary' : 'ghost'} size="sm" onPress={() => setViewId(a.id)}>
                                      {['pending_signature', 'countered'].includes(a.status) ? t('contract.review') : t('contract.open')}
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {/* History */}
                        {!!contract.history?.length && (
                          <div>
                            <div className="v-caption v-ink font-medium mb-1.5 inline-flex items-center gap-1.5" style={{ fontSize: 12.5 }}>
                              <History size={12} /> {t('contract.history')}
                            </div>
                            <ul className="space-y-1">
                              {[...contract.history].reverse().slice(0, 8).map((h, i) => (
                                <li key={i} className="flex items-start gap-2 v-caption" style={{ fontSize: 12 }}>
                                  <span className="mt-1.5 size-1.5 rounded-full shrink-0" style={{ background: 'var(--color-campaign-purple)' }} />
                                  <span className="min-w-0">
                                    <span className="v-ink">{t(`contract.hist.${h.action}`, { defaultValue: h.action })}</span>
                                    <span className="v-quiet"> · {t(h.by === 'brand' ? 'contract.byBrand' : 'contract.byCreator')}</span>
                                    {h.payment_amount != null && <span className="v-quiet tabular-nums"> · {money(h.payment_amount, h.currency, h.payment_frequency, h.payment_day)}</span>}
                                    <span className="v-quiet"> · {dateTime(h.at)}</span>
                                    {h.note && <span className="block v-quiet">“{h.note}”</span>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Modal.Body>

              <Modal.Footer>
                <Button variant="ghost" onPress={onClose} isDisabled={!!busy}>
                  {t('common.close')}
                </Button>
                {(justSigned || status === 'active') && contract && (
                  <Link to={`/dashboard/workspace?contract=${contract.kind === 'addendum' ? contract.id : contract.id}`}>
                    <Button variant={justSigned ? 'primary' : 'tertiary'}>
                      <ListChecks size={13} /> {t('contract.openWorkspace')}
                    </Button>
                  </Link>
                )}
                {canEditAsBrand && (
                  <Button variant={contract ? 'tertiary' : 'primary'} onPress={onEdit} isDisabled={!!busy}>
                    {contract ? <Pencil size={13} /> : <Send size={13} />} {contract ? t('contract.editResend') : t('contract.sendContract')}
                  </Button>
                )}
                {!isBrand && status === 'pending_signature' && (
                  <>
                    <Button variant="ghost" className="!text-danger" onPress={() => setConfirm('decline')} isDisabled={!!busy}>
                      <XCircle size={13} /> {t('contract.decline')}
                    </Button>
                    <Button variant="tertiary" onPress={() => setCounterOpen((v) => !v)} isDisabled={!!busy}>
                      <ArrowLeftRight size={13} /> {t('contract.counter')}
                    </Button>
                    <Button variant="primary" onPress={() => setConfirm('accept')} isDisabled={!!busy}>
                      <Check size={13} /> {t('contract.sign')}
                    </Button>
                  </>
                )}
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmModal
        open={!!confirm}
        title={confirm ? label(confirm) : ''}
        body={confirm ? body(confirm) : ''}
        confirmLabel={confirm ? t(`contract.confirm.${confirm}Btn`) : ''}
        cancelLabel={t('common.cancel')}
        tone={confirm === 'decline' || confirm === 'decline_counter' ? 'danger' : 'primary'}
        pending={!!busy}
        onConfirm={() => confirm && run(confirm)}
        onClose={() => !busy && setConfirm(null)}
      />
    </>
  );
}

export default ContractManager;
