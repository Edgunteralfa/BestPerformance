// MIT License - Copyright (c) 2026 BestPerformance Contributors

import type { PitchMemory } from './types';
import { normalizePitchMemories } from './types';

const KIND = 'bestperformance-pitch';

export function pitchToFile(pitch: PitchMemory): string {
  return JSON.stringify({ kind: KIND, version: 1, pitch }, null, 2);
}

export function pitchToText(pitch: PitchMemory): string {
  const parts = [`# ${pitch.name}`, ''];
  for (const tab of pitch.tabs) {
    parts.push(`## ${tab.name}`, '', tab.text.trimEnd(), '');
  }
  const facts = pitch.cardText.trim();
  if (facts) parts.push('## 12', '', facts, '');
  return `${parts.join('\n').trimEnd()}\n`;
}

export function pitchFromFile(raw: string): PitchMemory | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  const row = parsed as Record<string, unknown>;
  if (row.kind !== KIND) return null;
  const pitch = row.pitch;
  if (pitch === null || typeof pitch !== 'object') return null;
  const withId = {
    ...(pitch as Record<string, unknown>),
    id: 'import',
    name: typeof (pitch as Record<string, unknown>).name === 'string'
      ? (pitch as Record<string, unknown>).name
      : '',
  };
  return normalizePitchMemories([withId])[0] ?? null;
}
