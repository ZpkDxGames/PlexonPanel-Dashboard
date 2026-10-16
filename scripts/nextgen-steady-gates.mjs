import {readFile,writeFile} from 'node:fs/promises';
const inputs=['endurance',...Array.from({length:4},(_,i)=>`steady-repeat${i+2}`)],pairs=[];
let identity;
for(const input of inputs){const p=JSON.parse(await readFile(`artifacts/nextgen/${input}.json`,'utf8'));if(p.reports.length!==2)throw Error('Incomplete steady pair '+input);const key=JSON.stringify({browser:p.browser,sourceHeads:p.sourceHeads});if(identity&&identity!==key)throw Error('Steady source/browser identity changed');identity=key;pairs.push({input,baseline:p.reports.find(x=>x.label==='baseline').frameP95Ms,candidate:p.reports.find(x=>x.label==='candidate').frameP95Ms});}
const median=v=>[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)];
const baseline=median(pairs.map(x=>x.baseline)),candidate=median(pairs.map(x=>x.candidate)),limit=Math.max(25,baseline*1.1);
const result={...JSON.parse(identity),pairs,method:'First 60 seconds of the original 600-second mixed-source bound session plus four identical 60-second pairs; all five retained. Same Focus max(25ms,1.10×baseline) formula applied as a supplementary sustained gate.',baselineMedianP95Ms:baseline,candidateMedianP95Ms:candidate,limitMs:limit,changePercent:(candidate/baseline-1)*100,status:candidate<=limit?'PASS':'FAIL'};
await writeFile('artifacts/nextgen/steady-gates.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(result.status!=='PASS')process.exitCode=1;
