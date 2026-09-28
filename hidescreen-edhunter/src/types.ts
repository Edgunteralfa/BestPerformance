// MIT License - Copyright (c) 2026 BestPerformance Contributors

export interface MainChrome {
  opacity: boolean;
  card: boolean;
  tabs: boolean;
  search: boolean;
  timer: boolean;
  minuteCue: boolean;
  thirtyCue: boolean;
  chapters: boolean;
  fontSize: boolean;
  heading: boolean;
  marks: boolean;
  clear: boolean;
  blind: boolean;
  lock: boolean;
}

export interface CardChrome {
  opacity: boolean;
  fontSize: boolean;
  heading: boolean;
  marks: boolean;
}

export const DEFAULT_MAIN_CHROME: MainChrome = {
  opacity: true,
  card: true,
  tabs: true,
  search: true,
  timer: true,
  minuteCue: true,
  thirtyCue: true,
  chapters: true,
  fontSize: true,
  heading: true,
  marks: true,
  clear: true,
  blind: true,
  lock: true,
};

export const DEFAULT_CARD_CHROME: CardChrome = {
  opacity: true,
  fontSize: true,
  heading: true,
  marks: true,
};

function normalizeFlags<T extends object>(value: unknown, defaults: T): T {
  const source = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
  const next = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    if (typeof source[key as string] === 'boolean') next[key] = source[key as string] as T[keyof T];
  }
  return next;
}

export function normalizeMainChrome(value: unknown): MainChrome {
  return normalizeFlags(value, DEFAULT_MAIN_CHROME);
}

export function normalizeCardChrome(value: unknown): CardChrome {
  return normalizeFlags(value, DEFAULT_CARD_CHROME);
}

export interface NoteTab {
  id: string;
  name: string;
  color: string;
  text: string;
}

export const MAX_TABS = 6;

export const TAB_COLORS = [
  '#2F6B4F',
  '#2F5E8A',
  '#8A5A2F',
  '#8A3E62',
  '#5C4A8A',
  '#4E6A3A',
];

// Colors for names in the left chapter list. They do not paint the note text.
export const CHAPTER_LIST_COLORS = [
  '#7DFFB3',
  '#7EC8FF',
  '#FFD166',
  '#FF9B71',
  '#E59BFF',
  '#F2F2F2',
];

export function defaultTabs(existingText = ''): NoteTab[] {
  return [
    { id: 'tab-1', name: 'Notes', color: TAB_COLORS[0], text: existingText },
    { id: 'tab-2', name: 'Notes 2', color: TAB_COLORS[1], text: '' },
  ];
}

export function chapterBudgetKey(tabId: string, heading: string): string {
  return `${tabId}:${heading}`;
}

/** Drops per-word color marks so search, chapters, and text export see the words themselves. */
export function visibleText(text: string): string {
  return text.replace(/\{\{#[0-9a-fA-F]{6}\}\}|\{\{\/\}\}/g, '');
}

export function headingAt(text: string, index: number | null): string {
  if (index === null) return '';
  const line = text.split('\n')[index] ?? '';
  return line.startsWith('# ') ? visibleText(line.slice(2)).trim() : '';
}

export function normalizePitchSeconds(value: unknown): number {
  if (value === undefined || value === null) return 300;
  const seconds = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return 300;
  return Math.min(Math.round(seconds), 24 * 60 * 60);
}

export function normalizeChapterNavWidths(value: unknown): Record<string, number> {
  if (value === null || typeof value !== 'object') return {};
  const widths: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const width = typeof raw === 'number' ? raw : Number(raw);
    if (key && Number.isFinite(width)) widths[key] = Math.min(360, Math.max(120, Math.round(width)));
  }
  return widths;
}

export function normalizeChapterListColors(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object') return {};
  const colors: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (key && typeof raw === 'string' && CHAPTER_LIST_COLORS.includes(raw)) colors[key] = raw;
  }
  return colors;
}

export function normalizeChapterBudgets(value: unknown): Record<string, number> {
  if (value === null || typeof value !== 'object') return {};
  const budgets: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const seconds = typeof raw === 'number' ? raw : Number(raw);
    if (key && Number.isFinite(seconds) && seconds > 0) budgets[key] = Math.round(seconds);
  }
  return budgets;
}

