import React from 'react';
import { AppLayout } from '@heroui-pro/react';
import { useNavigate } from 'react-router-dom';

/**
 * AppShell — the canonical dashboard chrome for every role.
 *
 * Wraps HeroUI Pro's <AppLayout> with the defaults locked in per the
 * design-taste rules:
 *   - sidebarVariant="sidebar"  → bg matches page, subtle right border
 *   - sidebarSide="left"
 *   - sidebarCollapsible="icon" → icon-rail on desktop, off-canvas on mobile
 *   - scrollMode="content"      → sticky navbar, only main scrolls
 *   - navigate wired to react-router so internal HeroUI nav uses SPA routing
 *
 * Usage:
 *   <AppShell sidebar={<RoleSidebar/>} navbar={<TopBar/>}>
 *     <PageHeader title="Dashboard" />
 *     ...main content...
 *   </AppShell>
 */
interface AppShellProps {
  sidebar: React.ReactNode;
  navbar: React.ReactNode;
  toolbar?: React.ReactNode;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  sidebar,
  navbar,
  toolbar,
  aside,
  footer,
  children,
}) => {
  const navigate = useNavigate();

  return (
    <AppLayout
      sidebar={sidebar}
      navbar={navbar}
      toolbar={toolbar}
      aside={aside}
      footer={footer}
      sidebarVariant="sidebar"
      sidebarSide="left"
      sidebarCollapsible="icon"
      scrollMode="content"
      navigate={(path) => navigate(path)}
    >
      {children}
    </AppLayout>
  );
};

export default AppShell;
