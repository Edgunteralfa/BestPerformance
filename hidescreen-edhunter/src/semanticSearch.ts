// MIT License - Copyright (c) 2026 BestPerformance Contributors
// Local, user-opt-in embedding index for prepared English Q&A.
// No generated answers: every hit retains its originating tab and line.
import { invoke } from '@tauri-apps/api/core';
import { visibleText, type NoteTab, type AnswerVariants, type AnswerDetail } from './types';
import { rankHybrid } from './hybridSearch';

export interface SemanticCandidate {
  id: string;
  tabId: string;
  tabName: string;
  line: number;
  question: string;
  answer: string;
  variants?: AnswerVariants;
  kind: 'question' | 'excerpt';
  searchText: string;
}

const clean = (text: string) => visibleText(text).replace(/^\s*#{1,4}\s*/, '').trim();
const questionLike = (text: string) => /\?/.test(text) || /^Q(?:uestion)?\s*[:.)-]/i.test(text);
const english = (text: string) => /[A-Za-z]{2,}/.test(text);
const answerLabel = (text: string) => text.replace(/^A(?:nswer)?\s*[:.)-]\s*/i, '');
const chunk = (value: string, max = 520): string[] => {
  const words = value.split(/\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current.length + word.length + 1 > max) && current) { chunks.push(current); current = ''; }
    current = current ? current + ' ' + word : word.slice(0, max);
  }
  if (current) chunks.push(current);
  return chunks;
};

export function extractSemanticCandidates(tabs: readonly NoteTab[], includeExcerpts = true): SemanticCandidate[] {
  const result: SemanticCandidate[] = [];
  for (const tab of tabs) {
    const lines = tab.text.split('\n');
    for (let line = 0; line < lines.length; line++) {
      const text = clean(lines[line] ?? '');
      if (!english(text) || text.length < 9 || /^\s*#/.test(lines[line] ?? '')) continue;
      if (questionLike(text)) {
        const answers: string[] = [];
        const authored: Partial<Record<AnswerDetail, string[]>> = {};
        let target: AnswerDetail | 'base' = 'base';
        let lastAnswerLine = line;
        for (let n = line + 1; n < Math.min(lines.length, line + 30); n++) {
          const next = clean(lines[n] ?? '');
          if (/^\s*#/.test(lines[n] ?? '') || (next && questionLike(next))) break;
          if (!next) {
            if (answers.length || Object.keys(authored).length) break;
            continue;
          }
          const labelled = /^A_(SHORT|MEDIUM|DETAILED)\s*:\s*(.*)$/i.exec(next);
          let content = next;
          if (labelled) {
            target = labelled[1].toUpperCase() === 'SHORT' ? 'brief'
              : labelled[1].toUpperCase() === 'MEDIUM' ? 'normal' : 'complete';
            content = labelled[2];
          } else if (/^A(?:nswer)?\s*[:.)-]\s*/i.test(next)) {
            target = 'base';
            content = answerLabel(next);
          }
          if (target === 'base') answers.push(content);
          else (authored[target] ??= []).push(content);
          lastAnswerLine = n;
          if (answers.join(' ').length + Object.values(authored).flat().join(' ').length > 14000) break;
        }
        const variants: AnswerVariants = {};
        for (const mode of ['brief','normal','complete'] as const) {
          if (authored[mode]?.length) variants[mode] = authored[mode].join(' ').slice(0, 6000);
        }
        const answer = (answers.join(' ') || variants.complete || variants.normal || variants.brief || '').slice(0, 6000);
        const hasVariants = Object.values(variants).some(Boolean);
        const q = text.replace(/^Q(?:uestion)?\s*[:.)-]\s*/i, '');
        // Index the question alone and the question paired with short
        // chunks of its stored answer. All entries resolve to one source.
        result.push({ id: tab.id + ':' + line + ':q', tabId: tab.id, tabName: tab.name,
          line, question: text, answer, variants: hasVariants ? variants : undefined,
          kind: 'question', searchText: q.slice(0, 900) });
        if (answer) {
          const distinct = [...new Set([answer, ...Object.values(variants).filter((v): v is string => Boolean(v))])];
          const parts = distinct.flatMap(value => chunk(value)).slice(0, 15);
          parts.forEach((part, index) => {
            result.push({ id: tab.id + ':' + line + ':a' + index,
              tabId: tab.id, tabName: tab.name, line, question: text, answer,
              variants: hasVariants ? variants : undefined,
              kind: 'question', searchText: (q.slice(0, 240) + '\n' + part).slice(0, 1000) });
          });
        }
        line = lastAnswerLine;
      } else if (includeExcerpts && !/^A(?:nswer)?\s*[:.)-]/i.test(text)) {
        // Loose outline/notes are searchable too, but not presented as Q&A.
        for (const [i, part] of chunk(text, 520).slice(0, 5).entries()) {
          result.push({ id: tab.id + ':' + line + ':e' + i, tabId: tab.id, tabName: tab.name,
            line, question: text.slice(0, 700), answer: '', kind: 'excerpt', searchText: part });
        }
      }
    }
  }
  return result;
}

