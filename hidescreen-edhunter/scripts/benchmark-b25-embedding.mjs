// Indicative synthetic B25-style Q&A retrieval test, NOT a production Recall@3 benchmark.
// Deliberately contains no proprietary mechanisms, documents, or internal data.
const candidates = [
'What engineering evidence validates the industrial AI runtime before a controlled pilot?',
'Which B25 software copyrights and intellectual property are registered?',
'How do you estimate TAM, SAM and SOM for the market?',
'Can you connect the platform to existing ERP, TMS and BIM systems?',
'How does human approval constrain governed AI execution?',
'What is your plan if suppliers delay deliveries?',
'How is the business model priced for customers?',
'Do you currently have paying production customers?',
'What experience does the technical team have?',
'What criteria will the competition judges assess?',
'What geographic market entry strategy will you pursue?',
'How do you distinguish verified, declared and observed information?',
'What actual industrial pilot outcomes have you measured?',
'How does the platform help organizations plan recovery from disruptions?',
'How do you protect unpublished invention novelty in public presentations?',
];
const tests = [
['Which tests prove the system is ready for a factory trial?',0],
['What software IP can the company document?',1],
['How large is the market opportunity and serviceable share?',2],
['Will it work with our existing enterprise systems?',3],
['Can the AI initiate actions without a human signing off?',4],
['What if our upstream deliveries run late?',5],
['Where does revenue come from and what do clients pay?',6],
['Have factories already purchased the product?',7],
['Why is this team technically qualified?',8],
['How are you judged in this contest?',9],
['Which markets will you expand into first?',10],
['How do you tell facts from participant claims or predictions?',11],
['Do you have any measured results from industrial deployment?',12],
['How would it help when workflows get disrupted?',13],
['How can you pitch without revealing the patented mechanisms?',14],
['请问你们已经获得工业试点的实际测量结果了吗？',12],
['请问你们公司的市场规模 TAM 和 SAM 是多少？',2]
];
const models=process.argv.slice(2).length?process.argv.slice(2):['qwen3-embedding:0.6b','b25-embedding:4b'];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.sqrt(dot(a,a))||1;
async function embed(model,inputs){
  const x=await fetch('http://127.0.0.1:11434/api/embed',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model,input:inputs,keep_alive:'15m',truncate:true,options:{num_ctx:4096}})
  });
  if(!x.ok) throw Error(model+' '+x.status+' '+await x.text());
  const json=await x.json();return json.embeddings;
}
for(const model of models){
  const start=Date.now();
  try{
    const docs=await embed(model,candidates),queries=await embed(model,tests.map(t=>t[0]));
    let top1=0,top3=0;const missed=[];
    for(let i=0;i<tests.length;i++){
      const ranks=docs.map((doc,j)=>({j,score:dot(doc,queries[i])/(norm(doc)*norm(queries[i]))}))
        .sort((a,b)=>b.score-a.score).map(x=>x.j);
      if(ranks[0]===tests[i][1])top1++;
      if(ranks.slice(0,3).includes(tests[i][1]))top3++;
      else missed.push({test:i,expected:tests[i][1],top3:ranks.slice(0,3)});
    }
    console.log(JSON.stringify({model,queries:tests.length,top1,top3,seconds:(Date.now()-start)/1000,missed}));
  }catch(e){console.error(model,e.message)}
}
