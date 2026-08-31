import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart2,
  Bell,
  Brain,
  Briefcase,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  Headphones,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Settings,
  Shield,
  ShoppingBag,
  Star,
  User,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Breadcrumbs,
  Button,
  Dropdown,
  Label,
  Separator,
} from '@heroui/react';
import { AppLayout, Navbar, Sidebar } from '@heroui-pro/react';
import api from '../../lib/api';
import OnboardingWizard from '../OnboardingWizard';
import { NotificationsDropdown } from './NotificationsDropdown';

/**
 * Layout — Campgains Hub authenticated workspace shell.
 *
 * HeroUI Pro AppLayout + Sidebar + Navbar. Role-based navigation tree
 * (Creator / Brand / Manager / Admin / Support / Finance) lives in one
 * `NAV_BY_ROLE` map. Active menu item is computed from the React Router
 * location so the sidebar tracks deep-link navigation correctly.
 *
 * The verification block (account_status !== "active"), OnboardingWizard,
 * loading state and logout flow are preserved verbatim from the prior
 * implementation; only the chrome is swapped to design-system components.
 */
type NavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  end?: boolean;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const ROLE_LABEL: Record<string, string> = {
  creator: 'Creator',
  brand: 'Brand',
  manager: 'Manager',
  admin: 'Admin',
  support: 'Support',
  finance: 'Finance',
};

