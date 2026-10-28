// Deterministic local smoke tests without cloud requests or private notes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const source = fs.readFileSync(path.join(import.meta.dirname, '../src/contextSearch.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
const requireLocal = name => {
  if (name !== './types') throw new Error('Unexpected import ' + name);
  return { visibleText: s => s.replace(/\{\{#[0-9a-fA-F]{6}\}\}|\{\{\/\}\}/g, '') };
};
new Function('require', 'module', 'exports', code)(requireLocal, module, module.exports);
const { findContextHits } = module.exports;

const tabs = [
  {
    id: 'qa', name: 'Competition Q&A', color: '#ffffff', readingMode: 'outline',
    text: [
      '# Questions',
      'Q: What happens if a supplier delivery is late?',
      'A: We verify dependencies and prepare a controlled recovery proposal for human approval.',
      '',
      'Q: How do you integrate with enterprise software?',
      'A: We work with ERP and relevant industry systems in a controlled deployment.',
      '',
      'Q: What evidence supports pilot readiness?',
      'A: We have implemented runtime and engineering tests, with controlled pilot readiness.',
    ].join('\n'),
  },
];
const hits = findContextHits(tabs, 'How do you respond when vendor shipments are delayed?');
assert.ok(hits.length > 0, 'Question retrieval must return a match');
assert.match(hits[0].question, /supplier delivery is late/, 'Synonym/paraphrase retrieval');
assert.match(hits[0].answer, /human approval/, 'Returns the actual stored answer');
assert.equal(hits[0].kind, 'question');
assert.ok(!hits.some(h => h.answer.includes('model invented')));
const integration = findContextHits(tabs, 'How is it connected to ERP and other company systems?');
assert.match(integration[0].question, /integrate with enterprise/);
assert.equal(findContextHits(tabs, 'quantum marshmallow banana telepathy').length, 0);
console.log('PASS: contextual retrieval, stored-answer integrity, no-match gate');
