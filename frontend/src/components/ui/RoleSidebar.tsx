import React, { useEffect, useState } from 'react';
import { Sidebar } from '@heroui-pro/react';
import { Avatar, Button, Dropdown } from '@heroui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Users, MessageSquare, BarChart3, Sparkles,
  User, LogOut, Settings, DollarSign, FileText,
  Headphones, Mail, Shield, Star, ClipboardList, ShoppingBag,
  Wallet, UserCog, ChevronsUpDown, type LucideIcon,
} from 'lucide-react';
import api from '../../lib/api';
import { BrandLogo } from './BrandLogo';

/**
 * RoleSidebar
 * ───────────
 * Renders the left rail for any role. Per the design-taste rules:
 *   - App branding (BrandLogo) lives in Sidebar.Header
 *   - Nav grouped with Sidebar.GroupLabel (no dividers between groups)
 *   - User identity (avatar + email + dropdown) in Sidebar.Footer
 *   - Selected state via Sidebar.MenuItem isCurrent
 *
 * Role is read from localStorage at login. Profile name/avatar are fetched
 * lazily, mirroring the legacy UserNav behavior.
 */

type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  creator: [
    {
      label: 'Workspace',
      items: [
        { name: 'Overview',     path: '/dashboard',                 icon: LayoutDashboard, end: true },
        { name: 'Invitations',  path: '/dashboard/invitations',     icon: Mail },
        { name: 'Campaigns',    path: '/dashboard/campaigns',       icon: Briefcase },
        { name: 'Contracts',    path: '/dashboard/contracts',       icon: FileText },
        { name: 'Workspace',    path: '/dashboard/workspace',       icon: ClipboardList },
        { name: 'Offers',       path: '/dashboard/offers',          icon: ShoppingBag },
      ],
    },
    {
      label: 'Earnings',
      items: [
        { name: 'Payments',     path: '/dashboard/payments',        icon: DollarSign },
      ],
    },
    {
      label: 'Communication',
      items: [
        { name: 'Messages',     path: '/dashboard/messages',        icon: MessageSquare },
        { name: 'AI Studio',    path: '/dashboard/ai',              icon: Sparkles },
      ],
    },
  ],

  brand: [
    {
      label: 'Workspace',
      items: [
        { name: 'Overview',     path: '/dashboard',                 icon: LayoutDashboard, end: true },
        { name: 'Campaigns',    path: '/dashboard/campaigns',       icon: Briefcase },
        { name: 'Applications', path: '/dashboard/applications',    icon: Users },
        { name: 'Contracts',    path: '/dashboard/contracts',       icon: FileText },
        { name: 'Workspace',    path: '/dashboard/workspace',       icon: ClipboardList },
        { name: 'Offers',       path: '/dashboard/offers',          icon: ShoppingBag },
      ],
    },
    {
      label: 'Insights',
      items: [
        { name: 'Talent',       path: '/dashboard/talent',          icon: Star },
        { name: 'Analytics',    path: '/dashboard/analytics',       icon: BarChart3 },
        { name: 'AI Studio',    path: '/dashboard/ai',              icon: Sparkles },
      ],
    },
    {
      label: 'Operations',
      items: [
        { name: 'My Team',      path: '/dashboard/my-team',         icon: Shield },
        { name: 'Payments',     path: '/dashboard/payments',        icon: DollarSign },
        { name: 'Messages',     path: '/dashboard/messages',        icon: MessageSquare },
      ],
    },
  ],

  manager: [
    {
      label: 'Workspace',
      items: [
        { name: 'Overview',     path: '/dashboard',                 icon: LayoutDashboard, end: true },
        { name: 'Invitations',  path: '/dashboard/invitations',     icon: Mail },
        { name: 'Talent',       path: '/dashboard/talent',          icon: Star },
        { name: 'Contracts',    path: '/dashboard/contracts',       icon: FileText },
        { name: 'Workspace',    path: '/dashboard/workspace',       icon: ClipboardList },
        { name: 'Offers',       path: '/dashboard/offers',          icon: ShoppingBag },
      ],
    },
    {
      label: 'Earnings',
      items: [
        { name: 'Payments',     path: '/dashboard/payments',        icon: DollarSign },
      ],
    },
    {
      label: 'Communication',
      items: [
        { name: 'Messages',     path: '/dashboard/messages',        icon: MessageSquare },
        { name: 'AI Studio',    path: '/dashboard/ai',              icon: Sparkles },
      ],
    },
  ],

  admin: [
    {
      label: 'Platform',
      items: [
        { name: 'Overview',     path: '/dashboard',                 icon: LayoutDashboard, end: true },
        { name: 'Users',        path: '/dashboard/users',           icon: Users },
        { name: 'Campaigns',    path: '/dashboard/campaigns',       icon: Briefcase },
        { name: 'Applications', path: '/dashboard/applications',    icon: FileText },
        { name: 'Talent',       path: '/dashboard/talent',          icon: Star },
        { name: 'Marketplace',  path: '/dashboard/offers',          icon: ShoppingBag },
      ],
    },
    {
      label: 'Trust & Safety',
      items: [
        { name: 'Support',      path: '/dashboard/support',         icon: Headphones },
        { name: 'Contracts',    path: '/dashboard/contracts',       icon: Shield },
      ],
    },
    {
      label: 'Finance',
      items: [
        { name: 'Payouts',      path: '/dashboard/payouts',         icon: Wallet },
      ],
    },
    {
      label: 'Insights',
      items: [
        { name: 'Analytics',    path: '/dashboard/analytics',       icon: BarChart3 },
        { name: 'AI Studio',    path: '/dashboard/ai',              icon: Sparkles },
      ],
    },
    {
      label: 'System',
      items: [
        { name: 'Roles',        path: '/dashboard/roles',           icon: UserCog },
        { name: 'Site Control', path: '/dashboard/site-control',    icon: Settings },
        { name: 'Telegram',     path: '/dashboard/telegram',        icon: MessageSquare },
      ],
    },
  ],

  support: [
    {
      label: 'Workspace',
      items: [
        { name: 'Overview',     path: '/dashboard',                 icon: LayoutDashboard, end: true },
        { name: 'Verification', path: '/dashboard/support',         icon: Headphones },
      ],
    },
  ],

  finance: [
    {
      label: 'Workspace',
      items: [
        { name: 'Overview',     path: '/dashboard',                 icon: LayoutDashboard, end: true },
        { name: 'Payouts',      path: '/dashboard/payouts',         icon: Wallet },
      ],
    },
  ],
};