/* ── Role-based nav, grouped for the sidebar ────────────────────── */
const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  creator: [
    {
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
        { label: 'Campaigns', path: '/dashboard/campaigns', icon: Briefcase },
        { label: 'Invitations', path: '/dashboard/invitations', icon: Mail },
        { label: 'Workspace', path: '/dashboard/workspace', icon: ClipboardList },
        { label: 'Offers', path: '/dashboard/offers', icon: ShoppingBag },
      ],
    },
    {
      label: 'Money',
      items: [
        { label: 'Contracts', path: '/dashboard/contracts', icon: FileText },
        { label: 'Payments', path: '/dashboard/payments', icon: DollarSign },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Messages', path: '/dashboard/messages', icon: MessageSquare },
        { label: 'AI Studio', path: '/dashboard/ai', icon: Brain },
        { label: 'Profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
  brand: [
    {
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
        { label: 'Campaigns', path: '/dashboard/campaigns', icon: Briefcase },
        { label: 'Applications', path: '/dashboard/applications', icon: Users },
        { label: 'My Team', path: '/dashboard/my-team', icon: Shield },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Workspace', path: '/dashboard/workspace', icon: ClipboardList },
        { label: 'Offers', path: '/dashboard/offers', icon: ShoppingBag },
        { label: 'Contracts', path: '/dashboard/contracts', icon: FileText },
        { label: 'Payments', path: '/dashboard/payments', icon: DollarSign },
        { label: 'Talent', path: '/dashboard/talent', icon: Star },
      ],
    },
    {
      label: 'Insights',
      items: [
        { label: 'Messages', path: '/dashboard/messages', icon: MessageSquare },
        { label: 'Analytics', path: '/dashboard/analytics', icon: BarChart2 },
        { label: 'AI Studio', path: '/dashboard/ai', icon: Brain },
        { label: 'Profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
  manager: [
    {
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
        { label: 'Invitations', path: '/dashboard/invitations', icon: Mail },
        { label: 'Workspace', path: '/dashboard/workspace', icon: ClipboardList },
        { label: 'Offers', path: '/dashboard/offers', icon: ShoppingBag },
        { label: 'Talent', path: '/dashboard/talent', icon: Star },
      ],
    },
    {
      label: 'Money',
      items: [
        { label: 'Contracts', path: '/dashboard/contracts', icon: FileText },
        { label: 'Payments', path: '/dashboard/payments', icon: DollarSign },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Messages', path: '/dashboard/messages', icon: MessageSquare },
        { label: 'AI Studio', path: '/dashboard/ai', icon: Brain },
        { label: 'Profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
  admin: [
    {
      items: [
        { label: 'Overview', path: '/dashboard', icon: LayoutDashboard, end: true },
        { label: 'Users', path: '/dashboard/users', icon: Users },
        { label: 'Campaigns', path: '/dashboard/campaigns', icon: Briefcase },
        { label: 'Applications', path: '/dashboard/applications', icon: FileText },
      ],
    },
    {
      label: 'Money',
      items: [
        { label: 'Payouts', path: '/dashboard/payouts', icon: DollarSign },
        { label: 'Contracts', path: '/dashboard/contracts', icon: Shield },
        { label: 'Marketplace', path: '/dashboard/offers', icon: ShoppingBag },
        { label: 'Talent', path: '/dashboard/talent', icon: Star },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Support', path: '/dashboard/support', icon: Headphones },
        { label: 'Site Control', path: '/dashboard/site-control', icon: Settings },
        { label: 'Telegram', path: '/dashboard/telegram', icon: MessageSquare },
        { label: 'Analytics', path: '/dashboard/analytics', icon: BarChart2 },
        { label: 'AI Studio', path: '/dashboard/ai', icon: Brain },
        { label: 'Profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
  support: [
    {
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
        { label: 'Verification', path: '/dashboard/support', icon: Headphones },
        { label: 'Profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
  finance: [
    {
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
        { label: 'Payouts', path: '/dashboard/payouts', icon: DollarSign },
        { label: 'Profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
};

/* ── Resolve the active item from a path ────────────────────────── */
const flattenGroups = (groups: NavGroup[]): NavItem[] =>
  groups.flatMap((g) => g.items);

const findActiveItem = (groups: NavGroup[], pathname: string): NavItem | null => {
  const items = flattenGroups(groups);
  /* Match the most specific (longest) matching path so /dashboard/payments
     wins over /dashboard for end:false items. */
  let best: NavItem | null = null;
  for (const it of items) {
    if (it.end) {
      if (pathname === it.path) return it;
    } else if (pathname.startsWith(it.path)) {
      if (!best || it.path.length > best.path.length) best = it;
    }
  }
  return best;
};

/* ── Sidebar (desktop + mobile mirror) ──────────────────────────── */
interface DashboardSidebarProps {
  groups: NavGroup[];
  role: string;
  pathname: string;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ groups, role, pathname }) => {
  const active = findActiveItem(groups, pathname);
  const activeId = active?.path;

  const renderMenu = (g: NavGroup, ariaLabel: string) => (
    <Sidebar.Menu aria-label={ariaLabel}>
      {g.items.map((item) => {
        const Icon = item.icon;
        return (
          <Sidebar.MenuItem
            key={item.path}
            id={item.path}
            href={item.path}
            isCurrent={activeId === item.path}
            textValue={item.label}
          >
            <Sidebar.MenuIcon>
              <Icon className="size-4" />
            </Sidebar.MenuIcon>
            <Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
          </Sidebar.MenuItem>
        );
      })}
    </Sidebar.Menu>
  );

  const renderGroups = (target: 'desktop' | 'mobile') =>
    groups.map((g, i) => (
      <React.Fragment key={`${target}-g${i}`}>
        {i > 0 && <Sidebar.Separator />}
        <Sidebar.Group>
          {g.label && <Sidebar.GroupLabel>{g.label}</Sidebar.GroupLabel>}
          {renderMenu(g, g.label || `Section ${i + 1}`)}
        </Sidebar.Group>
      </React.Fragment>
    ));

  const brand = (
    <div className="flex items-center gap-2.5 px-1 py-2">
      <img
        src="/logo.png"
        alt="Campgains Hub"
        className="h-7 w-7 object-contain shrink-0"
      />
      <div className="min-w-0 flex flex-col" data-sidebar="label">
        <span
          className="text-foreground text-sm font-semibold leading-tight truncate"
          style={{ letterSpacing: '-0.012em' }}
        >
          Campgains Hub
        </span>
        <span className="text-muted text-[11px] leading-tight capitalize truncate">
          {ROLE_LABEL[role] || 'Workspace'}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <Sidebar>
        <Sidebar.Header>{brand}</Sidebar.Header>
        <Sidebar.Content>{renderGroups('desktop')}</Sidebar.Content>
        <Sidebar.Rail />
      </Sidebar>

      <Sidebar.Mobile>
        <Sidebar.Header>{brand}</Sidebar.Header>
        <Sidebar.Content>{renderGroups('mobile')}</Sidebar.Content>
      </Sidebar.Mobile>
    </>
  );
};

/* ── Navbar (breadcrumbs + notifications + user dropdown) ───────── */
interface DashboardNavbarProps {
  pageLabel: string;
  user: any;
  profileImg: string | null;
  profileName: string | null;
  role: string;
  onLogout: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

const DashboardNavbar: React.FC<DashboardNavbarProps> = ({
  pageLabel,
  user,
  profileImg,
  profileName,
  role,
  onLogout,
  onProfile,
  onSettings,
}) => {
  const displayName =
    profileName || user?.display_name || user?.email?.split('@')[0] || ROLE_LABEL[role] || 'User';
  const initials = (displayName || 'U')
    .split(/\s+/)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() || '')
    .join('');

  return (
    <Navbar maxWidth="full">
      <Navbar.Header>
        <AppLayout.MenuToggle />
        <Sidebar.Trigger />

        <Breadcrumbs className="min-w-0">
          <Breadcrumbs.Item href="/dashboard" className="text-muted min-w-0">
            <span className="flex items-center gap-2">
              <Home className="size-3.5" />
              <span className="hidden sm:inline">Home</span>
            </span>
          </Breadcrumbs.Item>
          <Breadcrumbs.Item className="font-semibold min-w-0">
            <span className="truncate">{pageLabel}</span>
          </Breadcrumbs.Item>
        </Breadcrumbs>

        <Navbar.Spacer />

        <Navbar.Content className="gap-1">
          {/* Existing notifications dropdown — preserved as-is */}
          <NotificationsDropdown scrolled />

          <Navbar.Separator />

          <Dropdown>
            <Dropdown.Trigger>
              <Button
                isIconOnly
                aria-label="Account menu"
                variant="ghost"
                size="sm"
                className="!rounded-full"
              >
                <Avatar className="size-7">
                  {profileImg && (
                    <Avatar.Image alt={displayName} src={profileImg} />
                  )}
                  <Avatar.Fallback>{initials || 'U'}</Avatar.Fallback>
                </Avatar>
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover className="min-w-[240px]" placement="bottom end">
              <div className="px-3 py-3 flex items-center gap-3">
                <Avatar className="size-9 shrink-0">
                  {profileImg && (
                    <Avatar.Image alt={displayName} src={profileImg} />
                  )}
                  <Avatar.Fallback>{initials || 'U'}</Avatar.Fallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-foreground text-sm font-semibold truncate">
                    {displayName}
                  </div>
                  <div className="text-muted text-xs truncate">
                    {user?.email || `Signed in as ${ROLE_LABEL[role] || role}`}
                  </div>
                </div>
              </div>
              <Separator />
              <Dropdown.Menu>
                <Dropdown.Item
                  id="profile"
                  textValue="Profile"
                  onAction={onProfile}
                >
                  <User className="text-muted size-4" />
                  <Label>Profile</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  id="settings"
                  textValue="Settings"
                  onAction={onSettings}
                >
                  <Settings className="text-muted size-4" />
                  <Label>Settings</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  id="sign-out"
                  textValue="Sign out"
                  onAction={onLogout}
                >
                  <LogOut className="text-muted size-4" />
                  <Label>Sign out</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </Navbar.Content>
      </Navbar.Header>
    </Navbar>
  );
};

/* ── KYC banner (non-blocking) ─────────────────────────────────────
 * Shown above the dashboard when an admin has flagged the user as needing
 * KYC verification but they haven't approved-status yet. Replaces the old
 * full-screen VerificationGate that locked users out at login.
 */
const KycBanner: React.FC<{ status: 'pending' | 'submitted' }> = ({ status }) => (
  <Link
    to="/dashboard/profile"
    className="block bg-warning-soft border-b border-warning/40 px-4 sm:px-6 py-2.5 text-warning-soft-foreground text-sm font-medium hover:bg-warning-soft/70 transition-colors"
  >
    <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
      <FileText size={15} className="shrink-0" />
      <span>
        {status === 'submitted' ? (
          <>
            <strong>Verification under review.</strong> Our team is reviewing
            your KYC submission — you'll hear back within 1–2 business days.
          </>
        ) : (
          <>
            <strong>Verify your identity.</strong> An admin has asked you to
            complete KYC. Open your profile to upload ID and a verification
            video — you can keep using the platform meanwhile.
          </>
        )}
      </span>
      <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold underline">
        Open profile <ChevronRight className="size-3.5" />
      </span>
    </div>
  </Link>
);

/* ── Layout (root) ──────────────────────────────────────────────── */
const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  const groups = NAV_BY_ROLE[role] || NAV_BY_ROLE.creator;

  const [user, setUser] = useState<any>(null);
  const [profileImg, setProfileImg] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  /* Fetch /auth/me */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoadingUser(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data);
        setLoadingUser(false);
      })
      .catch(() => setLoadingUser(false));
  }, []);

  /* Fetch role profile for avatar + display name */
  useEffect(() => {
    if (!user) return;
    const tryFetch = async (url: string, picker: (d: any) => { img?: string; name?: string }) => {
      try {
        const res = await api.get(url);
        const { img, name } = picker(res.data || {});
        if (img) setProfileImg(img);
        if (name) setProfileName(name);
      } catch {}
    };
    if (role === 'creator') {
      tryFetch('/creators/profile', (d) => ({
        img: d.avatar_url,
        name: d.full_name,
      }));
    } else if (role === 'brand') {
      tryFetch('/brands/profile', (d) => ({
        img: d.logo_url,
        name: d.company_name,
      }));
    } else if (role === 'manager') {
      tryFetch('/managers/profile', (d) => ({
        img: d.avatar_url,
        name: d.full_name,
      }));
    }
  }, [role, user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  if (loadingUser) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-surface-50">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-sm font-semibold text-surface-500">Loading your workspace…</p>
      </div>
    );
  }

  // Determine whether to show the KYC banner. Banner appears only for
  // creator/brand/manager when admin has flagged kyc_required and the user
  // hasn't been approved yet. Submitting KYC flips kyc_status to 'pending'
  // (a different "pending" — the submission is in review).
  const showKycBanner =
    user &&
    user.kyc_required === true &&
    user.kyc_status !== 'approved' &&
    !['admin', 'support', 'finance'].includes(role);
  // If they've already submitted, show a different "under review" message
  // vs. the initial "please verify" prompt. `has_kyc_submission` is added
  // by the /auth/me endpoint.
  const kycBannerStatus: 'pending' | 'submitted' =
    user?.has_kyc_submission ? 'submitted' : 'pending';

  const activeItem = findActiveItem(groups, location.pathname);
  const pageLabel = activeItem?.label || 'Dashboard';

  return (
    <>
      <AppLayout
        navigate={(href) => navigate(href)}
        sidebar={
          <DashboardSidebar
            groups={groups}
            role={role}
            pathname={location.pathname}
          />
        }
        navbar={
          <DashboardNavbar
            pageLabel={pageLabel}
            user={user}
            profileImg={profileImg}
            profileName={profileName}
            role={role}
            onLogout={handleLogout}
            onProfile={() => navigate('/dashboard/profile')}
            onSettings={() =>
              navigate(
                role === 'admin'
                  ? '/dashboard/site-control'
                  : '/dashboard/profile'
              )
            }
          />
        }
      >
        {/* Non-blocking KYC banner — only when admin has flagged the user. */}
        {showKycBanner && <KycBanner status={kycBannerStatus} />}
        {/* The page itself is responsible for its own max-width via PageShell. */}
        <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
          <Outlet />
        </div>
      </AppLayout>

      <OnboardingWizard />
    </>
  );
};

export default Layout;
