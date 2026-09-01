import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatCompact, socialEntries } from '../../lib/socialLinks';
import PlatformIcon from '../landing/mocks/PlatformIcon';
import { PLATFORM_ICON_KEY, accentFor } from '../talent/shared';
import type { Market } from './MarketContext';

/**
 * MarketCreatorsStrip — "Creators in {country}", injected into the shared
 * landing page when it renders under a market URL. Real directory data;
 * renders nothing while the market has no creators yet.
 */
export const MarketCreatorsStrip: React.FC<{ market: Market }> = ({ market }) => {
  const { t } = useTranslation();
  const [creators, setCreators] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api
      .get('/creators/public-list', {
        params: { countryCode: market.code.toUpperCase(), limit: '6' },
      })
      .then((res) => {
        setCreators(res.data?.items || []);
        setTotal(Number(res.data?.total) || 0);
      })
      .catch(() => {});
  }, [market.code]);

  if (creators.length === 0) return null;

  return (
    <section className="px-6 lg:px-10 py-16" style={{ background: 'rgba(244,242,255,0.35)' }}>
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <h2 className="v-heading-lg">
            {market.flag} {t('market.creatorsIn', { country: market.name })}
          </h2>
          <Chip color="accent" variant="soft" size="sm">
            <Chip.Label>{total}</Chip.Label>
          </Chip>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {creators.map((c) => {
            const accent = accentFor(String(c.id || c.full_name));
            const links = socialEntries(c.social_links);
            const followers = links.reduce((s, l) => s + (l.followers || 0), 0);
            return (
              <div key={c.id} className="v-talent-card p-3 text-center">
                <span className="v-story-ring mx-auto">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" loading="lazy" className="h-12 w-12 object-cover" />
                  ) : (
                    <span
                      className="inline-flex h-12 w-12 items-center justify-center text-base font-medium text-white"
                      style={{ background: accent.from }}
                    >
                      {(c.full_name || 'C')[0]?.toUpperCase()}
                    </span>
                  )}
                </span>
                <div className="mt-2 v-ink font-medium truncate" style={{ fontSize: 13 }}>
                  {c.full_name || c.username}
                </div>
                <div className="v-caption v-quiet truncate" style={{ fontSize: 11 }}>
                  {c.category || '—'}
                </div>
                {followers > 0 && (
                  <div
                    className="mt-1 v-caption font-medium tabular-nums"
                    style={{ color: 'var(--color-campaign-purple)', fontSize: 11.5 }}
                  >
                    {formatCompact(followers)}
                  </div>
                )}
                <div className="mt-1.5 flex items-center justify-center gap-1">
                  {links.slice(0, 3).map((l) => (
                    <span key={l.id} className="inline-flex" style={{ color: l.color }}>
                      <PlatformIcon platform={PLATFORM_ICON_KEY[l.id]} size={11} />
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-7 flex justify-center">
          <Link to={`/talent?country=${encodeURIComponent(market.name)}`}>
            <Button variant="outline" size="md" className="!rounded-xl">
              {t('market.browseCreatorsIn', { country: market.name })} <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default MarketCreatorsStrip;
