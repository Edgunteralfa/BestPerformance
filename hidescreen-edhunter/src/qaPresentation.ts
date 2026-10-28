// MIT License - Copyright (c) 2026 BestPerformance Contributors
// Display policy for source-backed Q&A. A similarity value is not factual confidence.
import type { AnswerVariants } from './types';

export interface QaDisplayHit {
  tabId: string;
  tabName: string;
  line: number;
  text: string;
  answer?: string;
  variants?: AnswerVariants;
  kind?: 'question' | 'excerpt';
  score?: number;
  method?: 'hybrid' | 'semantic' | 'exact terms';
}

export const QA_MAIN_MATCH_FLOOR = 0.65;

export function qaHitKey(hit: Pick<QaDisplayHit, 'tabId' | 'line'>): string {
  return JSON.stringify([hit.tabId, hit.line]);
}

/** Why a hit cannot be endorsed as the main answer. null means eligible. */
export function qaMainRejection(hit: QaDisplayHit, semanticReady: boolean, matchFloor: number): string | null {
  if (!semanticReady) return 'Семантический индекс ещё не готов.';
  if (hit.kind !== 'question') return 'Это фрагмент заметки, а не подготовленная Q&A-карточка.';
  if (!hit.answer?.trim()) return 'У вопроса нет подготовленного ответа.';
  if (hit.method !== 'hybrid' && hit.method !== 'semantic') {
    return 'Есть только лексическое совпадение без подтверждённого семантического сходства.';
  }
  if (typeof hit.score !== 'number' || !Number.isFinite(hit.score)) {
    return 'Нет корректной оценки семантического сходства.';
  }
  if (hit.score < matchFloor) {
    return `Similarity ${hit.score.toFixed(2)} ниже порога основного ответа ${matchFloor.toFixed(2)}.`;
  }
  return null;
}

export function groupQaResults<T extends QaDisplayHit>(
  hits: readonly T[], semanticReady: boolean, minimum: number,
  mainAnswerMinimum = QA_MAIN_MATCH_FLOOR,
): { primary: T | null; alternatives: T[]; matchFloor: number } {
  // The search minimum controls candidate retrieval; the separate main-answer
  // minimum controls endorsement. Never endorse below the retrieval minimum.
  const matchFloor = Math.max(minimum, mainAnswerMinimum);
  const primary = hits.find(hit => qaMainRejection(hit, semanticReady, matchFloor) === null) ?? null;
  const primaryKey = primary ? qaHitKey(primary) : null;
  return {
    primary,
    alternatives: hits.filter(hit => qaHitKey(hit) !== primaryKey),
    matchFloor,
  };
}

export function buildSingleQaEvidence(hit: QaDisplayHit | null): string | null {
  if (!hit || hit.kind !== 'question' || !hit.answer?.trim()) return null;
  const source = [
    `Source: ${hit.tabName}`,
    `Question: ${hit.text}`,
    `Prepared answer: ${hit.answer}`,
  ];
  for (const [mode, text] of Object.entries(hit.variants ?? {})) {
    if (text) source.push(`${mode}: ${text}`);
  }
  return source.join('\n').slice(0, 13000);
}
