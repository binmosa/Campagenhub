import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useNoIndex, usePageMeta } from '../lib/seo';

/**
 * NotFound — the catch-all route.
 *
 * Unknown paths used to match nothing and render an empty document, so an
 * old marketing URL or a typo looked exactly like an outage.
 */
const NotFound: React.FC = () => {
  const { t } = useTranslation();
  useNoIndex();
  usePageMeta({ title: t('meta.notFoundTitle'), description: t('meta.notFound'), noindex: true });
  const signedIn = !!localStorage.getItem('token');

  return (
    <div className="landing-visitors min-h-screen flex items-center justify-center px-6 py-16 v-bg-canvas">
      <div className="text-center" style={{ maxWidth: 460 }}>
        <span className="v-hero-icon" style={{ width: 48, height: 48, borderRadius: 14 }}>
          <Compass size={22} />
        </span>
        <h1 className="v-heading-xl mt-5">{t('notFound.title')}</h1>
        <p className="v-body v-muted mt-3">{t('notFound.desc')}</p>
        <div className="flex items-center gap-2 justify-center flex-wrap mt-7">
          <Link to={signedIn ? '/dashboard' : '/'}>
            <Button variant="primary" size="md">{signedIn ? t('notFound.dashboard') : t('notFound.home')}</Button>
          </Link>
          <Link to="/campaigns">
            <Button variant="tertiary" size="md">{t('notFound.browse')}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
