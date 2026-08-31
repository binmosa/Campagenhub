import React from 'react';
import { Shield } from 'lucide-react';
import AccountSettings from '../../components/AccountSettings';
import { PageShell } from '../../components/ui';

const AdminProfile: React.FC = () => (
  <PageShell
    title="Admin settings"
    description="Manage your admin account security."
    icon={<Shield size={18} />}
    containerSize="narrow"
  >
    <AccountSettings />
  </PageShell>
);

export default AdminProfile;
