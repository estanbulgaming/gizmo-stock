export type Lang = 'tr';

type Dict = Record<string, string>;

// Using resolveJsonModule from tsconfig
import tr from './tr.json';

const dictionaries: Record<Lang, Dict> = {
  tr,
};

let currentLang: Lang = 'tr';

export function setLang(lang: Lang) {
  currentLang = lang;
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
