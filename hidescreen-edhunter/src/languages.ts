export const LANGUAGES = [
  { id: 'en', native: 'English' },
  { id: 'zh', native: '中文' },
  { id: 'es', native: 'Español' },
  { id: 'hi', native: 'हिन्दी' },
  { id: 'ar', native: 'العربية' },
  { id: 'pt', native: 'Português' },
  { id: 'ru', native: 'Русский' },
  { id: 'ja', native: '日本語' },
  { id: 'de', native: 'Deutsch' },
  { id: 'fr', native: 'Français' },
  { id: 'ko', native: '한국어' },
  { id: 'it', native: 'Italiano' },
  { id: 'tr', native: 'Türkçe' },
  { id: 'id', native: 'Bahasa Indonesia' },
  { id: 'vi', native: 'Tiếng Việt' },
] as const;

export type Language = (typeof LANGUAGES)[number]['id'];

const PREFIXES: readonly [string, Language][] = [
  ['zh', 'zh'],
  ['es', 'es'],
  ['hi', 'hi'],
  ['ar', 'ar'],
  ['pt', 'pt'],
  ['ru', 'ru'],
  ['ja', 'ja'],
  ['de', 'de'],
  ['fr', 'fr'],
  ['ko', 'ko'],
  ['it', 'it'],
  ['tr', 'tr'],
  ['id', 'id'],
  ['vi', 'vi'],
  ['en', 'en'],
];

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && LANGUAGES.some((item) => item.id === value);
}

export function detectLanguage(locale = navigator.language): Language {
  const value = locale.toLowerCase();
  const hit = PREFIXES.find(([prefix]) => value === prefix || value.startsWith(`${prefix}-`));
  return hit ? hit[1] : 'en';
}

export function normalizeLanguage(value: unknown): Language {
  return isLanguage(value) ? value : detectLanguage();
}

export function languageDirection(language: Language): 'rtl' | 'ltr' {
  return language === 'ar' ? 'rtl' : 'ltr';
}
