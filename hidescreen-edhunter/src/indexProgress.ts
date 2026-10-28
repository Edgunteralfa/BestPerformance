// MIT License - Copyright (c) 2026 BestPerformance Contributors
// Process-wide immutable status: visible in Settings even when Search is closed.
// Counts describe *embedding chunks*, not the number of source Q&A pairs.
import { useSyncExternalStore } from 'react';

export type IndexStage =
  | 'disabled' | 'no-model' | 'checking' | 'waiting' | 'indexing'
  | 'ready' | 'empty' | 'error';

export interface IndexProgress {
  stage: IndexStage;
  detail: string;
  processed: number;
  total: number;
  cached: number;
  generated: number;
  tabs: number;
}

const initial: IndexProgress = {
  stage: 'disabled', detail: '', processed: 0, total: 0,
  cached: 0, generated: 0, tabs: 0,
};
let current = initial;
const listeners = new Set<() => void>();

export function publishIndexProgress(next: IndexProgress): void {
  current = { ...next };
  for (const notify of listeners) notify();
}
export function setIndexStatus(
  stage: IndexStage, detail: string, tabs = 0,
  processed = 0, total = 0, cached = 0, generated = 0,
): void {
  publishIndexProgress({ stage, detail, tabs, processed, total, cached, generated });
}
export function getIndexProgress(): IndexProgress { return current; }
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useIndexProgress(): IndexProgress {
  return useSyncExternalStore(subscribe, getIndexProgress, getIndexProgress);
}

export function indexPercent(status: IndexProgress): number {
  if (status.stage === 'ready') return 100;
  if (status.stage === 'empty') return 0;
  return status.total > 0
    ? Math.min(100, Math.max(0, Math.round((status.processed / status.total) * 100)))
    : 0;
}
