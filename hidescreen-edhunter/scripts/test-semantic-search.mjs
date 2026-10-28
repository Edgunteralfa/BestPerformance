// MIT License - Copyright (c) 2026 BestPerformance Contributors
// Tests use synthetic demo questions; no private notes leave the device.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const source = fs.readFileSync(path.join(import.meta.dirname, '../src/semanticSearch.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
const invoke = async (command, args) => {
  assert.equal(command, 'local_ollama_embed');
  const endpoint = args.endpoint;
  assert.equal(endpoint, 'http://127.0.0.1:11434');
  const response = await fetch(endpoint + '/api/embed', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: args.model, input: args.texts, keep_alive: '15m' }),
  });
  if (!response.ok) throw new Error('Ollama returned HTTP ' + response.status);
  return (await response.json()).embeddings;
};
const hybridModule = { exports: {} };
const hybridSource = fs.readFileSync(path.join(import.meta.dirname, '../src/hybridSearch.ts'), 'utf8');
const hybridCode = ts.transpileModule(hybridSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('require','module','exports',hybridCode)(() => ({}), hybridModule, hybridModule.exports);
const { rankHybrid } = hybridModule.exports;
const requireLocal = name => {
  if (name === './hybridSearch') return hybridModule.exports;
  if (name === './types') return { visibleText: s => s.replace(/\{\{#[0-9a-fA-F]{6}\}\}|\{\{\/\}\}/g, '') };
  if (name === '@tauri-apps/api/core') return { invoke };
  throw new Error('Unexpected import ' + name);
};
new Function('require','module','exports',code)(requireLocal,module,module.exports);
const { extractSemanticCandidates, buildSemanticIndex, searchSemanticIndex, semanticSourceSignature, similarity, unitVector } = module.exports;

const tabs = [{ id:'demo', name:'English Q&A', readingMode:'outline', color:'#fff', text: [
  '# Jury Questions',
  'Q: How do you manage a late delivery by suppliers?',
  'A: We assess the disruption and propose a controlled plan, with human approval.',
  '',
  'Q: How will your product integrate with existing enterprise systems?',
  'A: The implementation supports integration with ERP and relevant industrial systems.',
  '',
  'Q: What is your business model in the Chinese market?',
  'A: We would validate commercial demand through a controlled industrial pilot.',
].join('\n') }];
// Scope and content fingerprint checks: edits inside the selected pitch or Q&A
// must invalidate the index. Unselected tabs must not change its signature.
const pitch = {
  id: 'pitch', name: 'Pitch Deck', readingMode: 'outline', color: '#eee',
  text: '# Market\nWe provide reliable industrial coordination solutions and readiness checks.',
};
const baseScope = semanticSourceSignature(tabs, 'http://127.0.0.1:11434', 'b25-embedding:4b', 0, true, 'digest-v1');
const changedQuestion = [{ ...tabs[0], text: tabs[0].text.replace('late delivery', 'disrupted delivery') }];
assert.notEqual(baseScope, semanticSourceSignature(changedQuestion, 'http://127.0.0.1:11434', 'b25-embedding:4b', 0, true, 'digest-v1'));
assert.equal(baseScope, semanticSourceSignature(tabs, 'http://127.0.0.1:11434', 'b25-embedding:4b', 0, true, 'digest-v1'));
assert.notEqual(baseScope, semanticSourceSignature(tabs, 'http://127.0.0.1:11434', 'b25-embedding:4b', 0, true, 'digest-v2'));
assert.notEqual(baseScope, semanticSourceSignature(tabs, 'http://127.0.0.1:11434', 'other:embedding', 0, true, 'digest-v1'));
assert.notEqual(baseScope, semanticSourceSignature([...tabs, pitch], 'http://127.0.0.1:11434', 'b25-embedding:4b', 0, true, 'digest-v1'));
assert(extractSemanticCandidates([pitch], true).length > 0);
assert.equal(extractSemanticCandidates([pitch], false).length, 0, 'Q&A-only mode must exclude pitch excerpts');
assert(!extractSemanticCandidates(tabs, false).some(c => c.kind === 'excerpt'), 'Q&A-only includes answer chunks but not standalone excerpts');
const candidates = extractSemanticCandidates(tabs);
const authoredTab = { ...tabs[0], id: 'authored', text: [
  'Q: How do you check an industrial pilot?',
  'A_SHORT: We verify readiness.',
  'A_MEDIUM: We verify pilot readiness with controlled engineering tests.',
  'A_DETAILED: We validate the controlled pre-pilot runtime and review engineering evidence before human approval.',
  '',
  'Q: What comes next?',
  'A: Controlled industrial validation.',
].join('\n') };
const authored = extractSemanticCandidates([authoredTab]);
const authoredQ = authored.find(item => item.question.includes('industrial pilot?') && item.id.endsWith(':q'));
assert.ok(authoredQ, 'Should index prepared three-length answer cards');
assert.equal(authoredQ.variants.brief, 'We verify readiness.');
assert.match(authoredQ.variants.normal, /engineering tests/);
assert.match(authoredQ.variants.complete, /human approval/);
assert.equal(authoredQ.answer, authoredQ.variants.complete);
assert.equal(authored.find(item => item.question.includes('What comes next?') && item.id.endsWith(':q')).answer, 'Controlled industrial validation.');
assert.equal(authored.filter(item => item.kind === 'question').length > 2, true, 'Versioned answer text is also indexed for retrieval');
const direct = rankHybrid(candidates, candidates.map(() => 0.01), 'supplier delivery delayed', 0.55);
assert(direct.some(result => /supplier/i.test(result.entry.question)), 'BM25 must rescue exact question terms below dense threshold');
assert(direct.every(result => ['hybrid', 'semantic', 'exact terms'].includes(result.method)));
assert.equal(rankHybrid(candidates, candidates.map(() => 0.01), 'quantum banana unrelated', 0.55).length, 0, 'No spurious unrelated candidate');
const fused = rankHybrid(candidates, candidates.map((_, index) => index === 0 ? 0.9 : 0.01), 'supplier delivery delayed', 0.55);
assert(fused.some(hit => hit.method === 'hybrid' || hit.method === 'semantic'), 'Dense candidates must remain available');
assert(candidates.length >= 6, 'Q&A question and answer chunks should be indexed');
let progress = 0;
let lastCached = 0;
let lastGenerated = 0;
let lastPhase = '';
const start = performance.now();
const vectors = await buildSemanticIndex(candidates, 'http://127.0.0.1:11434',
  'b25-embedding:4b', (done, total, cached, generated, phase) => {
    assert(done <= total, 'Index progress must never exceed total');
    progress = done;
    lastCached = cached;
    lastGenerated = generated;
    lastPhase = phase;
  }, () => false);
assert.equal(progress, candidates.length);
assert.equal(lastCached + lastGenerated, candidates.length, 'Progress must account for every embedding');
assert.equal(lastPhase, 'complete', 'Progress must end in completed state');
assert.equal(vectors[0].vector.length, 2560);
assert(Math.abs(similarity(unitVector([3,4]),unitVector([3,4]))-1)<1e-6);
const results = await searchSemanticIndex(vectors,
  'How do you respond when vendors cannot deliver materials on time?',
  'http://127.0.0.1:11434', 'b25-embedding:4b', 0.45);
assert(results.length >= 1,'Expected a relevant result');
assert.match(results[0].text,/late delivery/i);
assert.match(results[0].answer,/human approval/,'Only exact stored answer must be shown');
assert(['hybrid','semantic','exact terms'].includes(results[0].method));
const elapsed = Math.round(performance.now()-start);
console.log('PASS: Q&A chunk extraction, embedding vectors=' + vectors.length +
  ', dimensions=' + vectors[0].vector.length + ', closest=' + results[0].text +
  ', score=' + results[0].score.toFixed(3) + ', elapsed_ms=' + elapsed);
