// MIT License - Copyright (c) 2026 BestPerformance Contributors
import { visibleText, type NoteTab } from './types';

export interface ContextHit {
  tabId: string;
  tabName: string;
  line: number;
  question: string;
  answer: string;
  kind: 'question' | 'excerpt';
  score: number;
}

const STOP = new Set('a an the of for in on as it is are was were do does did how what why when where who which whether can could should would will with by from that this those these your our their you we they about to and or if at into its be been have has had me i my their tell explain describe please system solution project b25 plus'.split(' '));
const WORD = /[a-z][a-z0-9'-]*/g;
// Small domain vocabulary is a recall aid, not an embeddings model.
// Scores are suggestions, never verified facts or generated answers.
const SYNONYMS = [
  ['scale', 'scaling', 'scalability', 'expand', 'expansion', 'growth'],
  ['reliable', 'reliability', 'resilient', 'resilience', 'robust', 'robustness'],
  ['integrate', 'integration', 'interoperability', 'connect', 'connection', 'erp'],
  ['risk', 'risks', 'uncertainty', 'disruption', 'problem', 'failure'],
  ['late', 'delay', 'delayed', 'delays', 'lateness', 'slippage'],
  ['supplier', 'vendor', 'partner', 'contractor'],
  ['deliver', 'delivery', 'shipping', 'transport', 'shipment', 'logistics'],
  ['pilot', 'trial', 'validation', 'test', 'testing', 'evaluation'],
  ['security', 'secure', 'privacy', 'confidentiality', 'protection'],
  ['cost', 'price', 'expenses', 'budget', 'economics', 'pricing'],
  ['market', 'customer', 'clients', 'buyers', 'adoption'],
  ['evidence', 'proof', 'traceability', 'audit', 'auditability'],
  ['confidence', 'trust', 'trusted', 'verification', 'verified'],
  ['approve', 'approval', 'authorized', 'permission', 'human'],
  ['ready', 'readiness', 'prepared', 'preparation'],
];
const equivalents = new Map<string, string>();
for (const group of SYNONYMS) for (const word of group) equivalents.set(word, group[0]);

function canonical(word: string): string {
  const normalized = word.endsWith('ies') && word.length > 5 ? word.slice(0, -3) + 'y'
    : word.endsWith('ing') && word.length > 6 ? word.slice(0, -3)
    : word.endsWith('ed') && word.length > 5 ? word.slice(0, -2)
    : word.endsWith('s') && word.length > 4 ? word.slice(0, -1) : word;
  return equivalents.get(word) ?? equivalents.get(normalized) ?? normalized;
}
function tokens(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? [])
    .filter(t => !STOP.has(t) && t.length > 1)
    .map(canonical);
}
function scoreFor(query: string[], text: string): number {
  const candidate = tokens(text);
  if (!query.length || !candidate.length) return 0;
  const querySet = new Set(query);
  const candidateSet = new Set(candidate);
  let overlap = 0;
  for (const word of querySet) if (candidateSet.has(word)) overlap += 1;
  if (overlap === 0) return 0;
  const coverage = overlap / querySet.size;
  const precision = overlap / candidateSet.size;
  let neighbours = 0;
  for (let i = 1; i < query.length; i++) {
    if (candidate.includes(query[i - 1]) && candidate.includes(query[i])) neighbours++;
  }
  return coverage * 7 + precision * 2 + overlap * 0.7 + neighbours * 0.3;
}
function isQuestion(value: string): boolean {
  return /\?/.test(value) || /^(?:q(?:uestion)?\s*[:.)-]\s*)/i.test(value);
}
function plain(value: string): string {
  return visibleText(value).replace(/^\s*#{1,4}\s*/, '').trim();
}

/** Find existing English Q&A entries in active BP tabs. Never generate an answer. */
export function findContextHits(tabs: readonly NoteTab[], query: string, limit = 8): ContextHit[] {
  const terms = tokens(query.slice(0, 1300));
  if (terms.length === 0) return [];
  const results: ContextHit[] = [];
  for (const tab of tabs) {
    const lines = tab.text.split('\n');
    for (let index = 0; index < lines.length; index++) {
      const current = plain(lines[index]);
      if (!current || current.length < 8) continue;
      const question = isQuestion(current);
      const heading = /^\s*#\s/.test(lines[index]);
      if (heading && !question) continue;
      // A question gets its original adjacent answer, never a generated paraphrase.
      const answerLines: string[] = [];
      if (question) {
        for (let n = index + 1; n < Math.min(index + 10, lines.length); n++) {
          const next = plain(lines[n]);
          if (/^\s*#\s/.test(lines[n]) || (next && isQuestion(next))) break;
          if (!next) {
            if (answerLines.length) break;
            continue;
          }
          answerLines.push(next.replace(/^(?:a(?:nswer)?\s*[:.)-])\s*/i, ''));
          if (answerLines.join(' ').length > 1100) break;
        }
      }
      const relevance = scoreFor(terms, current);
      const answerRelevance = answerLines.length ? scoreFor(terms, answerLines.join(' ')) : 0;
      const score = relevance * (question ? 1.35 : 0.72) + answerRelevance * 0.22;
      if (score < 1.45) continue;
      results.push({
        tabId: tab.id, tabName: tab.name, line: index, question: current,
        answer: answerLines.join(' ').slice(0, 1000),
        kind: question ? 'question' : 'excerpt', score,
      });
    }
  }
  return results.sort((a, b) => b.score - a.score || a.tabName.localeCompare(b.tabName) || a.line - b.line).slice(0, Math.max(1, limit));
}
