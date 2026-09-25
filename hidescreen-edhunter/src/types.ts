// MIT License - Copyright (c) 2026 BestPerformance Contributors

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

export function defaultTabs(existingText = ''): NoteTab[] {
  return [
    { id: 'tab-1', name: 'Notes', color: TAB_COLORS[0], text: existingText },
    { id: 'tab-2', name: 'Notes 2', color: TAB_COLORS[1], text: '' },
  ];
}

export function chapterBudgetKey(tabId: string, heading: string): string {
  return `${tabId}:${heading}`;
}

export function headingAt(text: string, index: number | null): string {
  if (index === null) return '';
  const line = text.split('\n')[index] ?? '';
  return line.startsWith('# ') ? line.slice(2).trim() : '';
}

export function normalizePitchSeconds(value: unknown): number {
  if (value === undefined || value === null) return 300;
  const seconds = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return 300;
  return Math.min(Math.round(seconds), 24 * 60 * 60);
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

  // Updates
  autoCheckUpdates: boolean;

  // UI language: 'en' | 'ru'
  language: 'en' | 'ru';

  // Pitch clock. 0 shows elapsed time. Chapter budgets are seconds, keyed by tab and heading.
  pitchSeconds: number;
  chapterBudgets: Record<string, number>;

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
  cardText: string;
  cardFontSize: number;
  tag: string;
  tagColor: string;
}

export const MAX_PITCH_MEMORIES = 30;

export const DEFAULT_CONFIG: Config = {
  x: 100,
  y: 100,
  width: 400,
  height: 200,
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
  autoCheckUpdates: true,
  language: 'en',
  pitchSeconds: 300,
  chapterBudgets: {},
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
      cardText: typeof row.cardText === 'string' ? row.cardText : '',
      cardFontSize: Math.min(48, Math.max(8, fontSize)),
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
