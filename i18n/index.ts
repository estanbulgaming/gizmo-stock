export type Lang = 'tr' | 'en' | 'ru' | 'el';

type Dict = Record<string, string>;

// Using resolveJsonModule from tsconfig
import tr from './tr.json';
import en from './en.json';
import ru from './ru.json';
import el from './el.json';

const dictionaries: Record<Lang, Dict> = {
  tr,
  en,
  ru,
  el,
};

// Language display names (in their native language)
export const languageNames: Record<Lang, string> = {
  tr: 'Türkçe',
  en: 'English',
  ru: 'Русский',
  el: 'Ελληνικά',
};

// Available languages list
export const availableLanguages: Lang[] = ['tr', 'en', 'ru', 'el'];

// Storage key for persisting language preference
const LANG_STORAGE_KEY = 'gizmo-stock-lang';

// Load saved language or default to Turkish
function loadSavedLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && availableLanguages.includes(saved as Lang)) {
      return saved as Lang;
    }
  } catch {
    // localStorage not available
  }
  return 'tr';
}

let currentLang: Lang = loadSavedLang();

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang) {
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // localStorage not available
  }
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = dictionaries[currentLang] || {};
  let value = dict[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return value;
}
