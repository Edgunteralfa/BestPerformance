// Opt-in B25 experimental setting migration; snapshots entire old config before editing.
// Makes no changes to pitches, questions, API keys, source documents, or indexes.
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(process.env.APPDATA || '', 'com.hidescreen.app');
const file = path.join(base, 'config.json');
if (!fs.existsSync(file)) throw new Error('BestPerformance config not found');
const raw=fs.readFileSync(file,'utf8');
const doc=JSON.parse(raw);
if (!doc.semantic || typeof doc.semantic !== 'object') throw new Error('No semantic configuration');
const old=doc.semantic.model;
if (old === 'qwen3-embedding:0.6b') {
  console.log('EMBEDDING_ALREADY_CONFIGURED='+old);
  process.exit(0);
}
const backup=path.join(base,'config.pre-qwen06-20261027.json');
if (fs.existsSync(backup)) throw new Error('Backup exists; refusing to overwrite');
fs.writeFileSync(backup,raw,{encoding:'utf8',flag:'wx'});
doc.semantic.model='qwen3-embedding:0.6b';
doc.semantic.revision=Number.isFinite(doc.semantic.revision)?doc.semantic.revision+1:1;
const staging=file+'.b25new';
fs.writeFileSync(staging,JSON.stringify(doc,null,2),'utf8');
JSON.parse(fs.readFileSync(staging,'utf8'));
fs.renameSync(staging,file);
console.log(JSON.stringify({old,new:doc.semantic.model,backup,revision:doc.semantic.revision,pitches:Array.isArray(doc.pitchMemories)?doc.pitchMemories.length:null,tabs:Array.isArray(doc.tabs)?doc.tabs.length:null}));
