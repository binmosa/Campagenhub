import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

/**
 * ThemeContext — runtime accent + dark-mode switching.
 *
 * Sets the canonical HeroUI tokens at :root so brand color flows through
 * every component (Button, Card, Chip, KPI, etc.) via HeroUI's built-in
 * color-mix derivatives (--accent-hover, --accent-soft, focus, etc.).
 *
 * For back-compat with un-migrated brand/manager/admin pages still using
 * the legacy `bg-brand-*` Tailwind utilities, the same indigo scale gets
 * injected on --brand-50..950. New code should reference --accent /
 * `bg-accent` / `text-accent-soft-foreground` etc. directly.
 *
 * The canonical theme lives in `src/styles/theme.css` and matches the
 * HeroUI Pro reference at `public/design-reference/globals-3.css`.
 */

/* ─── Brand palettes (admin SiteSettings can swap accent at runtime) ─── */
const BRAND_PALETTES: Record<
  string,
  {
    accent: string;
    accentForeground: string;
    /** Frozen indigo legacy scale so old `bg-brand-500` keeps rendering. */
    legacyScale: Record<string, string>;
  }
> = {
  'theme-brand': {
    /* HeroUI default — indigo #5B5CF6 per design reference */
    accent: 'oklch(56.72% 0.2241 276.27)',
    accentForeground: 'oklch(99.11% 0 0)',
    legacyScale: {
      '50': '#eef2ff', '100': '#e0e7ff', '200': '#c7d2fe', '300': '#a5b4fc',
      '400': '#818cf8', '500': '#6366f1', '600': '#5b5cf6', '700': '#4f46e5',
      '800': '#4338ca', '900': '#3730a3', '950': '#1e1b4b',
    },
  },
  'theme-indigo': {
    accent: 'oklch(58% 0.215 276)',
    accentForeground: 'oklch(99.11% 0 0)',
    legacyScale: {
      '50': '#eef2ff', '100': '#e0e7ff', '200': '#c7d2fe', '300': '#a5b4fc',
      '400': '#818cf8', '500': '#6366f1', '600': '#4f46e5', '700': '#4338ca',
      '800': '#3730a3', '900': '#312e81', '950': '#1e1b4b',
    },
  },
  'theme-blue': {
    accent: 'oklch(62% 0.195 254)',
    accentForeground: 'oklch(99.11% 0 0)',
    legacyScale: {
      '50': '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe', '300': '#93c5fd',
      '400': '#60a5fa', '500': '#3b82f6', '600': '#2563eb', '700': '#1d4ed8',
      '800': '#1e40af', '900': '#1e3a8a', '950': '#172554',
    },
  },
  'theme-green': {
    accent: 'oklch(70% 0.18 145)',
    accentForeground: 'oklch(21% 0.005 285.89)',
    legacyScale: {
      '50': '#f0fdf4', '100': '#dcfce7', '200': '#bbf7d0', '300': '#86efac',
      '400': '#4ade80', '500': '#22c55e', '600': '#16a34a', '700': '#15803d',
      '800': '#166534', '900': '#14532d', '950': '#052e16',
    },
  },
  'theme-purple': {
    accent: 'oklch(60% 0.24 305)',
    accentForeground: 'oklch(99.11% 0 0)',
    legacyScale: {
      '50': '#faf5ff', '100': '#f3e8ff', '200': '#e9d5ff', '300': '#d8b4fe',
      '400': '#c084fc', '500': '#a855f7', '600': '#9333ea', '700': '#7e22ce',
      '800': '#6b21a8', '900': '#581c87', '950': '#3b0764',
    },
  },
  'theme-yellow': {
    accent: 'oklch(76% 0.18 88)',
    accentForeground: 'oklch(21% 0.005 285.89)',
    legacyScale: {
      '50': '#fefce8', '100': '#fef9c3', '200': '#fef08a', '300': '#fde047',
      '400': '#facc15', '500': '#eab308', '600': '#ca8a04', '700': '#a16207',
      '800': '#854d0e', '900': '#713f12', '950': '#422006',
    },
  },
};

/* Legacy surface scale — frozen slate; only used for back-compat
   `bg-surface-200` etc. on un-migrated pages. */
const SURFACE_LIGHT: Record<string, string> = {
  '50': '#f8fafc', '100': '#f1f5f9', '200': '#e2e8f0', '300': '#cbd5e1',
  '400': '#94a3b8', '500': '#64748b', '600': '#475569', '700': '#334155',
  '800': '#1e293b', '900': '#0f172a', '950': '#020617',
};

const SURFACE_DARK: Record<string, string> = {
  '50': '#1e293b', '100': '#1e293b', '200': '#334155', '300': '#475569',
  '400': '#64748b', '500': '#94a3b8', '600': '#cbd5e1', '700': '#e2e8f0',
  '800': '#f1f5f9', '900': '#f8fafc', '950': '#ffffff',
};

interface ThemeContextType {
  brandTheme: string;
  darkMode: boolean;
  setBrandTheme: (theme: string) => void;
  toggleDarkMode: () => void;
  applyBrandTheme: (theme: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  brandTheme: 'theme-brand',
  darkMode: false,
  setBrandTheme: () => {},
  toggleDarkMode: () => {},
  applyBrandTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

/* ─── Variable injection ─────────────────────────────────────────── */
function injectBrandVars(themeId: string) {
  const palette = BRAND_PALETTES[themeId] || BRAND_PALETTES['theme-brand'];
  const root = document.documentElement;

  /* Canonical HeroUI tokens — drive every component's accent color. */
  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-foreground', palette.accentForeground);

  /* Legacy brand scale — keeps un-migrated pages rendering. */
  Object.entries(palette.legacyScale).forEach(([shade, hex]) => {
    root.style.setProperty(`--brand-${shade}`, hex);
  });
}

function injectSurfaceVars(dark: boolean) {
  const palette = dark ? SURFACE_DARK : SURFACE_LIGHT;
  const root = document.documentElement;
  Object.entries(palette).forEach(([shade, hex]) => {
    root.style.setProperty(`--surface-${shade}`, hex);
  });
  if (dark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
}

/* ─── Provider ──────────────────────────────────────────────────── */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [brandTheme, setBrandThemeState] = useState(() => {
    const saved = localStorage.getItem('brandTheme') || 'theme-brand';
    injectBrandVars(saved);
    return saved;
  });
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'true'
  );

  /* Pull admin-configured brand color on mount */
  useEffect(() => {
    api
      .get('/public/settings')
      .then((res) => {
        const theme = res.data.platform_theme || 'theme-brand';
        if (theme !== brandTheme) {
          localStorage.setItem('brandTheme', theme);
          setBrandThemeState(theme);
          injectBrandVars(theme);
        }
      })
      .catch(() => {
        const fallback = localStorage.getItem('brandTheme') || 'theme-brand';
        injectBrandVars(fallback);
      });
  }, [brandTheme]);

  useEffect(() => {
    injectSurfaceVars(darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const applyBrandTheme = (theme: string) => {
    localStorage.setItem('brandTheme', theme);
    setBrandThemeState(theme);
    injectBrandVars(theme);
  };

  const setBrandTheme = (theme: string) => applyBrandTheme(theme);
  const toggleDarkMode = () => setDarkMode((p) => !p);

  return (
    <ThemeContext.Provider
      value={{ brandTheme, darkMode, setBrandTheme, toggleDarkMode, applyBrandTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export { BRAND_PALETTES };
export default ThemeContext;
