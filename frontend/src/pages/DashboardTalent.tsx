import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ExternalLink, Star } from 'lucide-react';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { PageShell } from '../components/ui';
import { EmptyPanel } from '../components/common/EmptyPanel';
import { TalentDirectory } from '../components/common/TalentDirectory';

/**
 * DashboardTalent — "find talent" inside the workspace.
 *
 * Brands and admins always have it. An account manager is a service
 * provider: they reach the directory only once a brand has engaged them,
 * so before that this page points them at the campaign board instead.
 */
const DashboardTalent: React.FC = () => {
  const { t } = useTranslation();
  const role = (localStorage.getItem('role') || '').toLowerCase().trim();
  const isManager = role === 'manager';
  const [engaged, setEngaged] = useState<boolean | null>(isManager ? null : true);

  useEffect(() => {
    if (!isManager) return;
    api
      .get('/manager-applications/engagements')
      .then((res) => setEngaged(Array.isArray(res.data) && res.data.length > 0))
      .catch(() => setEngaged(false));
  }, [isManager]);

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('talent.titleA')}
      titleAccent={t('talent.titleB')}
      description={isManager ? t('talent.descManager') : t('talent.desc')}
      icon={<Star size={18} />}
      actions={
        <Link to="/talent" target="_blank" rel="noreferrer">
          <Button variant="tertiary" size="sm">
            <ExternalLink size={13} /> {t('dash.openPublic')}
          </Button>
        </Link>
      }
    >
      {engaged === null ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="v-talent-card p-4">
              <div className="v-skel h-4 w-1/3 mb-2" />
              <div className="v-skel h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : engaged ? (
        <TalentDirectory />
      ) : (
        <EmptyPanel
          icon={<Briefcase size={22} />}
          title={t('talent.lockedTitle')}
          description={t('talent.lockedDesc')}
          actions={
            <Link to="/dashboard/campaigns">
              <Button variant="primary">{t('mcamp.browse')}</Button>
            </Link>
          }
        />
      )}
    </PageShell>
  );
};

export default DashboardTalent;