type UserInfo = {
  email?: string;
  displayName?: string;
  avatarUrl?: string;
};

function useUserInfo(role: string): UserInfo {
  const [info, setInfo] = useState<UserInfo>({});

  useEffect(() => {
    let cancelled = false;

    api.get('/auth/me').then((res) => {
      if (cancelled || !res.data) return;
      setInfo((prev) => ({ ...prev, email: res.data.email }));
    }).catch(() => { /* unauthenticated; fall back to empty */ });

    const profileUrl =
      role === 'brand'   ? '/brands/profile'    :
      role === 'manager' ? '/managers/profile'  :
      role === 'creator' ? '/creators/profile'  :
      null;

    if (profileUrl) {
      api.get(profileUrl).then((res) => {
        if (cancelled || !res.data) return;
        setInfo((prev) => ({
          ...prev,
          displayName: res.data.company_name || res.data.full_name || res.data.username || prev.displayName,
          avatarUrl: res.data.logo_url || res.data.avatar_url || prev.avatarUrl,
        }));
      }).catch(() => {});
    }

    return () => { cancelled = true; };
  }, [role]);

  return info;
}

export const RoleSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const role = (localStorage.getItem('role') || 'creator').toLowerCase().trim();
  const groups = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.creator;
  const user = useUserInfo(role);

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const initials = (user.displayName || user.email || 'U')
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <Sidebar>
      <Sidebar.Header>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex items-center px-2 py-1.5 rounded-lg hover:bg-surface-secondary transition-colors cursor-[var(--cursor-interactive)]"
          aria-label="Go to dashboard"
        >
          <BrandLogo size="md" />
        </button>
      </Sidebar.Header>

      <Sidebar.Content>
        {groups.map((group) => (
          <Sidebar.Group key={group.label}>
            <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Sidebar.MenuItem
                    key={item.path}
                    href={item.path}
                    isCurrent={isActive(item.path, item.end)}
                    tooltip={item.name}
                  >
                    <Sidebar.MenuIcon><Icon size={18} /></Sidebar.MenuIcon>
                    <Sidebar.MenuLabel>{item.name}</Sidebar.MenuLabel>
                  </Sidebar.MenuItem>
                );
              })}
            </Sidebar.Menu>
          </Sidebar.Group>
        ))}
      </Sidebar.Content>

      <Sidebar.Footer>
        <Dropdown>
          <Dropdown.Trigger>
            <Button
              variant="ghost"
              className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-surface-secondary justify-start"
            >
              <Avatar size="sm">
                {user.avatarUrl ? <Avatar.Image src={user.avatarUrl} /> : null}
                <Avatar.Fallback>{initials}</Avatar.Fallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-semibold text-foreground truncate">
                  {user.displayName || user.email?.split('@')[0] || 'Account'}
                </div>
                <div className="text-xs text-muted truncate capitalize">{role}</div>
              </div>
              <ChevronsUpDown size={14} className="text-muted shrink-0" />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Popover>
            <Dropdown.Menu>
              <Dropdown.Item onAction={() => navigate('/dashboard/profile')}>
                <User size={16} /> Profile
              </Dropdown.Item>
              <Dropdown.Item onAction={() => navigate('/dashboard/site-control')}>
                <Settings size={16} /> Settings
              </Dropdown.Item>
              <Dropdown.Item onAction={handleLogout}>
                <LogOut size={16} /> Sign out
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </Sidebar.Footer>
    </Sidebar>
  );
};

export default RoleSidebar;