export function normalizeTabs(value: unknown, fallbackText: string): NoteTab[] {
  if (!Array.isArray(value) || value.length === 0) return defaultTabs(fallbackText);
  return value.slice(0, MAX_TABS).map((item, index) => {
    const row = item !== null && typeof item === 'object' ? item as Record<string, unknown> : {};
    const name = typeof row.name === 'string' && row.name.trim() ? row.name : `Notes ${index + 1}`;
    const color = typeof row.color === 'string' && row.color ? row.color : TAB_COLORS[index % TAB_COLORS.length];
    const text = typeof row.text === 'string' ? row.text : '';
    const id = typeof row.id === 'string' && row.id ? row.id : `tab-${index + 1}`;
    return { id, name, color, text };
  });
}

export interface Config {
  // Window position and size
  x: number;
  y: number;
  width: number;
  height: number;

  // Appearance
  opacity: number;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  headingColor: string;
  markColor: string;
  noteColor: string;
  bgColor: string;

  // State
  text: string;
  tabs: NoteTab[];
  activeTabId: string;
  firstRunShown: boolean;
  locked: boolean; // Mouse pass-through mode
  cursorCloak: boolean; // Hide the system pointer over this window

  // Updates
  autoCheckUpdates: boolean;

  // UI language: 'en' | 'ru'
  language: 'en' | 'ru';

  // Pitch clock. 0 shows elapsed time. Chapter budgets are seconds, keyed by tab and heading.
  pitchSeconds: number;
  chapterBudgets: Record<string, number>;
  chapterListColors: Record<string, string>;
  chapterNavWidths: Record<string, number>;
  mainChrome: MainChrome;
  cardChrome: CardChrome;

  cardText: string;
  cardVisible: boolean;
  cardX: number;
  cardY: number;
  cardWidth: number;
  cardHeight: number;
  cardFontSize: number;
  cardOpacity: number;

  // OS window title shown in Alt+Tab and share pickers. The in-app title stays BestPerformance.
  windowMask: WindowMaskId;

  // Named copies of the notes, chapter times, and the facts window.
  pitchMemories: PitchMemory[];
  activePitchId: string | null;
  searchExcludedTabIds: string[];
  pitchEpoch: number;
}

export interface PitchMemory {
  id: string;
  name: string;
  savedAt: number;
  tabs: NoteTab[];
  activeTabId: string;
  pitchSeconds: number;
  chapterBudgets: Record<string, number>;
  chapterListColors: Record<string, string>;
  chapterNavWidths: Record<string, number>;
  cardText: string;
  cardFontSize: number;
  searchExcludedTabIds: string[];
  tag: string;
  tagColor: string;
}

export const MAX_PITCH_MEMORIES = 30;

export const DEFAULT_CONFIG: Config = {
  x: 100,
  y: 100,
  width: 800,
  height: 400,
  opacity: 0.85,
  fontFamily: 'Consolas, "Courier New", monospace',
  fontSize: 14,
  fontColor: '#FFFFFF',
  headingColor: '#FFD166',
  markColor: '#5CFF9A',
  noteColor: '#7EC8FF',
  bgColor: '#2d2d2d',
  text: '',
  tabs: defaultTabs(''),
  activeTabId: 'tab-1',
  firstRunShown: false,
  locked: false,
  cursorCloak: false,
  autoCheckUpdates: true,
  language: 'en',
  pitchSeconds: 300,
  chapterBudgets: {},
  chapterListColors: {},
  chapterNavWidths: {},
  mainChrome: DEFAULT_MAIN_CHROME,
  cardChrome: DEFAULT_CARD_CHROME,
  cardText: '',
  cardVisible: false,
  cardX: 520,
  cardY: 100,
  cardWidth: 280,
  cardHeight: 240,
  cardFontSize: 16,
  cardOpacity: 0.85,
  windowMask: 'node',
  pitchMemories: [],
  activePitchId: null,
  searchExcludedTabIds: [],
  pitchEpoch: 0,
};

