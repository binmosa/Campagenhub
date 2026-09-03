import React, { useEffect, useState } from 'react';
import { Check, FileText, Sparkles, XCircle } from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatBudget } from '../../lib/campaignFormat';
import { fieldClass } from '../../pages/talent/shared';
import { Notice } from '../common/Notice';

/**
 * ContractManager — the per-application contract, as a HeroUI modal.
 *
 * Wired to the application it belongs to: when no contract exists yet the
 * terms prefill from the campaign's contract template and the amount from
 * the agreed payment terms (or the campaign budget), in the campaign's
 * currency. Brands propose / update until the creator signs; creators
 * sign or decline while it is awaiting signature.
 */
interface Contract {
  id: string;
  status: string;
  terms: string;
  payment_amount: number | string | null;
  contract_length: string | null;
}

interface ContractManagerProps {
  applicationId: string;
  isBrand: boolean;
  onClose: () => void;
  /** The application row (with campaign + payment terms) for prefill. */
  application?: any;
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success',
  approved: 'success',
  pending_signature: 'warning',
  rejected: 'danger',
  ended: 'default',
  draft: 'default',
};

export function ContractManager({ applicationId, isBrand, onClose, application }: ContractManagerProps) {
  const { t } = useTranslation();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState('');
  const [amount, setAmount] = useState('');
  const [length, setLength] = useState('');
  const [busy, setBusy] = useState<'save' | 'approved' | 'rejected' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const currency: string = application?.currency || application?.campaign?.currency || 'USD';
  const campaignTitle: string = application?.campaign?.title || '';
  const counterparty: string =
    application?.creator?.creatorProfile?.full_name ||
    application?.creator?.email?.split('@')[0] ||
    application?.campaign?.brand?.brandProfile?.company_name ||
    '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/contracts/application/${applicationId}`)
      .then((res) => {
        if (cancelled) return;
        const c: Contract | null = res.data || null;
        setContract(c);
        // Prefill from the brief + agreed terms when nothing was proposed yet.
        setTerms(c?.terms || application?.campaign?.contract_template || '');
        const amt = c?.payment_amount ?? application?.payment_amount ?? application?.campaign?.budget ?? '';
        setAmount(amt === '' || amt == null ? '' : String(Number(amt)));
        setLength(c?.contract_length || '');
      })
      .catch(() => {
        if (!cancelled) setError(t('contract.errLoad'));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applicationId, application, t]);

  const status = contract?.status || 'draft';
  const locked = ['approved', 'active', 'ended'].includes(status);
  const canEdit = isBrand && !locked;

  const save = async () => {
    const n = Number(amount);
    if (!terms.trim()) return setError(t('contract.errTerms'));
    if (!amount || !Number.isFinite(n) || n <= 0) return setError(t('contract.errAmount'));
    setBusy('save');
    setError('');
    try {
      await api.post(`/contracts/application/${applicationId}`, { terms, paymentAmount: n, contractLength: length });
      const res = await api.get(`/contracts/application/${applicationId}`);
      setContract(res.data || null);
      setDone(t('contract.saved'));
    } catch (e: any) {
      setError(e?.response?.data?.message || t('contract.errSave'));
    } finally {
      setBusy(null);
    }
  };

  const respond = async (next: 'approved' | 'rejected') => {
    setBusy(next);
    setError('');
    try {
      await api.put(`/contracts/application/${applicationId}/respond`, { status: next });
      const res = await api.get(`/contracts/application/${applicationId}`);
      setContract(res.data || null);
      setDone(next === 'approved' ? t('contract.signed') : t('contract.declined'));
    } catch (e: any) {
      setError(e?.response?.data?.message || t('contract.errRespond'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && !busy && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 flex-wrap">
                <span className="v-hero-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                  <FileText size={15} />
                </span>
                {t('contract.title')}
                {!loading && (
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
                  <div className="v-skel h-40 w-full" />
                  <div className="v-skel h-10 w-1/2" />
                </div>
              ) : (
                <div className="space-y-5">
                  {(campaignTitle || counterparty) && (
                    <p className="v-body v-muted" style={{ fontSize: 13 }}>
                      {t('contract.between', { campaign: campaignTitle || '—', name: counterparty || '—' })}
                    </p>
                  )}
                  {error && <Notice tone="error" onDismiss={() => setError('')}>{error}</Notice>}
                  {done && <Notice tone="success" onDismiss={() => setDone('')}>{done}</Notice>}
                  {!contract && canEdit && terms && (
                    <Notice tone="info">
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles size={13} /> {t('contract.prefilled')}
                      </span>
                    </Notice>
                  )}
                  {!isBrand && status === 'pending_signature' && <Notice tone="info">{t('contract.creatorNote')}</Notice>}

                  <div>
                    <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('contract.terms')}</label>
                    {canEdit ? (
                      <textarea
                        className={`${fieldClass} resize-y min-h-[180px] font-mono`}
                        style={{ fontSize: 12.5, lineHeight: 1.55 }}
                        value={terms}
                        onChange={(e) => setTerms(e.target.value)}
                        placeholder={t('contract.termsPh')}
                        rows={8}
                      />
                    ) : (
                      <div
                        className="rounded-xl p-4 v-body v-ink whitespace-pre-wrap"
                        style={{ background: 'rgba(244,242,255,0.5)', border: '1px solid var(--color-cool-gray)', fontSize: 13, lineHeight: 1.6, maxHeight: 320, overflow: 'auto' }}
                      >
                        {terms || t('contract.noTerms')}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>
                        {t('contract.amount')} ({currency})
                      </label>
                      {canEdit ? (
                        <input type="number" min={0} step="0.01" className={fieldClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
                      ) : (
                        <div className="font-semibold tabular-nums" style={{ fontSize: 20, color: '#0b6e3e', letterSpacing: '-0.018em' }}>
                          {amount ? formatBudget(Number(amount), currency) : '—'}
                          {application?.payment_frequency && (
                            <span className="v-caption v-quiet font-normal" style={{ fontSize: 12 }}> / {t(`apps.freq.${application.payment_frequency}`, { defaultValue: application.payment_frequency })}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12.5 }}>{t('contract.length')}</label>
                      {canEdit ? (
                        <input className={fieldClass} value={length} onChange={(e) => setLength(e.target.value)} placeholder={t('contract.lengthPh')} />
                      ) : (
                        <div className="v-ink font-medium" style={{ fontSize: 14 }}>{length || '—'}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={!!busy}>
                {t('common.close')}
              </Button>
              {canEdit && (
                <Button variant="primary" onPress={save} isPending={busy === 'save'}>
                  <Check size={13} /> {contract ? t('contract.update') : t('contract.propose')}
                </Button>
              )}
              {!isBrand && status === 'pending_signature' && (
                <>
                  <Button variant="ghost" className="!text-danger" onPress={() => respond('rejected')} isPending={busy === 'rejected'} isDisabled={busy === 'approved'}>
                    <XCircle size={13} /> {t('contract.decline')}
                  </Button>
                  <Button variant="primary" onPress={() => respond('approved')} isPending={busy === 'approved'} isDisabled={busy === 'rejected'}>
                    <Check size={13} /> {t('contract.sign')}
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default ContractManager;
