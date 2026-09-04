import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  BarChart2,
  Brain,
  Briefcase,
  ChevronRight,
  ClipboardList,
  DollarSign,
  ExternalLink,
  FileText,
  Globe,
  Headphones,
  KeyRound,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  User,
  Users,
} from 'lucide-react';
import { Avatar, Breadcrumbs, Dropdown, Label, Separator } from '@heroui/react';
import { AppLayout, Navbar, Sidebar } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { SUPPORTED_LANGUAGES, setLanguage } from '../../i18n';
import OnboardingWizard from '../OnboardingWizard';
import { BrandLogo, LogoMark, Wordmark } from '../ui/BrandLogo';
import { accentFor } from '../../pages/talent/shared';
import { NotificationsDropdown } from './NotificationsDropdown';
import { ToastHost } from '../common/ToastHost';

/**
 * Layout — Campgains Hub authenticated workspace shell.
 *
 * HeroUI Pro AppLayout + Sidebar + Navbar wearing the same design system
 * as the public site (scope class on <body>): gradient-washed rail, a
 * signature-gradient indicator on the current item, a role-specific promo
 * tile in the sidebar footer, and a glassy top bar with language switch,
 * "view site", notifications and the account menu.
 *
 * Role-based navigation lives in one `NAV_BY_ROLE` map (labels are i18n
 * keys under `side.*`). Active item is computed from the router location
 * so the rail tracks deep links. The KYC banner, OnboardingWizard, loading
 * state and logout flow are unchanged.
 */
type NavItem = {
  key: string;
  path: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  end?: boolean;
};

type NavGroup = {
  key?: string;
  items: NavItem[];
};

const ROLE_KEY: Record<string, string> = {
  creator: 'side.roleCreator',
  brand: 'side.roleBrand',
  manager: 'side.roleManager',
  admin: 'side.roleAdmin',
  support: 'side.roleSupport',
  finance: 'side.roleFinance',
};

