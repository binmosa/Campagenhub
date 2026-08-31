import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Loader2 } from 'lucide-react';
import { Button, Card, Chip } from '@heroui/react';
import { motion } from 'motion/react';
import type { LandingSettings, ActiveCampaign } from '../useLandingData';

/**
 * ActiveCampaigns — quiet 3-column marketplace, brand-aligned.
 *
 * Uses HeroUI Card / Chip / Button so the hover, focus, and press
 * animations come from the design system.
 */
interface ActiveCampaignsProps {
  settings: LandingSettings;
  campaigns: ActiveCampaign[];
  loading: boolean;
}

const BRAND_ACCENTS = ['#6c63ff', '#00d4c7', '#4f7cff', '#ffb547', '#ff5a5f', '#7b61ff'];

const formatBudget = (raw?: number | string) => {
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
};

const brandInitials = (name?: string) =>
  (name || 'CH').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

export const ActiveCampaigns: React.FC<ActiveCampaignsProps> = ({
  settings,
  campaigns,
  loading,
}) => {
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
            Live now · open for applications
          </span>
          <h2 className="mt-5 v-heading-xl">
            {settings.active_camp_title || 'Live on the platform today.'}
          </h2>
          <p className="mt-4 v-body-lg v-muted">
            {settings.active_camp_desc ||
              'Real campaigns from real brands. Real budgets, open to applications right now.'}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 v-muted">
            <Loader2 className="animate-spin" size={18} />
            <span className="ml-3 v-body">Loading campaigns…</span>
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
              <Card.Title>No campaigns yet</Card.Title>
              <Card.Description className="mt-2">
                Be the first to launch — sign up and post a campaign in minutes.
              </Card.Description>
            </Card.Content>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {shown.map((c, i) => {
              const brandName =
                c.brand?.brandProfile?.company_name ||
                c.brand?.email?.split('@')[0] ||
                'Brand';
              const accent = BRAND_ACCENTS[i % BRAND_ACCENTS.length];
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -3 }}
                >
                  <Card>
                    <Card.Content className="p-5">
                      <header className="flex items-center gap-3">
                        {c.brand?.brandProfile?.logo_url ? (
                          <img
                            src={c.brand.brandProfile.logo_url}
                            alt={brandName}
                            className="h-10 w-10 rounded-xl object-cover"
                            style={{ border: '1px solid var(--color-cool-gray)' }}
                          />
                        ) : (
                          <span
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl font-medium"
                            style={{ background: accent, color: '#fff', fontSize: 13 }}
                          >
                            {brandInitials(brandName)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="v-body font-medium v-ink truncate">{brandName}</div>
                          {c.platform && (
                            <div className="v-caption v-quiet capitalize">{c.platform}</div>
                          )}
                        </div>
                        <Chip color="success" variant="soft" size="sm">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#16c784' }} />
                          Live
                        </Chip>
                      </header>

                      <h3
                        className="mt-4 v-ink font-medium"
                        style={{
                          fontSize: 16,
                          lineHeight: 1.3,
                          letterSpacing: '-0.016em',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          minHeight: '2.6em',
                        }}
                      >
                        {c.title}
                      </h3>

                      <p
                        className="mt-2 v-body v-muted"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          minHeight: '2.6em',
                        }}
                      >
                        {c.description || ' '}
                      </p>

                      <div
                        className="mt-5 pt-4 flex items-center justify-between"
                        style={{ borderTop: '1px solid var(--color-cool-gray)' }}
                      >
                        <div>
                          <div className="v-caption v-quiet">Budget</div>
                          <div
                            className="v-ink font-medium tabular-nums"
                            style={{ fontSize: 18, letterSpacing: '-0.018em' }}
                          >
                            {formatBudget(c.budget)}
                          </div>
                        </div>
                        <Link to="/campaigns">
                          <Button variant="outline" size="sm" className="!rounded-lg">
                            Apply
                          </Button>
                        </Link>
                      </div>
                    </Card.Content>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-12 flex justify-center">
          <Link to="/campaigns">
            <Button variant="outline" size="md" className="!rounded-xl">
              {settings.active_camp_btn || 'View all campaigns'} <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ActiveCampaigns;
