import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/layout/Layout';
import AuthGuard from './guards/AuthGuard';
import Landing from './pages/landing';
import GeoGate from './components/common/GeoGate';
import Maintenance from './pages/Maintenance';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import CreatorDashboard from './pages/creator/Dashboard';
import CreatorProfile from './pages/creator/Profile';
import BrandDashboard from './pages/brand/Dashboard';
import BrandProfile from './pages/brand/Profile';
import AdminDashboard from './pages/admin/Dashboard';

const GuestGuard = ({ children }: { children: React.ReactNode }) => {
  if (localStorage.getItem('token')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};
import AdminUsers from './pages/admin/Users';
import AdminRoles from './pages/admin/Roles';
import AdminCampaigns from './pages/admin/Campaigns';
import AdminApplications from './pages/admin/Applications';
import AdminPayouts from './pages/admin/Payouts';
import AdminProfile from './pages/admin/Profile';
import SiteSettings from './pages/admin/SiteSettings';
import AdminSupport from './pages/admin/Support';
import AdminFollowerClaims from './pages/admin/FollowerClaims';
import TelegramStudio from './pages/admin/TelegramStudio';

import BrandCampaigns from './pages/brand/Campaigns';
import BrandApplications from './pages/brand/Applications';
import CreatorApplications from './pages/creator/Applications';
import PublicCampaigns from './pages/PublicCampaigns';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import MarketPage from './pages/markets/MarketPage';
import PublicManagers from './pages/PublicManagers';

import TalentNetwork from './pages/TalentNetwork';
import Messages from './pages/Messages';
import Analytics from './pages/Analytics';
import AiHub from './pages/AiHub';
import Invitations from './pages/Invitations';
import MyTeam from './pages/MyTeam';
import ContractsPage from './pages/Contracts';
import ManagerDashboard from './pages/manager/Dashboard';
import ManagerProfile from './pages/manager/Profile';
import WorkspacePage from './pages/Workspace';
import OffersPage from './pages/Offers';
import DashboardTalent from './pages/DashboardTalent';
import Payments from './pages/Payments';

import api from './lib/api';

function App() {
  const [settings, setSettings] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.get('/public/settings')
      .then(res => {
        setSettings(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Sync user role from backend to handle permission updates
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          const backendRole = (res.data.role || '').toLowerCase();
          const localRole = (localStorage.getItem('role') || '').toLowerCase();
          if (backendRole && backendRole !== localRole) {
            localStorage.setItem('role', backendRole);
            // Reload to apply changes across the layout and protected routes
            window.location.reload();
          }
        })
        .catch(() => {});
    }
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center text-brand-500 font-bold">Loading Platform Engine...</div>;

  const roleRaw = localStorage.getItem('role') || '';
  const normalizedRole = roleRaw.toLowerCase().trim();
  const isAdmin = normalizedRole === 'admin';
  const isMaintenance = settings?.is_maintenance_mode === 'true' && !isAdmin;

  return (
    <ThemeProvider>
    <BrowserRouter>
      {isMaintenance ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Maintenance message={settings?.maintenance_message} />} />
        </Routes>
      ) : (
        <Routes>
        <Route path="/" element={<GuestGuard><GeoGate><Landing /></GeoGate></GuestGuard>} />
        <Route path="/campaigns" element={<PublicCampaigns />} />
        <Route path="/managers" element={<PublicManagers />} />
        <Route path="/creators" element={<Navigate to="/talent" replace />} />
        <Route path="/legal/terms" element={<Terms />} />
        <Route path="/legal/privacy" element={<Privacy />} />
        <Route path="/talent" element={<TalentNetwork />} />
        <Route path="/login" element={<GuestGuard><Login /></GuestGuard>} />
        <Route path="/register" element={<GuestGuard><Register /></GuestGuard>} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<DashboardRouter />} />
          <Route path="campaigns" element={<CampaignsRouter />} />
          <Route path="applications" element={<ApplicationsRouter />} />
          <Route path="profile" element={<ProfileRouter />} />
          <Route path="users" element={<UsersRouter />} />
          <Route path="roles" element={<RolesRouter />} />
          <Route path="telegram" element={<TelegramRouter />} />
          <Route path="messages" element={<Messages />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="ai" element={<AiRouter />} />
          <Route path="payouts" element={<PayoutsRouter />} />
          <Route path="site-control" element={<SiteControlRouter />} />
          <Route path="support" element={<SupportRouter />} />
          <Route path="follower-claims" element={<FollowerClaimsRouter />} />
          <Route path="invitations" element={<Invitations />} />
          <Route path="my-team" element={<MyTeam />} />
          <Route path="contracts" element={<ContractsPage />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="offers" element={<OffersPage />} />
          <Route path="talent" element={<DashboardTalent />} />
          <Route path="payments" element={<Payments />} />
        </Route>
        {/* Market landing pages — /et, /ng, … (validated against /api/markets) */}
        <Route path="/:marketCode" element={<MarketPage />} />
        </Routes>
      )}
    </BrowserRouter>
    </ThemeProvider>
  );
}

const DashboardRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'support') return <AdminSupport />;
  if (role === 'finance') return <AdminPayouts />;
  if (role === 'brand') return <BrandDashboard />;
  if (role === 'manager') return <ManagerDashboard />;
  return <CreatorDashboard />;
};

const CampaignsRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'admin') return <AdminCampaigns />;
  if (role === 'brand') return <BrandCampaigns />;
  return <CreatorApplications />;
};

const ApplicationsRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'admin') return <AdminApplications />;
  if (role === 'brand') return <BrandApplications />;
  return <div className="text-center p-10 text-slate-500">Not available for this role.</div>;
};

const ProfileRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'brand') return <BrandProfile />;
  if (role === 'manager') return <ManagerProfile />;
  if (role === 'admin' || role === 'support' || role === 'finance') return <AdminProfile />;
  return <CreatorProfile />;
};

const FollowerClaimsRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'admin' || role === 'support') return <AdminFollowerClaims />;
  return <div className="text-center p-10 text-slate-500">Not available for this role.</div>;
};

const UsersRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'admin') return <AdminUsers />;
  return <div className="text-center p-10 text-slate-500 font-bold uppercase tracking-widest text-sm">Not available for this role.</div>;
};

const PayoutsRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'admin' || role === 'finance') return <AdminPayouts />;
  return <div className="text-center p-10 text-slate-500 font-bold uppercase tracking-widest text-sm">Not available for this role.</div>;
};

const SiteControlRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'admin') return <SiteSettings />;
  return <div className="text-center p-10 text-slate-500 font-bold uppercase tracking-widest text-sm">Not available for this role.</div>;
};

const SupportRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'admin' || role === 'support') return <AdminSupport />;
  return <div className="text-center p-10 text-slate-500 font-bold uppercase tracking-widest text-sm">Not available for this role.</div>;
};

const RolesRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'admin') return <AdminRoles />;
  return <div className="text-center p-10 text-slate-500 font-bold uppercase tracking-widest text-sm">Not available for this role.</div>;
};

const TelegramRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'admin') return <TelegramStudio />;
  return <div className="text-center p-10 text-slate-500 font-bold uppercase tracking-widest text-sm">Not available for this role.</div>;
};

const AiRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'support' || role === 'finance') {
    return <div className="text-center p-10 text-slate-500 font-bold uppercase tracking-widest text-sm">Not available for this role.</div>;
  }
  return <AiHub />;
};

export default App;