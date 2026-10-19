// MIT License - Copyright (c) 2026 BestPerformance Contributors

export const EYE_RATIO = 0.16;
export const GLIDE_DEFAULT_PX_PER_SEC = 32;

export interface ChapterSpan {
  start: number;
  end: number;
}

export function chapterSpan(headingIndexes: number[], active: number | null, lineCount: number): ChapterSpan {
  if (lineCount <= 0) return { start: 0, end: 0 };
  if (headingIndexes.length === 0) return { start: 0, end: lineCount };
  const anchor = active ?? headingIndexes[0];
  if (anchor < headingIndexes[0]) return { start: 0, end: headingIndexes[0] };
  let start = headingIndexes[0];
  let end = lineCount;
  for (const index of headingIndexes) {
    if (index <= anchor) start = index;
    else {
      end = index;
      break;
    }
  }
  return { start, end };
}

export function glideSeconds(rehearsed: number | undefined, planned: number | undefined): number {
  if (planned !== undefined && planned > 0) return planned;
  if (rehearsed !== undefined && rehearsed > 0) return rehearsed;
  return 0;
}

export function mergeRehearsal(
  saved: Record<string, number>,
  spentMs: Record<string, number>,
  chapters: { paceKey: string; timerKey: string }[],
): Record<string, number> {
  const next = { ...saved };
  for (const chapter of chapters) {
    const ms = spentMs[chapter.timerKey] ?? 0;
    if (ms < 1000) continue;
    next[chapter.paceKey] = Math.max(1, Math.round(ms / 1000));
  }
  return next;
}

export function glideTravel(spokenHeights: number[]): number {
  if (spokenHeights.length < 2) return 0;
  let distance = 0;
  for (let index = 0; index < spokenHeights.length - 1; index += 1) distance += spokenHeights[index];
  return distance;
}

export function glidePixelsPerSecond(distancePx: number, budgetSeconds: number): number {
  if (budgetSeconds > 0 && distancePx > 0) return distancePx / budgetSeconds;
  return GLIDE_DEFAULT_PX_PER_SEC;
}

const BRIDGE_TAU_SEC = 0.08;

/** Closes a skipped block quickly, without a one-frame jump and without spending the chapter time on it. */
export function glideBridgeStep(gapPx: number, dt: number, spokenStep: number): number {
  if (gapPx <= 1) return Math.max(0, gapPx);
  const eased = gapPx * (1 - Math.exp(-dt / BRIDGE_TAU_SEC));
  return Math.min(gapPx, Math.max(spokenStep, eased));
}

export function isAsideLine(visible: string): boolean {
  const trimmed = visible.trim();
  return trimmed.startsWith('//') || /^\[cue\b/i.test(trimmed);
}

export function isCommentLine(kind: string, visible: string): boolean {
  return kind === 'heading' || kind === 'note' || isAsideLine(visible);
}
