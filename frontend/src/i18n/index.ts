import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import am from './locales/am';

/**
 * i18n — UI language is a USER preference (separate from market).
 * Resolution order: saved preference → browser language → English.
 * Missing keys in any locale fall back to English, so translation can be
 * adopted incrementally across the app.
 *
 * Adding a language = add ./locales/<code>.ts, register it here, and (if
 * it needs its own script) extend the font override in landing-visitors.css.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'am', label: 'አማርኛ', short: 'አማ' },
];

const STORAGE_KEY = 'lang';

const detectLanguage = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    /* private mode */
  }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.some((l) => l.code === nav) ? nav : 'en';
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    am: { translation: am },
  },
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language;

/** Switch UI language, persist it, and update <html lang> (drives fonts). */
export const setLanguage = (code: string) => {
  if (!SUPPORTED_LANGUAGES.some((l) => l.code === code)) return;
  i18n.changeLanguage(code);
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* private mode */
  }
  document.documentElement.lang = code;
};

export default i18n;
