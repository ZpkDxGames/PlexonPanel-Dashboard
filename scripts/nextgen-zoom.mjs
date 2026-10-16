import {firefox,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),base='http://127.0.0.1:4173';
const b=await firefox.launch(),c=await b.newContext({viewport:{width:640,height:1600},reducedMotion:'reduce'});
await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
await c.addInitScript(()=>localStorage.setItem('plexon:preferences',JSON.stringify({motion:'off',skinProvider:'disabled'})));
const p=await c.newPage(),results=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
await mkdir('artifacts/nextgen',{recursive:true});
let report;
try {
 await p.goto(`${base}/?fixture=healthy#Overview`);await p.locator('.overview-grid').waitFor();
 const read=()=>p.evaluate(()=>({dpr:devicePixelRatio,innerWidth,innerHeight,visualScale:visualViewport.scale}));
 const before=await read(),steps=[];
 for(let i=0;i<8;i++){await p.keyboard.press('Control+=');await p.waitForTimeout(100);steps.push(await read());if(steps.at(-1).dpr/before.dpr>=1.99)break;}
 const after=await read();
 if(Math.abs(after.dpr/before.dpr-2)>.02||Math.abs(after.innerWidth-before.innerWidth/2)>1){
  report={status:'BLOCKED',sourceHead,browser:b.version(),method:'Native Control+= browser shortcut only; no CSS zoom, deviceScaleFactor or page-scale substitution',before,steps,after,reason:'Headless keyboard routing did not establish a verified native 200% browser zoom'};
 }else{
  await mkdir('artifacts/nextgen/zoom',{recursive:true});
  for(const theme of ['dark','light'])for(const route of ['Fleet','Overview','Performance','Players','Console','Backups','Access','Settings']){
   await p.evaluate(async({route,theme})=>{const{preferences}=await import('/src/store/preferences.ts');preferences.update({theme});location.hash=route;},{route,theme});
   await p.locator('.route-skeleton').waitFor({state:'detached'});await p.locator('.workspace-heading h1').waitFor();await p.evaluate(()=>document.fonts.ready);
   const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),violations=(await new AxeBuilder({page:p}).analyze()).violations.map(v=>v.id);expect(overflow).toBe(false);expect(violations).toEqual([]);
   await p.screenshot({path:`artifacts/nextgen/zoom/${route.toLowerCase()}-native-200pct-${theme}.png`});results.push({route,theme,overflow,violations,metrics:await read()});
  }
  expect(errors).toEqual([]);report={status:'PASS',sourceHead,browser:b.version(),before,after,method:'Native Control+= browser shortcut verified by doubled DPR and halved CSS viewport',results,errors};
 }
}finally{await writeFile('artifacts/nextgen/actual-zoom.json',JSON.stringify(report??{status:'FAIL',sourceHead,results,errors},null,2));await b.close();}
console.log(JSON.stringify({status:report.status,reason:report.reason,cases:results.length}));
