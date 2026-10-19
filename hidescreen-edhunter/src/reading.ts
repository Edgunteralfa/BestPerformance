// MIT License - Copyright (c) 2026 BestPerformance Contributors

export const EYE_RATIO = 0.16;
export const GLIDE_DEFAULT_PX_PER_SEC = 32;
const GLIDE_MIN_PX_PER_SEC = 6;
const GLIDE_MAX_PX_PER_SEC = 160;

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
  if (rehearsed !== undefined && rehearsed > 0) return rehearsed;
  if (planned !== undefined && planned > 0) return planned;
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

export function glidePixelsPerSecond(distancePx: number, budgetSeconds: number): number {
  if (budgetSeconds > 0 && distancePx > 0) {
    return Math.min(GLIDE_MAX_PX_PER_SEC, Math.max(GLIDE_MIN_PX_PER_SEC, distancePx / budgetSeconds));
  }
  return GLIDE_DEFAULT_PX_PER_SEC;
}

export function isAsideLine(visible: string): boolean {
  const trimmed = visible.trim();
  return trimmed.startsWith('//') || /^\[cue\b/i.test(trimmed);
}

export function isCommentLine(kind: string, visible: string): boolean {
  return kind === 'note' || isAsideLine(visible);
}

export function spokenHeight(lines: { height: number; comment: boolean }[]): number {
  return lines.reduce((sum, line) => (line.comment ? sum : sum + line.height), 0);
}
