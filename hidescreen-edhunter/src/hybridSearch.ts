// MIT License - Copyright (c) 2026 BestPerformance Contributors
// Hybrid local ranking: cosine embeddings + document-frequency-aware BM25.
// No generative requests or external retrieval; always return the original note.
import type { SemanticCandidate } from './semanticSearch';

export interface RankedEntry {
  entry: SemanticCandidate;
  cosine: number | null;
  method: 'hybrid' | 'semantic' | 'exact terms';
  rankScore: number;
}

const STOP = new Set('a an the of for in on as it is are was were do does did how what why when where who which whether can could should would will with by from that this those these your our their you we they about to and or if at into its be been have has had me i my tell explain describe please'.split(' '));
export function words(value: string): string[] {
  return (value.toLowerCase().match(/[a-z][a-z0-9'-]*/g) ?? [])
    .filter(w => w.length > 1 && !STOP.has(w))
    .map(w => w.length > 5 && w.endsWith('ies') ? w.slice(0, -3) + 'y'
      : w.length > 5 && w.endsWith('ing') ? w.slice(0, -3)
      : w.length > 5 && w.endsWith('ed') ? w.slice(0, -2)
      : w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w);
}
function bm25Scores(items: readonly SemanticCandidate[], question: string): Array<{ id: string; score: number; hits: number }> {
  const query = [...new Set(words(question))];
  if (!query.length || !items.length) return [];
  const documents = items.map(item => words(item.searchText));
  const avgLength = documents.reduce((sum, item) => sum + item.length, 0) / documents.length || 1;
  const idf = new Map<string, number>();
  for (const token of query) {
    let df = 0;
    for (const doc of documents) if (doc.includes(token)) df++;
    idf.set(token, Math.log(1 + (items.length - df + 0.5) / (df + 0.5)));
  }
  return documents.map((doc, i) => {
    const counts = new Map<string, number>();
    for (const word of doc) counts.set(word, (counts.get(word) ?? 0) + 1);
    let score = 0;
    let hits = 0;
    for (const word of query) {
      const tf = counts.get(word) ?? 0;
      if (!tf) continue;
      hits++;
      const normalization = 1.2 * (0.25 + 0.75 * doc.length / avgLength);
      score += (idf.get(word) ?? 0) * (tf * 2.2) / (tf + normalization);
    }
    return { id: items[i].id, score, hits };
  });
}

/** RRF gives independent semantic and lexical matches comparable rank units.
 * Similarity remains displayed as a cosine, never as factual confidence.
 */
export function rankHybrid(
  candidates: readonly SemanticCandidate[],
  cosineScores: readonly number[],
  query: string,
  minimum: number,
  limit = 8,
): RankedEntry[] {
  if (candidates.length !== cosineScores.length) throw new Error('Hybrid score dimension mismatch');
  const lexical = bm25Scores(candidates, query);
  const wordCount = new Set(words(query)).size;
  // For an actual sentence, demand two significant terms for lexical-only
  // matches; exact one-term matching remains available via the legacy search.
  const requiredHits = Math.min(2, wordCount);
  const dense = cosineScores
    .map((score, index) => ({ index, score }))
    .filter(item => Number.isFinite(item.score) && item.score >= minimum)
    .sort((a, b) => b.score - a.score)
    .slice(0, 45);
  const sparse = lexical.map((item, index) => ({ ...item, index }))
    .filter(item => item.hits >= requiredHits && item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 45);

  const scores = new Map<number, { rankScore: number; dense: boolean; lexical: boolean }>();
  const add = (index: number, rank: number, weight: number, source: 'dense' | 'lexical') => {
    const old = scores.get(index) ?? { rankScore: 0, dense: false, lexical: false };
    old.rankScore += weight / (35 + rank + 1);
    old[source] = true;
    scores.set(index, old);
  };
  dense.forEach((item, rank) => add(item.index, rank, 0.7, 'dense'));
  sparse.forEach((item, rank) => add(item.index, rank, 0.3, 'lexical'));
  const grouped = new Map<string, RankedEntry>();
  for (const [index, result] of scores) {
    const entry = candidates[index];
    const key = entry.tabId + ':' + entry.line;
    const combined: RankedEntry = {
      entry,
      cosine: result.dense ? cosineScores[index] : null,
      method: result.dense && result.lexical ? 'hybrid' : result.dense ? 'semantic' : 'exact terms',
      rankScore: result.rankScore * (entry.kind === 'question' ? 1.07 : 0.82),
    };
    const old = grouped.get(key);
    if (!old || combined.rankScore > old.rankScore) grouped.set(key, combined);
  }
  return [...grouped.values()]
    .sort((a, b) => b.rankScore - a.rankScore || a.entry.id.localeCompare(b.entry.id))
    .slice(0, Math.max(1, limit));
}
