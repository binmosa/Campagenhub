import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Landmark, Smartphone, Wallet } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';

/**
 * PayoutSummary — the one-glance version of the payout account for profile
 * pages. The full form (bank list, verification, mobile money) lives on the
 * Payments page; here we only say what is on file and link there.
 */
type Account = {
  account_type?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  mobile_number?: string;
  mobile_network?: string;
  country?: string;
  currency?: string;
  is_verified?: boolean;
} | null;

const mask = (n?: string) => (n ? `•••• ${n.slice(-4)}` : '');

export const PayoutSummary: React.FC = () => {
  const { t } = useTranslation();
  const [account, setAccount] = useState<Account | undefined>(undefined);

  useEffect(() => {
    api
      .get('/payout-accounts/mine')
      .then((r) => setAccount(r.data && (r.data.account_number || r.data.mobile_number) ? r.data : null))
      .catch(() => setAccount(null));
  }, []);

  const mobile = !!account?.mobile_number && !account?.account_number;

  return (
    <section className="v-talent-card p-5 flex flex-col sm:flex-row sm:items-center gap-4" data-testid="payout-summary">
      <span className="v-hero-icon shrink-0" style={{ width: 40, height: 40, borderRadius: 12 }}>
        {account === undefined ? <Wallet size={17} /> : mobile ? <Smartphone size={17} /> : <Landmark size={17} />}
      </span>
      <div className="min-w-0 flex-1">
        {account === undefined ? (
          <div aria-hidden><div className="v-skel h-4 w-1/3 mb-2" /><div className="v-skel h-3 w-2/3" /></div>
        ) : account ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="v-ink font-medium" style={{ fontSize: 15 }}>
                {mobile ? account.mobile_network || t('payout.summaryMobile') : account.bank_name || t('payout.summaryBank')}
              </span>
              {account.is_verified ? (
                <Chip color="success" variant="soft" size="sm"><CheckCircle2 size={11} /><Chip.Label>{t('payout.summaryVerified')}</Chip.Label></Chip>
              ) : (
                <Chip color="default" variant="soft" size="sm"><Chip.Label>{t('payout.summaryOnFile')}</Chip.Label></Chip>
              )}
            </div>
            <div className="v-caption v-quiet mt-0.5" style={{ fontSize: 12.5 }}>
              {mobile ? mask(account.mobile_number) : `${account.account_name ? `${account.account_name} · ` : ''}${mask(account.account_number)}`}
              {account.currency ? ` · ${account.currency}` : ''}
              {account.country ? ` · ${account.country}` : ''}
            </div>
          </>
        ) : (
          <>
            <div className="v-ink font-medium" style={{ fontSize: 15 }}>{t('payout.summaryNoneTitle')}</div>
            <div className="v-caption v-quiet mt-0.5" style={{ fontSize: 12.5 }}>{t('payout.summaryNoneDesc')}</div>
          </>
        )}
      </div>
      <Link to="/dashboard/payments" className="shrink-0">
        <Button variant={account === null ? 'primary' : 'tertiary'} size="sm">
          {account === null ? t('payout.summaryAdd') : t('payout.summaryManage')} <ArrowRight size={12} />
        </Button>
      </Link>
    </section>
  );
};

export default PayoutSummary;
