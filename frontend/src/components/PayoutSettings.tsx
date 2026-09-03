import React, { useEffect, useMemo, useState } from 'react';
import { Check, Landmark, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { fieldClass } from '../pages/talent/shared';
import { Notice } from './common/Notice';
import { PillChips } from './common/filters';

/**
 * PayoutSettings — where a creator / manager gets paid. Bank transfer (with
 * the live bank list + account verification where the provider supports it)
 * or mobile money. Only the account fields are sent back — never the
 * server-owned id / verification flag the old form echoed.
 */
const COUNTRIES: { code: string; name: string; currency: string; networks: string[] }[] = [
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', networks: ['Telebirr', 'M-Pesa'] },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', networks: ['OPay', 'PalmPay', 'MTN MoMo'] },
  { code: 'KE', name: 'Kenya', currency: 'KES', networks: ['M-Pesa', 'Airtel Money'] },
  { code: 'GH', name: 'Ghana', currency: 'GHS', networks: ['MTN MoMo', 'Vodafone Cash', 'AirtelTigo Money'] },
  { code: 'UG', name: 'Uganda', currency: 'UGX', networks: ['MTN MoMo', 'Airtel Money'] },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', networks: [] },
  { code: 'US', name: 'United States', currency: 'USD', networks: [] },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', networks: [] },
];

type Form = {
  account_type: 'bank' | 'mobile_money';
  country: string;
  currency: string;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  mobile_number: string;
  mobile_network: string;
};
const EMPTY: Form = { account_type: 'bank', country: 'ET', currency: 'ETB', bank_name: '', bank_code: '', account_number: '', account_name: '', mobile_number: '', mobile_network: '' };

const Field: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5 gap-2">
      <label className="v-caption v-ink font-medium" style={{ fontSize: 12.5 }}>{label}</label>
      {hint && <span className="v-caption v-quiet" style={{ fontSize: 11 }}>{hint}</span>}
    </div>
    {children}
  </div>
);

const PayoutSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState<Form>(EMPTY);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    api
      .get('/payout-accounts/mine')
      .then((res) => {
        const d = res.data;
        if (d && typeof d === 'object') {
          setForm({
            account_type: d.account_type === 'mobile_money' ? 'mobile_money' : 'bank',
            country: (d.country || 'ET').toUpperCase(),
            currency: d.currency || COUNTRIES.find((c) => c.code === (d.country || 'ET').toUpperCase())?.currency || 'USD',
            bank_name: d.bank_name || '',
            bank_code: d.bank_code || '',
            account_number: d.account_number || '',
            account_name: d.account_name || '',
            mobile_number: d.mobile_number || '',
            mobile_network: d.mobile_network || '',
          });
          setVerified(!!d.is_verified);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* Bank list for the chosen country (provider-backed; empty → free text). */
  useEffect(() => {
    if (form.account_type !== 'bank') return;
    let cancelled = false;
    api
      .get(`/payout-accounts/banks/${form.country}`)
      .then((res) => {
        if (cancelled) return;
        const list = (Array.isArray(res.data) ? res.data : []).map((b: any) => ({ code: String(b.code ?? b.id ?? ''), name: String(b.name || '') })).filter((b: any) => b.name);
        setBanks(list);
      })
      .catch(() => !cancelled && setBanks([]));
    return () => {
      cancelled = true;
    };
  }, [form.country, form.account_type]);

  const country = useMemo(() => COUNTRIES.find((c) => c.code === form.country), [form.country]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setCountry = (code: string) => {
    const c = COUNTRIES.find((x) => x.code === code);
    setForm((f) => ({ ...f, country: code, currency: c?.currency || f.currency, bank_name: '', bank_code: '', mobile_network: '' }));
  };

  const verify = async () => {
    if (!form.account_number || !form.bank_code) return setNotice({ tone: 'error', text: t('payout.verifyNeeds') });
    setVerifying(true);
    setNotice(null);
    try {
      const res = await api.post('/payout-accounts/verify', { account_number: form.account_number, bank_code: form.bank_code, country: form.country });
      const name = res.data?.account_name || res.data?.data?.account_name;
      if (name) {
        set('account_name', name);
        setNotice({ tone: 'success', text: t('payout.verifiedAs', { name }) });
      } else {
        setNotice({ tone: 'info', text: t('payout.verifyUnavailable') });
      }
    } catch (e: any) {
      setNotice({ tone: 'error', text: e?.response?.data?.message || t('payout.verifyFailed') });
    } finally {
      setVerifying(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.account_type === 'bank') {
      if (!form.bank_name.trim()) return setNotice({ tone: 'error', text: t('payout.errBank') });
      if (!form.account_number.trim()) return setNotice({ tone: 'error', text: t('payout.errNumber') });
      if (!form.account_name.trim()) return setNotice({ tone: 'error', text: t('payout.errHolder') });
    } else {
      if (!form.mobile_number.trim()) return setNotice({ tone: 'error', text: t('payout.errMobile') });
      if (!form.mobile_network) return setNotice({ tone: 'error', text: t('payout.errNetwork') });
    }
    setSaving(true);
    setNotice(null);
    try {
      const res = await api.post('/payout-accounts', form);
      setVerified(!!res.data?.is_verified);
      setNotice({ tone: 'success', text: t('payout.saved') });
    } catch (err: any) {
      setNotice({ tone: 'error', text: err?.response?.data?.message || t('payout.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="v-talent-card p-5 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="v-hero-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
            <Wallet size={14} />
          </span>
          <div>
            <h3 className="v-ink font-medium" style={{ fontSize: 15, letterSpacing: '-0.012em' }}>{t('payout.title')}</h3>
            <p className="v-caption v-quiet mt-0.5" style={{ fontSize: 12 }}>{t('payout.desc')}</p>
          </div>
        </div>
        {verified && (
          <Chip color="success" variant="soft" size="sm">
            <ShieldCheck size={11} />
            <Chip.Label>{t('payout.verified')}</Chip.Label>
          </Chip>
        )}
      </div>

      {loading ? (
        <div className="space-y-2" aria-hidden>
          <div className="v-skel h-10 w-1/2" />
          <div className="v-skel h-10 w-full" />
        </div>
      ) : (
        <>
          {notice && <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice>}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
            <Field label={t('payout.method')}>
              <PillChips
                options={[
                  { id: 'bank', label: <span className="inline-flex items-center gap-1.5"><Landmark size={12} /> {t('payout.bank')}</span> },
                  { id: 'mobile_money', label: <span className="inline-flex items-center gap-1.5"><Smartphone size={12} /> {t('payout.mobile')}</span> },
                ]}
                value={form.account_type}
                onSelect={(id) => id && set('account_type', id as Form['account_type'])}
              />
            </Field>
            <Field label={t('payout.country')}>
              <select className={fieldClass} value={form.country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} · {c.currency}</option>
                ))}
              </select>
            </Field>
          </div>

          {form.account_type === 'bank' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('payout.bankName')} hint={banks.length ? t('payout.banksLive') : t('payout.banksManual')}>
                {banks.length ? (
                  <select className={fieldClass} value={form.bank_code} onChange={(e) => { const b = banks.find((x) => x.code === e.target.value); setForm((f) => ({ ...f, bank_code: e.target.value, bank_name: b?.name || '' })); }}>
                    <option value="">{t('payout.pickBank')}</option>
                    {banks.map((b) => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                ) : (
                  <input className={fieldClass} value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} placeholder={t('payout.bankPh')} />
                )}
              </Field>
              <Field label={t('payout.accountNumber')}>
                <div className="flex items-center gap-2">
                  <input className={fieldClass} value={form.account_number} onChange={(e) => set('account_number', e.target.value.replace(/\s+/g, ''))} inputMode="numeric" />
                  {banks.length > 0 && (
                    <Button variant="tertiary" size="sm" onPress={verify} isPending={verifying} isDisabled={!form.account_number || !form.bank_code}>
                      {t('payout.verify')}
                    </Button>
                  )}
                </div>
              </Field>
              <Field label={t('payout.holder')} hint={t('payout.holderHint')}>
                <input className={fieldClass} value={form.account_name} onChange={(e) => set('account_name', e.target.value)} />
              </Field>
              <Field label={t('wizard.currency')}>
                <input className={fieldClass} value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase().slice(0, 3))} maxLength={3} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('payout.mobileNumber')}>
                <input className={fieldClass} value={form.mobile_number} onChange={(e) => set('mobile_number', e.target.value)} inputMode="tel" placeholder="+251 9…" />
              </Field>
              <Field label={t('payout.network')}>
                {country?.networks.length ? (
                  <select className={fieldClass} value={form.mobile_network} onChange={(e) => set('mobile_network', e.target.value)}>
                    <option value="">{t('payout.pickNetwork')}</option>
                    {country.networks.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                ) : (
                  <input className={fieldClass} value={form.mobile_network} onChange={(e) => set('mobile_network', e.target.value)} placeholder="M-Pesa, MTN MoMo…" />
                )}
              </Field>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('payout.note')}</p>
            <Button type="submit" variant="primary" size="sm" isPending={saving}>
              <Check size={12} /> {t('payout.save')}
            </Button>
          </div>
        </>
      )}
    </form>
  );
};

export default PayoutSettings;