/* ── Role-based nav, grouped for the sidebar ────────────────────── */
const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  creator: [
    {
      items: [
        { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
        { key: 'campaigns', path: '/dashboard/campaigns', icon: Briefcase },
        { key: 'invitations', path: '/dashboard/invitations', icon: Mail },
        { key: 'workspace', path: '/dashboard/workspace', icon: ClipboardList },
        { key: 'offers', path: '/dashboard/offers', icon: ShoppingBag },
      ],
    },
    {
      key: 'money',
      items: [
        { key: 'contracts', path: '/dashboard/contracts', icon: FileText },
        { key: 'payments', path: '/dashboard/payments', icon: DollarSign },
      ],
    },
    {
      key: 'tools',
      items: [
        { key: 'messages', path: '/dashboard/messages', icon: MessageSquare },
        { key: 'aiStudio', path: '/dashboard/ai', icon: Brain },
        { key: 'profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
  brand: [
    {
      items: [
        { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
        { key: 'campaigns', path: '/dashboard/campaigns', icon: Briefcase },
        { key: 'applications', path: '/dashboard/applications', icon: Users },
        { key: 'myTeam', path: '/dashboard/my-team', icon: Shield },
      ],
    },
    {
      key: 'operations',
      items: [
        { key: 'workspace', path: '/dashboard/workspace', icon: ClipboardList },
        { key: 'offers', path: '/dashboard/offers', icon: ShoppingBag },
        { key: 'contracts', path: '/dashboard/contracts', icon: FileText },
        { key: 'payments', path: '/dashboard/payments', icon: DollarSign },
        { key: 'talent', path: '/dashboard/talent', icon: Star },
      ],
    },
    {
      key: 'insights',
      items: [
        { key: 'messages', path: '/dashboard/messages', icon: MessageSquare },
        { key: 'analytics', path: '/dashboard/analytics', icon: BarChart2 },
        { key: 'aiStudio', path: '/dashboard/ai', icon: Brain },
        { key: 'profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
  manager: [
    {
      items: [
        { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
        { key: 'invitations', path: '/dashboard/invitations', icon: Mail },
        { key: 'workspace', path: '/dashboard/workspace', icon: ClipboardList },
        { key: 'offers', path: '/dashboard/offers', icon: ShoppingBag },
        { key: 'talent', path: '/dashboard/talent', icon: Star },
      ],
    },
    {
      key: 'money',
      items: [
        { key: 'contracts', path: '/dashboard/contracts', icon: FileText },
        { key: 'payments', path: '/dashboard/payments', icon: DollarSign },
      ],
    },
    {
      key: 'tools',
      items: [
        { key: 'messages', path: '/dashboard/messages', icon: MessageSquare },
        { key: 'aiStudio', path: '/dashboard/ai', icon: Brain },
        { key: 'profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
  admin: [
    {
      items: [
        { key: 'overview', path: '/dashboard', icon: LayoutDashboard, end: true },
        { key: 'users', path: '/dashboard/users', icon: Users },
        { key: 'campaigns', path: '/dashboard/campaigns', icon: Briefcase },
        { key: 'applications', path: '/dashboard/applications', icon: FileText },
      ],
    },
    {
      key: 'money',
      items: [
        { key: 'payouts', path: '/dashboard/payouts', icon: DollarSign },
        { key: 'contracts', path: '/dashboard/contracts', icon: Shield },
        { key: 'marketplace', path: '/dashboard/offers', icon: ShoppingBag },
        { key: 'talent', path: '/dashboard/talent', icon: Star },
      ],
    },
    {
      key: 'operations',
      items: [
        { key: 'support', path: '/dashboard/support', icon: Headphones },
        { key: 'followerClaims', path: '/dashboard/follower-claims', icon: BadgeCheck },
        { key: 'siteControl', path: '/dashboard/site-control', icon: Settings },
        { key: 'roles', path: '/dashboard/roles', icon: KeyRound },
        { key: 'telegram', path: '/dashboard/telegram', icon: MessageSquare },
        { key: 'analytics', path: '/dashboard/analytics', icon: BarChart2 },
        { key: 'aiStudio', path: '/dashboard/ai', icon: Brain },
        { key: 'profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
  support: [
    {
      items: [
        { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
        { key: 'verification', path: '/dashboard/support', icon: Headphones },
        { key: 'followerClaims', path: '/dashboard/follower-claims', icon: BadgeCheck },
        { key: 'profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
  finance: [
    {
      items: [
        { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
        { key: 'payouts', path: '/dashboard/payouts', icon: DollarSign },
        { key: 'profile', path: '/dashboard/profile', icon: User },
      ],
    },
  ],
};

/** Sidebar footer promo — the one thing each role should do next. */
const PROMO: Record<string, { title: string; cta: string; to: string; icon: React.ReactNode }> = {
  brand: { title: 'shell.promoBrandTitle', cta: 'shell.promoBrandCta', to: '/dashboard/campaigns?new=1', icon: <Sparkles size={14} /> },
  creator: { title: 'shell.promoCreatorTitle', cta: 'shell.promoCreatorCta', to: '/campaigns', icon: <Search size={14} /> },
  manager: { title: 'shell.promoManagerTitle', cta: 'shell.promoManagerCta', to: '/dashboard/talent', icon: <Star size={14} /> },
  admin: { title: 'shell.promoAdminTitle', cta: 'shell.promoAdminCta', to: '/dashboard/site-control', icon: <Settings size={14} /> },
};

/* ── Resolve the active item from a path ────────────────────────── */
const flattenGroups = (groups: NavGroup[]): NavItem[] => groups.flatMap((g) => g.items);

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
  const { t } = useTranslation();
  const active = findActiveItem(groups, pathname);
  const activeId = active?.path;
  const promo = PROMO[role];

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
            textValue={t(`side.${item.key}`)}
          >
            <Sidebar.MenuIcon>
              <Icon className="size-4" />
            </Sidebar.MenuIcon>
            <Sidebar.MenuLabel>{t(`side.${item.key}`)}</Sidebar.MenuLabel>
          </Sidebar.MenuItem>
        );
      })}
    </Sidebar.Menu>
  );

  const renderGroups = (target: 'desktop' | 'mobile') =>
    groups.map((g, i) => (
      <Sidebar.Group key={`${target}-g${i}`}>
        {g.key && <Sidebar.GroupLabel>{t(`side.${g.key}`)}</Sidebar.GroupLabel>}
        {renderMenu(g, g.key ? t(`side.${g.key}`) : `Section ${i + 1}`)}
      </Sidebar.Group>
    ));

  const brand = (
    <Link to="/dashboard" className="v-brand-lockup" aria-label={t('side.dashboard')}>
      <LogoMark size={34} />
      {/* Wordmark + role chip carry data-sidebar="label" so the collapsed
          rail keeps only the mark (HeroUI hides labelled nodes). Stacked so
          nothing competes for width with the name. */}
      <span className="v-brand-lockup__text" data-sidebar="label">
        <Wordmark font={15} className="block truncate" />
        <span className="v-role-chip">{t(ROLE_KEY[role] || 'side.roleWorkspace')}</span>
      </span>
    </Link>
  );

  const footer = promo && (
    <Link to={promo.to} className="v-promo-tile" title={t(promo.cta)}>
      <span className="v-promo-icon">{promo.icon}</span>
      <span className="min-w-0" data-sidebar="label">
        <span className="block truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>
          {t(promo.title)}
        </span>
        <span className="block truncate" style={{ fontSize: 11, opacity: 0.8 }}>
          {t(promo.cta)}
        </span>
      </span>
    </Link>
  );

  return (
    <>
      <Sidebar>
        <Sidebar.Header>{brand}</Sidebar.Header>
        <Sidebar.Content>{renderGroups('desktop')}</Sidebar.Content>
        {footer && <Sidebar.Footer>{footer}</Sidebar.Footer>}
        <Sidebar.Rail />
      </Sidebar>

      <Sidebar.Mobile>
        <Sidebar.Header>{brand}</Sidebar.Header>
        <Sidebar.Content>{renderGroups('mobile')}</Sidebar.Content>
        {footer && <Sidebar.Footer>{footer}</Sidebar.Footer>}
      </Sidebar.Mobile>
    </>
  );
};

/* ── Navbar (breadcrumbs + language + notifications + account) ──── */
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
  const { t, i18n } = useTranslation();
  const otherLang = SUPPORTED_LANGUAGES.find((l) => l.code !== i18n.language) || SUPPORTED_LANGUAGES[0];
  const displayName =
    profileName || user?.display_name || user?.email?.split('@')[0] || t(ROLE_KEY[role] || 'side.roleWorkspace');
  const initials = (displayName || 'U')
    .split(/\s+/)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() || '')
    .join('');
  const accent = accentFor(String(user?.id || displayName));

  return (
    <Navbar maxWidth="full">
      <Navbar.Header>
        <AppLayout.MenuToggle />
        <Sidebar.Trigger />

        <Breadcrumbs className="min-w-0">
          <Breadcrumbs.Item href="/dashboard" className="text-muted min-w-0">
            <span className="flex items-center gap-2">
              <Home className="size-3.5" />
              <span className="hidden sm:inline">{t('shell.home')}</span>
            </span>
          </Breadcrumbs.Item>
          <Breadcrumbs.Item className="font-medium min-w-0">
            <span className="truncate v-ink">{pageLabel}</span>
          </Breadcrumbs.Item>
        </Breadcrumbs>

        <Navbar.Spacer />

        <Navbar.Content className="gap-1.5">
          {/* Language — shows the language you'd switch TO (same as the public nav) */}
          <button
            type="button"
            onClick={() => setLanguage(otherLang.code)}
            aria-label={`Switch language to ${otherLang.label}`}
            className="v-shell-pill"
          >
            <Globe size={12} />
            {otherLang.short}
          </button>

          <Link to="/" target="_blank" rel="noreferrer" className="v-shell-pill hidden md:inline-flex" title={t('shell.viewSite')}>
            <ExternalLink size={12} />
            {t('shell.viewSite')}
          </Link>

          <NotificationsDropdown />

          <Navbar.Separator />

          <Dropdown>
            {/* Dropdown.Trigger already renders the <button>; nesting a
                Button inside it produced invalid DOM (button in button). */}
            <Dropdown.Trigger aria-label={t('shell.accountMenu')} className="v-shell-avatar">
              <span className="v-story-ring" style={{ padding: 2 }}>
                {profileImg ? (
                  <img src={profileImg} alt="" className="h-7 w-7 object-cover" />
                ) : (
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center text-[11px] font-medium text-white"
                    style={{ background: accent.from }}
                  >
                    {initials || 'U'}
                  </span>
                )}
              </span>
            </Dropdown.Trigger>
            <Dropdown.Popover className="min-w-[240px]" placement="bottom end">
              <div className="px-3 py-3 flex items-center gap-3">
                <Avatar className="size-9 shrink-0">
                  {profileImg && <Avatar.Image alt={displayName} src={profileImg} />}
                  <Avatar.Fallback>{initials || 'U'}</Avatar.Fallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-foreground text-sm font-semibold truncate">{displayName}</div>
                  <div className="text-muted text-xs truncate">
                    {user?.email || t(ROLE_KEY[role] || 'side.roleWorkspace')}
                  </div>
                </div>
              </div>
              <Separator />
              <Dropdown.Menu>
                <Dropdown.Item id="profile" textValue={t('shell.profile')} onAction={onProfile}>
                  <User className="text-muted size-4" />
                  <Label>{t('shell.profile')}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="settings" textValue={t('shell.settings')} onAction={onSettings}>
                  <Settings className="text-muted size-4" />
                  <Label>{t('shell.settings')}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="sign-out" textValue={t('shell.signOut')} onAction={onLogout}>
                  <LogOut className="text-muted size-4" />
                  <Label>{t('shell.signOut')}</Label>
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
const KycBanner: React.FC<{ status: 'pending' | 'submitted' }> = ({ status }) => {
  const { t } = useTranslation();
  return (
    <Link
      to="/dashboard/profile"
      className="block px-4 sm:px-6 py-2.5 text-sm font-medium transition-colors"
      style={{
        background: 'linear-gradient(90deg, rgba(255,181,71,0.18), rgba(255,122,69,0.12))',
        borderBottom: '1px solid rgba(255,181,71,0.45)',
        color: '#8a5a00',
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
        <FileText size={15} className="shrink-0" />
        <span>
          <strong>{status === 'submitted' ? t('shell.kycReviewTitle') : t('shell.kycPromptTitle')}</strong>{' '}
          {status === 'submitted' ? t('shell.kycReviewBody') : t('shell.kycPromptBody')}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold underline">
          {t('shell.openProfile')} <ChevronRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
};

/* ── Layout (root) ──────────────────────────────────────────────── */
const Layout: React.FC = () => {
  const { t } = useTranslation();
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

  /* Fetch role profile for avatar + display name (and refresh on save) */
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
    const load = () => {
      if (role === 'creator') {
        tryFetch('/creators/profile', (d) => ({ img: d.avatar_url, name: d.full_name }));
      } else if (role === 'brand') {
        tryFetch('/brands/profile', (d) => ({ img: d.logo_url, name: d.company_name }));
      } else if (role === 'manager') {
        tryFetch('/managers/profile', (d) => ({ img: d.avatar_url, name: d.full_name }));
      }
    };
    load();
    window.addEventListener('profileUpdated', load);
    return () => window.removeEventListener('profileUpdated', load);
  }, [role, user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  if (loadingUser) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 v-bg-dawn-subtle">
        <span className="v-story-ring" style={{ padding: 3 }}>
          <span className="inline-flex h-12 w-12 items-center justify-center bg-white">
            <BrandLogo size="sm" />
          </span>
        </span>
        <p className="v-body v-muted">{t('shell.loading')}</p>
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
  const kycBannerStatus: 'pending' | 'submitted' = user?.has_kyc_submission ? 'submitted' : 'pending';

  const activeItem = findActiveItem(groups, location.pathname);
  const pageLabel = activeItem ? t(`side.${activeItem.key}`) : t('side.dashboard');

  return (
    <>
      <AppLayout
        navigate={(href) => navigate(href)}
        sidebar={<DashboardSidebar groups={groups} role={role} pathname={location.pathname} />}
        navbar={
          <DashboardNavbar
            pageLabel={pageLabel}
            user={user}
            profileImg={profileImg}
            profileName={profileName}
            role={role}
            onLogout={handleLogout}
            onProfile={() => navigate('/dashboard/profile')}
            onSettings={() => navigate(role === 'admin' ? '/dashboard/site-control' : '/dashboard/profile')}
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
      <ToastHost />
    </>
  );
};

export default Layout;
