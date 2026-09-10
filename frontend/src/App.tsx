import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthGuard from './guards/AuthGuard';
import Landing from './pages/landing';
import GeoGate from './components/common/GeoGate';
import Maintenance from './pages/Maintenance';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import NotFound from './pages/NotFound';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

/* Everything behind login (and the heavier public directories) is
   code-split so a first-time visitor downloads the landing page, not the
   admin console. Vite emits one chunk per import() below. */
const Layout = React.lazy(() => import('./components/layout/Layout'));
const CreatorDashboard = React.lazy(() => import('./pages/creator/Dashboard'));
const CreatorProfile = React.lazy(() => import('./pages/creator/Profile'));
const CreatorOnboarding = React.lazy(() => import('./pages/creator/Onboarding'));
const BrandDashboard = React.lazy(() => import('./pages/brand/Dashboard'));
const ManagerCampaigns = React.lazy(() => import('./pages/manager/Campaigns'));
const BrandProfile = React.lazy(() => import('./pages/brand/Profile'));
const AdminDashboard = React.lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = React.lazy(() => import('./pages/admin/Users'));
const AdminRoles = React.lazy(() => import('./pages/admin/Roles'));
const AdminCampaigns = React.lazy(() => import('./pages/admin/Campaigns'));
const AdminApplications = React.lazy(() => import('./pages/admin/Applications'));
const AdminPayouts = React.lazy(() => import('./pages/admin/Payouts'));
const AdminProfile = React.lazy(() => import('./pages/admin/Profile'));
const SiteSettings = React.lazy(() => import('./pages/admin/SiteSettings'));
const AdminSupport = React.lazy(() => import('./pages/admin/Support'));
const AdminFollowerClaims = React.lazy(() => import('./pages/admin/FollowerClaims'));
const TelegramStudio = React.lazy(() => import('./pages/admin/TelegramStudio'));
const BrandCampaigns = React.lazy(() => import('./pages/brand/Campaigns'));
const BrandApplications = React.lazy(() => import('./pages/brand/Applications'));
const CreatorApplications = React.lazy(() => import('./pages/creator/Applications'));
const PublicCampaigns = React.lazy(() => import('./pages/PublicCampaigns'));
const Terms = React.lazy(() => import('./pages/legal/Terms'));
const Privacy = React.lazy(() => import('./pages/legal/Privacy'));
const MarketPage = React.lazy(() => import('./pages/markets/MarketPage'));
const PublicManagers = React.lazy(() => import('./pages/PublicManagers'));
const TalentNetwork = React.lazy(() => import('./pages/TalentNetwork'));
const Messages = React.lazy(() => import('./pages/Messages'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const AiHub = React.lazy(() => import('./pages/AiHub'));
const Invitations = React.lazy(() => import('./pages/Invitations'));
const MyTeam = React.lazy(() => import('./pages/MyTeam'));
const ContractsPage = React.lazy(() => import('./pages/Contracts'));
const ManagerDashboard = React.lazy(() => import('./pages/manager/Dashboard'));
const ManagerProfile = React.lazy(() => import('./pages/manager/Profile'));
const WorkspacePage = React.lazy(() => import('./pages/Workspace'));
const OffersPage = React.lazy(() => import('./pages/Offers'));
const DashboardTalent = React.lazy(() => import('./pages/DashboardTalent'));
const Payments = React.lazy(() => import('./pages/Payments'));

const GuestGuard = ({ children }: { children: React.ReactNode }) => {
  if (localStorage.getItem('token')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};



import api from './lib/api';
import { CookieBanner } from './components/common/CookieBanner';
import { trackPageView } from './lib/analytics';

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
      <RouteTracker />
      <CookieBanner />
      <React.Suspense fallback={<RouteFallback />}>
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
        <Route path="/forgot-password" element={<GuestGuard><ForgotPassword /></GuestGuard>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* A creator's first session — no sidebar, four steps, then home. */}
        <Route path="/onboarding" element={<AuthGuard><CreatorOnboarding /></AuthGuard>} />

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
        <Route path="*" element={<NotFound />} />
        </Routes>
      )}
      </React.Suspense>
    </BrowserRouter>
    </ThemeProvider>
  );
}

/** Shown for the few hundred ms while a lazy route chunk downloads. */
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center v-bg-dawn-subtle" aria-busy="true">
    <span className="v-story-ring" style={{ padding: 3 }}>
      <img src="/logo.png" alt="" className="h-10 w-10 object-contain" />
    </span>
  </div>
);

/** Pushes a GTM page_view on every client-side navigation (see lib/analytics). */
const RouteTracker = () => {
  const location = useLocation();
  React.useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
};

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
  if (role === 'manager') return <ManagerCampaigns />;
  return <CreatorApplications />;
};

const ApplicationsRouter = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  if (role === 'admin') return <AdminApplications />;
  // A manager reviews applicants on the campaigns their engagement covers.
  if (role === 'brand' || role === 'manager') return <BrandApplications />;
  if (role === 'creator') return <CreatorApplications initialTab="applications" />;
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
  // AI Studio is switched off for creators for now — no nav entry, and deep links go home.
  if (role === 'creator') return <Navigate to="/dashboard" replace />;
  return <AiHub />;
};

export default App;