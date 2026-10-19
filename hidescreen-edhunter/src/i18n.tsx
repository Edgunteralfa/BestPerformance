/* eslint-disable react-refresh/only-export-components -- context module also exports helpers */
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { languageDirection, type Language } from './languages';
import { ar } from './locales/ar';
import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { hi } from './locales/hi';
import { id } from './locales/id';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { pt } from './locales/pt';
import { ru } from './locales/ru';
import { tr } from './locales/tr';
import { vi } from './locales/vi';
import { zh } from './locales/zh';
import type { Messages } from './locales/types';

export type { Language } from './languages';
export { detectLanguage } from './languages';

const dictionaries: Record<Language, Messages> = {
  en,
  zh,
  es,
  hi,
  ar,
  pt,
  ru,
  ja,
  de,
  fr,
  ko,
  it,
  tr,
  id,
  vi,
};

export type MessageKey = keyof Messages;

export function formatMessage(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

export function text(language: Language, key: MessageKey): string {
  return dictionaries[language][key];
}

interface I18nValue {
  language: Language;
  t: (key: MessageKey) => string;
}

const I18nContext = createContext<I18nValue>({
  language: 'en',
  t: (key) => en[key],
});

export function I18nProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = languageDirection(language);
  }, [language]);

  const table = dictionaries[language] ?? en;
  const value: I18nValue = {
    language,
    t: (key) => table[key],
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
