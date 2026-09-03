import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Star } from 'lucide-react';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { PageShell } from '../components/ui';
import { TalentDirectory } from '../components/common/TalentDirectory';

/**
 * DashboardTalent — "find talent" inside the workspace (brand, manager,
 * admin). Same directory, same filters, same cards as the public /talent
 * page; brands and managers can invite straight from a card.
 */
const DashboardTalent: React.FC = () => {
  const { t } = useTranslation();

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('talent.titleA')}
      titleAccent={t('talent.titleB')}
      description={t('talent.desc')}
      icon={<Star size={18} />}
      actions={
        <Link to="/talent" target="_blank" rel="noreferrer">
          <Button variant="tertiary" size="sm">
            <ExternalLink size={13} /> {t('dash.openPublic')}
          </Button>
        </Link>
      }
    >
      <TalentDirectory />
    </PageShell>
  );
};

export default DashboardTalent;
