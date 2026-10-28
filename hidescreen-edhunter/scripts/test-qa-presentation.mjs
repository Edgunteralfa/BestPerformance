// Deterministic QA presentation regression tests. No Ollama calls or confidential notes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const file = path.join(import.meta.dirname, '../src/qaPresentation.ts');
const source = fs.readFileSync(file, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function('module', 'exports', compiled)(module, module.exports);
const { groupQaResults, qaHitKey, qaMainRejection, buildSingleQaEvidence } = module.exports;

const accepted = {
  tabId: 'qa', tabName: 'Differentiation', line: 12,
  text: 'What distinguishes B25 Plus from traditional ERP systems?',
  answer: 'B25 Plus coordinates governed cross-company execution.',
  variants: { brief: 'Governed execution beyond ERP.' },
  kind: 'question', score: 0.85, method: 'hybrid',
};
const pilot = {
  ...accepted, tabId: 'pilot', tabName: 'Pilots', line: 8,
  text: 'Do you already have completed industrial pilots?',
  answer: 'Engineering readiness does not constitute a completed pilot.',
  score: 0.69, method: 'semantic',
};
const borderline = {
  ...accepted, tabId: 'ip', tabName: 'IP', line: 9,
  score: 0.64, method: 'semantic',
};
const weak = {
  ...accepted, tabId: 'weak', tabName: 'Weak', line: 6,
  score: 0.57, method: 'semantic',
};
const lexical = {
  ...accepted, tabId: 'lexical', tabName: 'Other', line: 20,
  score: 0.90, method: 'exact terms',
};
const excerpt = {
  ...accepted, tabId: 'notes', tabName: 'Notes', line: 4,
  answer: '', kind: 'excerpt', score: 0.94, method: 'semantic',
};
const noAnswer = { ...accepted, tabId: 'missing', line: 4, answer: '' };

const group = groupQaResults([excerpt, accepted, lexical, weak], true, 0.52, 0.65);
assert.equal(group.primary, accepted, 'Only prepared Q&A with strong semantic match can be main');
assert.equal(group.alternatives.length, 3);
assert.ok(!group.alternatives.includes(accepted), 'Main must not duplicate in alternatives');
assert.equal(group.matchFloor, 0.65);

const pilotResult = groupQaResults([pilot], true, 0.52, 0.65);
assert.equal(pilotResult.primary, pilot, 'Regression: 0.69 semantic prepared Q&A must be main over 0.65');
assert.equal(pilotResult.alternatives.length, 0);
assert.equal(qaMainRejection(pilot, true, 0.65), null);
assert.equal(groupQaResults([borderline], true, 0.52, 0.65).primary, null);
assert.match(qaMainRejection(borderline, true, 0.65), /0.64.*0.65/);
assert.equal(groupQaResults([pilot], true, 0.52, 0.70).primary, null, 'Configurable main threshold');
assert.equal(groupQaResults([borderline], true, 0.52, 0.60).primary, borderline);
assert.equal(groupQaResults([pilot], true, 0.72, 0.65).primary, null, 'Retrieval floor overrides lower main floor');
assert.equal(groupQaResults([pilot], false, 0.52, 0.65).primary, null, 'Index not ready must not endorse');
assert.equal(groupQaResults([lexical], true, 0.52, 0.65).primary, null, 'Lexical-only must not be main');
assert.match(qaMainRejection(lexical, true, 0.65), /лексическое/);
assert.match(qaMainRejection(excerpt, true, 0.65), /фрагмент/);
assert.match(qaMainRejection(noAnswer, true, 0.65), /нет подготовленного ответа/);
assert.match(qaMainRejection(pilot, false, 0.65), /не готов/);
assert.equal(qaHitKey(accepted), qaHitKey({ tabId: 'qa', line: 12 }));

const evidence = buildSingleQaEvidence(accepted);
assert.match(evidence, /governed cross-company execution/i);
assert.match(evidence, /Governed execution beyond ERP/i);
assert.equal(buildSingleQaEvidence(excerpt), null);
console.log('PASS: separate retrieval/main thresholds, 0.69 regression, rejection diagnostics, source safety');
