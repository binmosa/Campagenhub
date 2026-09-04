import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, KeyRound, Settings, Shield } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import AccountSettings from '../../components/AccountSettings';
import { PageShell } from '../../components/ui';
import { StoryAvatar } from '../../components/common/StoryAvatar';
import { RoleChip } from './shared';

/**
 * AdminProfile — the staff account page (admin, support, finance): who you
 * are signed in as, and the shared account & security panels.
 */
const AdminProfile: React.FC = () => {
  const { t } = useTranslation();
  const role = (localStorage.getItem('role') || 'admin').toLowerCase().trim();
  const [me, setMe] = useState<any>(null);
  useEffect(() => {
    api.get('/auth/me').then((r) => setMe(r.data)).catch(() => {});
  }, []);
  const email: string = me?.email || '';
  const name: string = me?.display_name || email.split('@')[0] || t('side.roleAdmin');

  return (
    <PageShell
      hero
      title={t('adm.profile.title')}
      titleAccent={t('adm.profile.titleAccent')}
      description={t('adm.profile.desc')}
      icon={<Shield size={18} />}
      actions={
        role === 'admin' ? (
          <>
            <Link to="/dashboard/roles">
              <Button variant="tertiary" size="md"><KeyRound size={13} /> {t('adm.roles.title')} {t('adm.roles.titleAccent')}</Button>
            </Link>
            <Link to="/dashboard/site-control">
              <Button variant="primary" size="md"><Settings size={13} /> {t('side.siteControl')}</Button>
            </Link>
          </>
        ) : undefined
      }
      stats={
        <div className="v-talent-card p-4 flex items-center gap-4 flex-wrap">
          <StoryAvatar name={name} seed={me?.userId || email || 'staff'} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="v-ink font-medium truncate" style={{ fontSize: 18, letterSpacing: '-0.015em' }}>{name}</span>
              <RoleChip role={role} />
              <Chip color="success" variant="soft" size="sm"><BadgeCheck size={11} /><Chip.Label>{t('adm.profile.staffAccess')}</Chip.Label></Chip>
            </div>
            <div className="v-caption v-quiet truncate mt-0.5" style={{ fontSize: 12.5 }}>{email || '…'}</div>
          </div>
          <p className="v-caption v-quiet max-w-md" style={{ fontSize: 12 }}>{t(`adm.profile.scope.${role}`, { defaultValue: t('adm.profile.scope.admin') })}</p>
        </div>
      }
    >
      <AccountSettings email={email} />
    </PageShell>
  );
};

export default AdminProfile;
