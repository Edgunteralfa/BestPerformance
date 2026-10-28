import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, type PitchMemory } from '../src/types';
import { exportPitchPart, parsePitchPart, mergePitchPart } from '../src/pitchParts';
import { pitchToFile } from '../src/pitchFile';
const base = (): PitchMemory => ({
  id: 'contest-a', name: 'Contest 2026', savedAt: 1,
  tabs: [
    { id: 'pitch', name: 'Pitch', color: '#fff', text: 'THE ORIGINAL PITCH', readingMode: 'outline' },
    { id: 'qa-a', name: 'Jury Q&A', color: '#fff', text: 'Q: First question?\nA: Original answer', readingMode: 'outline' },
    { id: 'qa-b', name: 'Finance', color: '#fff', text: 'Q: TAM?\nA: 10 units', readingMode: 'outline' },
  ],
  activeTabId: 'pitch', pitchSeconds: 420,
  chapterBudgets: {}, chapterPaces: {}, chapterListColors: {}, chapterNavWidths: {},
  cardText: 'VERIFIED startup readiness facts', cardFontSize: 12,
  searchExcludedTabIds: [], semanticExcludedTabIds: [], contestContext: 'This contest criteria',
  tag: '2026', tagColor: '#f00',
});
describe('Safe JSON partial import', () => {
  it('replaces only selected question tab and keeps pitch, other Q&A, context, and timers', () => {
    const target = base();
    const incoming = { ...base(), tabs: [
      target.tabs[0],
      { ...target.tabs[1], text: 'Q: Changed?\nA: Updated answer' },
      { ...target.tabs[2], text: 'Q: TAM?\nA: 999' },
    ] };
    const json = exportPitchPart(incoming, 'questions', ['qa-a', 'qa-b']);
    const parsed = parsePitchPart(json, 'questions')!;
    const applied = mergePitchPart(target, parsed, ['qa-a']);
    expect(applied.tabs[0].text).toBe('THE ORIGINAL PITCH');
    expect(applied.tabs[1].text).toContain('Updated answer');
    expect(applied.tabs[2].text).toContain('10 units');
    expect(applied.contestContext).toBe('This contest criteria');
    expect(applied.pitchSeconds).toBe(420);
    expect(applied.cardText).toContain('VERIFIED');
    expect(target.tabs[1].text).toContain('Original answer');
  });
  it('replaces just first pitch tab of an existing full contest snapshot', () => {
    const incoming = { ...base(), tabs: [{ ...base().tabs[0], text: 'NEW PITCH' }, ...base().tabs.slice(1)] };
    const parsed = parsePitchPart(pitchToFile(incoming), 'pitch')!;
    const result = mergePitchPart(base(), parsed, [parsed.tabs[0].id]);
    expect(result.tabs[0].text).toBe('NEW PITCH');
    expect(result.tabs[1].text).toContain('Original answer');
  });
  it('rejects incorrect partial kind, invalid files and zero selection', () => {
    const data = exportPitchPart(base(), 'questions', ['qa-a']);
    expect(parsePitchPart(data, 'pitch')).toBeNull();
    expect(parsePitchPart('garbage', 'questions')).toBeNull();
    expect(() => mergePitchPart(base(), parsePitchPart(data, 'questions')!, [])).toThrow();
  });
  it('rejects a source file containing no questions', () => {
    const data = exportPitchPart(base(), 'pitch');
    expect(parsePitchPart(data, 'questions')).toBeNull();
    expect(DEFAULT_CONFIG.semantic.generateAnswers).toBe(false);
  });
});
