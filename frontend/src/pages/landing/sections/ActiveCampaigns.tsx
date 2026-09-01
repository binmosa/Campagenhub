import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, Loader2 } from 'lucide-react';
import { Button, Card } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import CampaignCard from '../../../components/common/CampaignCard';
import type { LandingSettings, ActiveCampaign } from '../useLandingData';

/**
 * ActiveCampaigns — "Live on the platform today".
 *
 * Renders THE campaign card (components/common/CampaignCard) — the exact
 * same card as the /campaigns marketplace, so the landing preview and the
 * real board can never drift apart. Apply routes to /campaigns where the
 * full application flow (video pitch, AI pitch, contract) lives.
 */
interface ActiveCampaignsProps {
  settings: LandingSettings;
  campaigns: ActiveCampaign[];
  loading: boolean;
}

export const ActiveCampaigns: React.FC<ActiveCampaignsProps> = ({
  settings,
  campaigns,
  loading,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loggedIn = !!localStorage.getItem('token');
  const isCreator = (localStorage.getItem('role') || '') === 'creator';
  const shown = campaigns.slice(0, 6);

  return (
    <section className="px-6 lg:px-10 py-24 sm:py-28">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center max-w-[640px] mx-auto mb-14">
          <span className="v-pill-quiet">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 v-pulse-dot" />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: '#16c784' }}
              />
            </span>
            {t('campaigns.pill')}
          </span>
          <h2 className="mt-5 v-heading-xl">
            {settings.active_camp_title || t('campaigns.title')}
          </h2>
          <p className="mt-4 v-body-lg v-muted">
            {settings.active_camp_desc || t('campaigns.desc')}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 v-muted">
            <Loader2 className="animate-spin" size={18} />
            <span className="ml-3 v-body">{t('campaigns.loading')}</span>
          </div>
        ) : shown.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <Card.Content className="p-8 text-center">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl mb-3"
                style={{ background: 'var(--color-soft-lavender)', color: 'var(--color-campaign-purple)' }}
              >
                <Briefcase size={18} strokeWidth={1.75} />
              </span>
              <Card.Title>{t('campaigns.emptyTitle')}</Card.Title>
              <Card.Description className="mt-2">
                {t('campaigns.emptyDesc')}
              </Card.Description>
            </Card.Content>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shown.map((c, i) => (
              <CampaignCard
                key={c.id}
                camp={c}
                index={i}
                applied={false}
                loggedIn={loggedIn}
                isCreator={isCreator}
                onApply={() => navigate('/campaigns')}
              />
            ))}
          </div>
        )}

        <div className="mt-12 flex justify-center">
          <Link to="/campaigns">
            <Button variant="outline" size="md" className="!rounded-xl">
              {settings.active_camp_btn || t('campaigns.viewAll')} <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ActiveCampaigns;
