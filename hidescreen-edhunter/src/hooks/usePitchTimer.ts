// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useCallback, useEffect, useRef, useState } from 'react';

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export type Pace = 'none' | 'ok' | 'warn' | 'over';

export function paceOf(remainingMs: number, budgetMs: number): Pace {
  if (budgetMs <= 0) return 'none';
  if (remainingMs <= 0) return 'over';
  if (remainingMs <= budgetMs * 0.15) return 'warn';
  return 'ok';
}

export function parseDuration(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const clock = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (clock) {
    const seconds = Number(clock[2]);
    if (seconds >= 60) return null;
    return Number(clock[1]) * 60 + seconds;
  }
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return null;
}

export function usePitchTimer(chapterKey: string) {
  const [running, setRunning] = useState(false);
  const [totalMs, setTotalMs] = useState(0);
  const [byChapter, setByChapter] = useState<Record<string, number>>({});
  const keyRef = useRef(chapterKey);
  keyRef.current = chapterKey;

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      setTotalMs((value) => value + delta);
      const key = keyRef.current;
      if (!key) return;
      setByChapter((value) => ({ ...value, [key]: (value[key] ?? 0) + delta }));
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  const toggle = useCallback(() => {
    setRunning((value) => !value);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setTotalMs(0);
    setByChapter({});
  }, []);

  return {
    running,
    totalMs,
    byChapter,
    chapterMs: chapterKey ? byChapter[chapterKey] ?? 0 : 0,
    toggle,
    reset,
  };
}
