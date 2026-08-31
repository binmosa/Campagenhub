import React, { useEffect, useState } from 'react';
import { CreditCard, Building2, Smartphone, CheckCircle, AlertCircle, Loader, ChevronDown } from 'lucide-react';
import api from '../lib/api';

const PayoutSettings: React.FC = () => {
  const normalizeCountry = (raw?: string) => {
    const value = (raw || '').trim().toUpperCase();
    const map: Record<string, string> = {
      NIGERIA: 'NG',
      KENYA: 'KE',
      GHANA: 'GH',
      'SOUTH AFRICA': 'ZA',
      UGANDA: 'UG',
      TANZANIA: 'TZ',
      ETHIOPIA: 'ET',
      'UNITED STATES': 'US',
      USA: 'US',
      'UNITED KINGDOM': 'GB',
      UK: 'GB',
      EUROPE: 'EU',
    };
    if (value.length === 2) return value;
    return map[value] || 'NG';
  };

  const [payoutAccount, setPayoutAccount] = useState<any>(null);
  const [form, setForm] = useState({
    account_type: 'bank' as 'bank' | 'mobile_money',
    bank_name: '', bank_code: '', account_number: '', account_name: '',
    mobile_number: '', mobile_network: '',
    country: 'NG', currency: 'NGN',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load existing payout account
  useEffect(() => {
    api.get('/payout-accounts/mine').then(res => {
      if (res.data) {
        const normalizedCountry = normalizeCountry(res.data.country);
        setPayoutAccount(res.data);
        setForm(f => ({ ...f, ...res.data, country: normalizedCountry }));
      }
    }).catch(() => {});
  }, []);

  // Auto-set currency when country changes
  useEffect(() => {
    const map: Record<string, string> = { NG: 'NGN', KE: 'KES', GH: 'GHS', ZA: 'ZAR', UG: 'UGX', TZ: 'TZS', ET: 'ETB', US: 'USD', GB: 'GBP', EU: 'EUR' };
    if (map[form.country]) setForm(f => ({ ...f, currency: map[form.country] }));
  }, [form.country]);

  const handleSave = async () => {
    if (form.account_type === 'bank') {
      if (!form.bank_name || !form.country) {
        setMsg({ type: 'error', text: 'Please provide bank name and country.' });
        return;
      }
      if (!form.account_number) {
        setMsg({ type: 'error', text: 'Please provide account number.' });
        return;
      }
    } else {
      if (!form.mobile_number) {
        setMsg({ type: 'error', text: 'Please provide mobile number for mobile money.' });
        return;
      }
    }

    setSaving(true); setMsg(null);
    try {
      const res = await api.post('/payout-accounts', form);
      setPayoutAccount(res.data);
      setMsg({ type: 'success', text: 'Payout account saved successfully.' });
      setTimeout(() => setMsg(null), 4000);
    } catch {
      setMsg({ type: 'error', text: 'Failed to save. Please check your details.' });
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-surface rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-6 border-b border-surface-100">
        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center border border-green-200">
          <CreditCard size={18} className="text-green-600" />
        </div>
        <div>
          <h2 className="font-bold text-surface-900">Payout Account</h2>
          <p className="text-xs text-surface-400">Configure your bank to receive payments</p>
        </div>
        {payoutAccount?.is_verified && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-xl border border-green-200">
            <CheckCircle size={12} /> Verified
          </span>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* Account Type Toggle */}
        <div className="flex items-center gap-2 p-1 bg-surface-100 rounded-2xl w-fit">
          {(['bank', 'mobile_money'] as const).map(t => (
            <button key={t} onClick={() => setForm(f => ({ ...f, account_type: t }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                form.account_type === t ? 'bg-surface dark:bg-surface-800 text-surface-900 dark:text-white shadow-sm' : 'text-surface-500 hover:text-surface-700'
              }`}>
              {t === 'bank' ? <Building2 size={14} /> : <Smartphone size={14} />}
              {t === 'bank' ? 'Bank Account' : 'Mobile Money'}
            </button>
          ))}
        </div>

        {form.account_type === 'bank' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Country */}
            <div>
              <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1.5">Country</label>
              <div className="relative">
                <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 appearance-none bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100">
                  {[['NG','Nigeria'],['KE','Kenya'],['GH','Ghana'],['ZA','South Africa'],['UG','Uganda'],['TZ','Tanzania'],['ET','Ethiopia'],['US','United States'],['GB','United Kingdom']].map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              </div>
            </div>

            {/* Bank Selection - Live from Flutterwave */}
            <div>
              <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1.5">Bank Name</label>
              <input
                value={form.bank_name}
                onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                placeholder="e.g. Commercial Bank of Ethiopia"
                className="w-full px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white dark:bg-surface-800 text-surface-900 dark:text-white"
              />
            </div>

            {/* Account Number */}
            <div>
              <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1.5">Account Number</label>
              <input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                placeholder="Enter account number" className="w-full px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white dark:bg-surface-800 text-surface-900 dark:text-white" />
            </div>

            {/* Account Holder Name */}
            <div>
              <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1.5">Account Holder Name</label>
              <input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                placeholder="Name on bank account" className="w-full px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white dark:bg-surface-800 text-surface-900 dark:text-white" />
            </div>

            {/* Currency */}
            <div>
              <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1.5">Currency</label>
              <div className="relative">
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 appearance-none bg-white dark:bg-surface-800 text-surface-900 dark:text-white">
                  {['NGN','KES','GHS','ZAR','UGX','TZS','ETB','USD','EUR','GBP'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1.5">Mobile Number</label>
              <input value={form.mobile_number} onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))}
                placeholder="e.g. +234xxxxxxxxxx" className="w-full px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white dark:bg-surface-800 text-surface-900 dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1.5">Network</label>
              <div className="relative">
                <select value={form.mobile_network} onChange={e => setForm(f => ({ ...f, mobile_network: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 appearance-none bg-white dark:bg-surface-800 text-surface-900 dark:text-white">
                  <option value="">Select network</option>
                  {['Ethio Telecom (Telebirr)', 'MTN','Airtel','Vodafone','Tigo','Safaricom','Orange'].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {/* Status Message */}
        {msg && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
            msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {msg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {msg.text}
          </div>
        )}

        {/* Save Button */}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm">
          {saving ? <Loader size={14} className="animate-spin" /> : <CreditCard size={14} />}
          {saving ? 'Saving...' : 'Save Payout Account'}
        </button>
      </div>
    </div>
  );
};

export default PayoutSettings;