export const WINDOW_MASKS = [
  { id: 'node', en: 'Node Terminal', ru: 'Node Terminal' },
  { id: 'settings', en: 'Settings', ru: 'Параметры' },
  { id: 'security', en: 'Windows Security', ru: 'Безопасность Windows' },
  { id: 'notepad', en: 'Notepad', ru: 'Блокнот' },
  { id: 'calculator', en: 'Calculator', ru: 'Калькулятор' },
  { id: 'sticky', en: 'Sticky Notes', ru: 'Записки' },
  { id: 'snip', en: 'Snipping Tool', ru: 'Ножницы' },
  { id: 'explorer', en: 'File Explorer', ru: 'Проводник' },
  { id: 'photos', en: 'Photos', ru: 'Фотографии' },
  { id: 'clock', en: 'Clock', ru: 'Часы' },
  { id: 'help', en: 'Get Help', ru: 'Получить помощь' },
  { id: 'terminal', en: 'Windows Terminal', ru: 'Терминал' },
] as const;

export type WindowMaskId = (typeof WINDOW_MASKS)[number]['id'];

export function normalizeSearchExcluded(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').slice(0, MAX_TABS);
}

export function normalizePitchMemories(value: unknown): PitchMemory[] {
  if (!Array.isArray(value)) return [];
  const memories: PitchMemory[] = [];
  for (const item of value) {
    if (memories.length >= MAX_PITCH_MEMORIES) break;
    if (item === null || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 60) : '';
    if (!id || !name) continue;
    const tabs = normalizeTabs(row.tabs, '');
    const activeTabId = tabs.some((tab) => tab.id === row.activeTabId) ? String(row.activeTabId) : tabs[0].id;
    const savedAt = typeof row.savedAt === 'number' && Number.isFinite(row.savedAt) ? row.savedAt : 0;
    const fontSize = typeof row.cardFontSize === 'number' ? row.cardFontSize : DEFAULT_CONFIG.cardFontSize;
    const tagColor = typeof row.tagColor === 'string' && TAB_COLORS.some((color) => color === row.tagColor)
      ? row.tagColor
      : TAB_COLORS[0];
    memories.push({
      id,
      name,
      savedAt,
      tabs,
      activeTabId,
      pitchSeconds: normalizePitchSeconds(row.pitchSeconds),
      chapterBudgets: normalizeChapterBudgets(row.chapterBudgets),
      chapterListColors: normalizeChapterListColors(row.chapterListColors),
      chapterNavWidths: normalizeChapterNavWidths(row.chapterNavWidths),
      cardText: typeof row.cardText === 'string' ? row.cardText : '',
      cardFontSize: Math.min(48, Math.max(8, fontSize)),
      searchExcludedTabIds: normalizeSearchExcluded(row.searchExcludedTabIds),
      tag: typeof row.tag === 'string' ? row.tag.trim().slice(0, 24) : '',
      tagColor,
    });
  }
  return memories;
}

export function normalizeWindowMask(value: unknown): WindowMaskId {
  if (typeof value === 'string' && WINDOW_MASKS.some((item) => item.id === value)) {
    return value as WindowMaskId;
  }
  return 'node';
}

export function windowMaskTitle(id: WindowMaskId, locale = navigator.language): string {
  const item = WINDOW_MASKS.find((mask) => mask.id === id) ?? WINDOW_MASKS[0];
  return locale.toLowerCase().startsWith('ru') ? item.ru : item.en;
}

export const OPACITY_LEVELS = [1.0, 0.85, 0.70, 0.50];

export function normalizeOpacity(value: unknown, fallback = DEFAULT_CONFIG.opacity): number {
  const opacity = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(opacity)) return fallback;
  return Math.min(1, Math.max(0.5, Math.round(opacity * 20) / 20));
}

export const TEXT_COLORS = [
  '#FFFFFF', // white
  '#E0E0E0', // light gray
  '#FFFF00', // yellow
  '#00FF00', // green
  '#00FFFF', // cyan
  '#87CEEB', // sky blue
  '#FFA500', // orange
  '#FF69B4', // pink
];

export const BG_COLORS = [
  '#1E1E1E', // near black
  '#2D2D2D', // dark gray
  '#1A1A2E', // dark blue
  '#1E3A2E', // dark green
  '#2E1A1A', // dark red
  '#2E1A2E', // dark purple
  '#2D2D1A', // dark olive
  '#1A2D2D', // dark teal
];

export const FONT_FAMILIES = [
  'Consolas, "Courier New", monospace',
  '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  'Arial, Helvetica, sans-serif',
  '"Courier New", Courier, monospace',
  'Calibri, sans-serif',
  'Verdana, Geneva, Tahoma, sans-serif',
  '"Times New Roman", Times, serif',
  'Georgia, serif',
];
