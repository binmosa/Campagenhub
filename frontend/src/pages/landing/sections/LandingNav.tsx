import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Globe, LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setLanguage } from '../../../i18n';
import { Avatar, Button, Dropdown, Label, Separator } from '@heroui/react';
import api from '../../../lib/api';
import { NAV_SECTIONS } from '../copy';

/**
 * LandingNav — Campgains Hub floating pill nav.
 *
 * Dark Deep-Navy pill centered on canvas. When the visitor is logged-in
 * the right cluster shows a HeroUI `Dropdown` with avatar trigger →
 * Dashboard / Profile / Sign out. Otherwise it shows Login + Get started.
 */
export const LandingNav: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  /* Nav labels come from the locale files; copy.ts labels are the fallback */
  const NAV_LABEL_KEYS: Record<string, string> = {
    home: 'nav.forCreators',
    console: 'nav.forBrands',
    'how-it-works': 'nav.howItWorks',
    faqs: 'nav.faqs',
    '/talent': 'nav.talent',
    '/campaigns': 'nav.campaigns',
  };
  const navLabel = (s: { kind: string; label: string } & Record<string, any>) => {
    const key = NAV_LABEL_KEYS[s.kind === 'anchor' ? s.id : s.href];
    return key ? t(key, { defaultValue: s.label }) : s.label;
  };
  const otherLang =
    SUPPORTED_LANGUAGES.find((l) => l.code !== i18n.language) || SUPPORTED_LANGUAGES[0];
  const isLanding = location.pathname === '/';
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const role =
    typeof window !== 'undefined'
      ? (localStorage.getItem('role') || 'creator').toLowerCase().trim()
      : 'creator';

  const [user, setUser] = useState<any>(null);
  const [profileImg, setProfileImg] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .get('/auth/me')
      .then((res) => setUser(res.data || null))
      .catch(() => {});

    const fetchProfile = () => {
      if (role === 'creator') {
        api
          .get('/creators/profile')
          .then((res) => {
            if (res.data?.avatar_url) setProfileImg(res.data.avatar_url);
            if (res.data?.full_name) setProfileName(res.data.full_name);
          })
          .catch(() => {});
      } else if (role === 'brand') {
        api
          .get('/brands/profile')
          .then((res) => {
            if (res.data?.logo_url) setProfileImg(res.data.logo_url);
            if (res.data?.company_name) setProfileName(res.data.company_name);
          })
          .catch(() => {});
      } else if (role === 'manager') {
        api
          .get('/managers/profile')
          .then((res) => {
            if (res.data?.avatar_url) setProfileImg(res.data.avatar_url);
            if (res.data?.full_name) setProfileName(res.data.full_name);
          })
          .catch(() => {});
      }
    };
    fetchProfile();
    window.addEventListener('profileUpdated', fetchProfile);
    return () => window.removeEventListener('profileUpdated', fetchProfile);
  }, [token, role]);

  // Active-section highlight via scroll position — only when on the landing
  // page. On other routes the anchors aren't on screen, so we skip the listener.
  useEffect(() => {
    if (!isLanding) return;
    const onScroll = () => {
      for (let i = NAV_SECTIONS.length - 1; i >= 0; i--) {
        const item = NAV_SECTIONS[i];
        if (item.kind !== 'anchor') continue;
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveSection(item.id);
          return;
        }
      }
      setActiveSection('home');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [isLanding]);

  // When the landing page loads with a #fragment in the URL (e.g. after
  // clicking a nav anchor from /talent), scroll to that section once the
  // landing sections have rendered. A small delay lets React mount them.
  useEffect(() => {
    if (!isLanding || !location.hash) return;
    const id = location.hash.slice(1);
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
      return false;
    };
    if (tryScroll()) return;
    const t = setTimeout(tryScroll, 150);
    return () => clearTimeout(t);
  }, [isLanding, location.hash]);

  const scrollTo = (id: string) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  // Anchor click: if already on the landing page, smooth-scroll. Otherwise
  // React-Router-navigate to `/#<id>` so the landing page loads and the
  // hash-scroll effect above takes us to the section.
  const handleAnchorClick = (id: string) => (e: React.MouseEvent) => {
    if (isLanding) {
      e.preventDefault();
      scrollTo(id);
    } else {
      e.preventDefault();
      navigate(`/#${id}`);
      setMenuOpen(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/login';
  };

  const displayName =
    profileName ||
    user?.display_name ||
    user?.email?.split('@')[0] ||
    role;
  const initials = (displayName || 'U')
    .split(/\s+/)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() || '')
    .join('');

  /* ── Logged-in profile dropdown ─────────────────────────────────── */
  const ProfileDropdown: React.FC = () => (
    <Dropdown>
      <Dropdown.Trigger>
        <Button
          isIconOnly
          aria-label="Account menu"
          variant="ghost"
          size="sm"
          className="!rounded-full !bg-white/10 hover:!bg-white/20"
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
            <div className="text-muted text-xs truncate capitalize">
              {user?.email || role}
            </div>
          </div>
        </div>
        <Separator />
        <Dropdown.Menu>
          <Dropdown.Item
            id="dashboard"
            textValue="Dashboard"
            onAction={() => {
              window.location.href = '/dashboard';
            }}
          >
            <LayoutDashboard className="text-muted size-4" />
            <Label>Dashboard</Label>
          </Dropdown.Item>
          <Dropdown.Item
            id="profile"
            textValue="Profile"
            onAction={() => {
              window.location.href = '/dashboard/profile';
            }}
          >
            <User className="text-muted size-4" />
            <Label>Profile</Label>
          </Dropdown.Item>
          <Dropdown.Item
            id="sign-out"
            textValue="Sign out"
            onAction={handleLogout}
          >
            <LogOut className="text-muted size-4" />
            <Label>Sign out</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );

  return (
    <div className="sticky top-0 z-50 px-6 lg:px-10 pt-4 pb-3">
      {/* Frosted-glass backdrop layer: covers the whole strip including the
       * area above the pill that used to be a transparent gap. Fades softly
       * at the bottom so it doesn't create a hard edge against the page. */}
      <div
        aria-hidden
        className="absolute inset-0 backdrop-blur-md pointer-events-none"
        style={{
          background:
            'var(--landing-nav-strip, rgba(255,255,255,0.55))',
          WebkitBackdropFilter: 'blur(12px)',
          maskImage:
            'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
        }}
      />
      <nav
        aria-label="Primary"
        className="v-pill-nav relative mx-auto flex items-center justify-between gap-3 max-w-[1100px] pl-4 pr-2 py-2"
      >
        <button
          type="button"
          onClick={() => {
            // On the landing: scroll to the top. Anywhere else: go home.
            if (isLanding) scrollTo('home');
            else navigate('/');
          }}
          aria-label="Campgains Hub — home"
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <img
            src="/logo.png"
            alt="Campgains Hub"
            className="h-8 w-8 object-contain shrink-0"
            style={{ filter: 'drop-shadow(0 1px 4px rgba(108,99,255,0.45))' }}
          />
          <span
            className="font-medium tracking-tight"
            style={{
              color: '#fff',
              fontSize: '15px',
              letterSpacing: '-0.018em',
            }}
          >
            Campgains{' '}
            <span style={{ color: 'var(--color-creator-teal)' }}>Hub</span>
          </span>
        </button>

        {/* Center links */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_SECTIONS.map((s) => {
            const active =
              s.kind === 'anchor'
                ? isLanding && activeSection === s.id
                : location.pathname === s.href;
            const linkStyle: React.CSSProperties = {
              color: active ? '#fff' : 'rgba(255,255,255,0.62)',
              background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
              letterSpacing: '-0.013em',
              transition:
                'color 200ms cubic-bezier(0.16,1,0.3,1), background-color 200ms cubic-bezier(0.16,1,0.3,1)',
            };
            const enter = (e: React.MouseEvent<HTMLElement>) => {
              if (!active)
                (e.currentTarget as HTMLElement).style.color = '#fff';
            };
            const leave = (e: React.MouseEvent<HTMLElement>) => {
              if (!active)
                (e.currentTarget as HTMLElement).style.color =
                  'rgba(255,255,255,0.62)';
            };
            const cls =
              'px-3.5 py-1.5 rounded-full text-[13px] font-normal';

            if (s.kind === 'route') {
              return (
                <Link
                  key={s.href}
                  to={s.href}
                  className={cls}
                  style={linkStyle}
                  onMouseEnter={enter}
                  onMouseLeave={leave}
                >
                  {navLabel(s)}
                </Link>
              );
            }
            return (
              <a
                key={s.id}
                href={isLanding ? `#${s.id}` : `/#${s.id}`}
                onClick={handleAnchorClick(s.id)}
                className={cls}
                style={linkStyle}
                onMouseEnter={enter}
                onMouseLeave={leave}
              >
                {navLabel(s)}
              </a>
            );
          })}
        </div>

        {/* Right cluster — Profile dropdown if logged-in, else login/get started */}
        <div className="flex items-center gap-1.5">
          {/* Language switcher — shows the language you'd switch TO */}
          <button
            type="button"
            onClick={() => setLanguage(otherLang.code)}
            aria-label={`Switch language to ${otherLang.label}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium rounded-full"
            style={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)' }}
          >
            <Globe size={12} />
            {otherLang.short}
          </button>
          {token ? (
            <ProfileDropdown />
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex">
                <button
                  type="button"
                  className="px-3 py-1.5 text-[13px] font-normal rounded-full"
                  style={{ color: 'rgba(255,255,255,0.85)' }}
                >
                  {t('nav.signIn')}
                </button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm" className="!rounded-full">
                  {t('nav.getStarted')}
                </Button>
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-full ml-1"
            style={{ color: '#fff', background: 'rgba(255,255,255,0.06)' }}
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          className="lg:hidden relative mx-auto mt-3 max-w-[1100px] v-card v-fade-in"
          style={{ padding: '12px' }}
        >
          <ul className="flex flex-col">
            {NAV_SECTIONS.map((s) => {
              const cls =
                'block px-3 py-2.5 rounded-lg text-sm font-normal v-ink';
              const style = { letterSpacing: '-0.013em' };
              if (s.kind === 'route') {
                return (
                  <li key={s.href}>
                    <Link
                      to={s.href}
                      onClick={() => setMenuOpen(false)}
                      className={cls}
                      style={style}
                    >
                      {navLabel(s)}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={s.id}>
                  <a
                    href={isLanding ? `#${s.id}` : `/#${s.id}`}
                    onClick={handleAnchorClick(s.id)}
                    className={cls}
                    style={style}
                  >
                    {navLabel(s)}
                  </a>
                </li>
              );
            })}
            <li
              className="mt-1 pt-3 border-t"
              style={{ borderColor: 'var(--color-cool-gray)' }}
            >
              {token ? (
                <div className="space-y-2">
                  <Link to="/dashboard" className="block">
                    <Button variant="primary" fullWidth>
                      Dashboard
                    </Button>
                  </Link>
                  <Link to="/dashboard/profile" className="block">
                    <Button variant="outline" fullWidth>
                      Profile
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    fullWidth
                    className="!text-danger"
                    onPress={handleLogout}
                  >
                    Sign out
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link to="/login" className="flex-1">
                    <Button variant="outline" fullWidth>
                      Login
                    </Button>
                  </Link>
                  <Link to="/register" className="flex-1">
                    <Button variant="primary" fullWidth>
                      {t('nav.getStarted')}
                    </Button>
                  </Link>
                </div>
              )}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default LandingNav;