export function unitVector(values: readonly number[]): Float32Array {
  const result = Float32Array.from(values);
  let sum = 0;
  for (const value of result) {
    if (!Number.isFinite(value)) throw new Error('Non-finite embedding values');
    sum += value * value;
  }
  const scale = Math.sqrt(sum);
  if (scale <= 0) throw new Error('Empty embedding vector');
  for (let i = 0; i < result.length; i++) result[i] /= scale;
  return result;
}
export function similarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return -1;
  let score = 0;
  for (let i = 0; i < a.length; i++) score += a[i] * b[i];
  return score;
}

interface IndexedCandidate { entry: SemanticCandidate; vector: Float32Array }
export interface SemanticHit {
  tabId: string; tabName: string; line: number; text: string; answer: string;
  kind: 'question' | 'excerpt'; score: number;
  variants?: AnswerVariants;
  method?: 'hybrid' | 'semantic' | 'exact terms';
}

/** Locally persisted vector cache; never uploads notes or vectors. */
const DB = 'bestperformance-semantic-cache-v1';
const TABLE = 'embeddings';
let opened: Promise<IDBDatabase | null> | null = null;
let cacheGeneration = 0;
export async function clearSemanticCache(): Promise<void> {
  // Prevent earlier in-flight embedding batches from repopulating the cache.
  cacheGeneration++;
  // Do not delete an open IndexedDB database: WebView transactions can keep it
  // blocked. Clearing the object store is atomic and keeps the connection valid.
  const db = await database();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(TABLE, 'readwrite');
    transaction.objectStore(TABLE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Vector cache could not be cleared'));
    transaction.onabort = () => reject(new Error('Vector cache clearing was interrupted'));
  });
}
function database(): Promise<IDBDatabase | null> {
  if (opened) return opened;
  opened = new Promise(resolve => {
    if (!('indexedDB' in globalThis)) { resolve(null); return; }
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(TABLE)) request.result.createObjectStore(TABLE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return opened;
}
async function cacheRead(db: IDBDatabase | null, key: string): Promise<Float32Array | null> {
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const request = db.transaction(TABLE, 'readonly').objectStore(TABLE).get(key);
      request.onsuccess = () => {
        const data = request.result;
        resolve(data instanceof Float32Array ? data : data instanceof ArrayBuffer ? new Float32Array(data) : null);
      };
      request.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function cacheWrite(db: IDBDatabase | null, key: string, vector: Float32Array): Promise<void> {
  if (!db) return;
  return new Promise(resolve => {
    try {
      const transaction = db.transaction(TABLE, 'readwrite');
      transaction.objectStore(TABLE).put(vector, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch { resolve(); }
  });
}
// Hash index keys; do not store private Q&A text as database keys.
function hash(input: string): string {
  // Two independently seeded 32-bit hashes, minimizing accidental cache-key
  // collisions in large Q&A collections without storing source text as keys.
  let a = 2166136261;
  let b = 2246822519;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    a = Math.imul(a ^ code, 16777619);
    b = Math.imul(b ^ code, 1597334677);
  }
  return (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16) + ':' + input.length;
}

/** Fast, deterministic fingerprint of selected source texts and settings.
 * Changes on every note edit, tab rename, selection change, or model change.
 * Index caching still hashes each chunk separately, so only changed chunks are recomputed.
 */
export function semanticSourceSignature(
  tabs: readonly NoteTab[], endpoint: string, model: string,
  revision: number, includeExcerpts: boolean, modelIdentity = '',
): string {
  const parts = tabs.map(tab => hash(tab.id + '\0' + tab.name + '\0' + tab.text));
  return [endpoint, model, modelIdentity, revision, Number(includeExcerpts), ...parts].join('|');
}

export async function buildSemanticIndex(
  candidates: readonly SemanticCandidate[], endpoint: string, model: string,
  progress: (done: number, total: number, cached: number, generated: number, phase: 'checking-cache' | 'embedding' | 'complete') => void, cancelled: () => boolean,
  revision = 0, modelIdentity = model,
): Promise<IndexedCandidate[]> {
  const db = await database();
  const generation = cacheGeneration;
  const indexed: IndexedCandidate[] = [];
  let cachedCount = 0;
  let generatedCount = 0;
  progress(0, candidates.length, 0, 0, 'checking-cache');
  // Per batch: at most 24 input strings; responses validated in Tauri.
  for (let start = 0; start < candidates.length; start += 20) {
    if (cancelled() || generation !== cacheGeneration) throw new Error('cancelled');
    const slice = candidates.slice(start, start + 20);
    const vectors: Array<Float32Array | null> = [];
    const missing: { pos: number; text: string; key: string }[] = [];
    for (const [pos, item] of slice.entries()) {
      const key = 'v2:' + hash(endpoint + '\0' + model + '\0' + modelIdentity + '\0' + revision + '\0' + item.searchText);
      const cached = await cacheRead(db, key);
      vectors.push(cached);
      if (!cached) missing.push({ pos, key, text: item.searchText });
      else cachedCount++;
    }
    if (missing.length) {
      progress(indexed.length, candidates.length, cachedCount, generatedCount, 'embedding');
      const raw = await invoke<number[][]>('local_ollama_embed', {
        endpoint, model, texts: missing.map(row => row.text),
      });
      if (cancelled() || generation !== cacheGeneration) throw new Error('cancelled');
      if (raw.length !== missing.length) throw new Error('Embedding count mismatch');
      for (const [i, row] of missing.entries()) {
        const vector = unitVector(raw[i]);
        vectors[row.pos] = vector;
        await cacheWrite(db, row.key, vector);
        generatedCount++;
      }
    }
    if (cancelled() || generation !== cacheGeneration) throw new Error('cancelled');
    for (let i = 0; i < slice.length; i++) indexed.push({ entry: slice[i], vector: vectors[i]! });
    progress(indexed.length, candidates.length, cachedCount, generatedCount, 'complete');
  }
  progress(indexed.length, candidates.length, cachedCount, generatedCount, 'complete');
  return indexed;
}

export async function searchSemanticIndex(
  indexed: readonly IndexedCandidate[], query: string, endpoint: string, model: string,
  minimum: number, limit = 8,
): Promise<SemanticHit[]> {
  if (!indexed.length || !query.trim()) return [];
  const response = await invoke<number[][]>('local_ollama_embed', {
    endpoint, model, texts: [query.trim().slice(0, 1000)],
  });
  const vector = unitVector(response[0]);
  const ranked = rankHybrid(
    indexed.map(row => row.entry),
    indexed.map(row => similarity(vector, row.vector)), query, minimum, limit,
  );
  return ranked.map(({ entry, cosine, method }) => ({
    tabId: entry.tabId, tabName: entry.tabName, line: entry.line,
    text: entry.question, answer: entry.answer, variants: entry.variants, kind: entry.kind,
    score: cosine ?? 0, method,
  }));
}
