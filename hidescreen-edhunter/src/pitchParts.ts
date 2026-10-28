// Partial import/export for one named BestPerformance contest.
// A full snapshot is never silently replaced by importing Q&A tabs.
import { MAX_TABS, type NoteTab, type PitchMemory, normalizeTabs } from './types';
import { pitchFromFile } from './pitchFile';

export type PartKind = 'pitch' | 'questions';
export interface ImportedPart { kind: PartKind; name: string; tabs: NoteTab[] }

export function exportPitchPart(memory: PitchMemory, kind: PartKind, tabIds: string[] = []): string {
  const tabs = kind === 'pitch' ? memory.tabs.slice(0, 1)
    : memory.tabs.slice(1).filter(t => tabIds.includes(t.id));
  if (!tabs.length) throw new Error('Нет выбранных вкладок для экспорта');
  return JSON.stringify({
    kind: 'bestperformance-parts', version: 1, part: kind,
    contest: memory.name, tabs,
  }, null, 2);
}
export function parsePitchPart(raw: string, requested: PartKind): ImportedPart | null {
  if (raw.length > 8_000_000) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const row = parsed as Record<string, unknown>;
  if (row.kind === 'bestperformance-pitch') {
    const memory = pitchFromFile(raw);
    if (!memory) return null;
    return {
      kind: requested, name: memory.name,
      tabs: requested === 'pitch' ? memory.tabs.slice(0, 1) : memory.tabs.slice(1),
    };
  }
  if (row.kind !== 'bestperformance-parts' || row.version !== 1 || row.part !== requested
    || !Array.isArray(row.tabs) || row.tabs.length < 1 || row.tabs.length > MAX_TABS) return null;
  const tabs = normalizeTabs(row.tabs, '');
  if (tabs.some(t => t.text.length > 300_000)) return null;
  return {
    kind: requested, name: typeof row.contest === 'string' ? row.contest.slice(0, 90) : '',
    tabs: requested === 'pitch' ? tabs.slice(0, 1) : tabs,
  };
}
export function mergePitchPart(target: PitchMemory, incoming: ImportedPart, selected: string[]): PitchMemory {
  const picked = incoming.tabs.filter(t => selected.includes(t.id));
  if (!picked.length) throw new Error('Выбери хотя бы одну вкладку');
  const newTabs = [...target.tabs];
  if (incoming.kind === 'pitch') {
    const index = 0;
    newTabs[index] = { ...newTabs[index], text: picked[0].text, readingMode: picked[0].readingMode };
  } else {
    for (const tab of picked) {
      // Match existing Q&A by stable ID OR exact name, NEVER overwrite the pitch tab.
      const found = newTabs.findIndex((t, i) => i > 0 &&
        (t.id === tab.id || t.name.trim().toLowerCase() === tab.name.trim().toLowerCase()));
      if (found > 0) newTabs[found] = { ...newTabs[found], text: tab.text, readingMode: tab.readingMode };
      else {
        if (newTabs.length >= MAX_TABS) throw new Error('Достигнут лимит вкладок; импорт отменён');
        newTabs.push({ ...tab, id: crypto.randomUUID() });
      }
    }
  }
  return { ...target, tabs: newTabs, savedAt: Date.now() };
}
