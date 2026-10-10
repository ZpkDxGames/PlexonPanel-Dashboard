// One lightweight signed-fixture pass. No production identity or server action.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID} from 'node:crypto';
import {createFleetFixture} from './support/fleet-fixture.mjs';
import {emptyControlState} from '../.test-dist/lib/control-state.js';
const task='Overview';
const output='docs/ui6-clock-resume/overview';
const base='http://127.0.0.1:3400';
const result={task,environment:'Chromium, signed local relay, simulated agents; no live-server certification',status:'running',screenshots:[],axe:[],keyboard:[],errors:[]};
await mkdir(output,{recursive:true});
let fixture,server,browser,page,log='';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function launch(args,env){const child=spawn(process.execPath,args,{env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',...env},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);return child;}
try{
 fixture=await createFleetFixture({port:8788,origin:base,names:['PlexonCraft','TonimSMP'],instanceKeys:['plexoncraft','tonimsmp'],richerTelemetry:true,intervalMs:600000,beforeActionResult:async({body,room})=>{
   if(body.action==='players.snapshot.request'){const data={snapshotId:randomUUID(),capturedAt:new Date().toISOString(),players:roster(room)};await room.paper.send('inventory.players',{...data,offset:0,complete:true});return {data};}
   if(body.action.startsWith('console.history'))return {data:{lines:Array.from({length:24},(_,i)=>({capturedAt:new Date(Date.now()-(24-i)*1000).toISOString(),content:i===23?'World save completed':`Journal entry ${i+1}: server tick completed`,level:i%7===0?'WARN':'INFO',source:'HOST',journalCursor:`fixture-${room.key}-${i}`,journalEpoch:'fixture-epoch',invocationId:'fixture-startup-'+room.key})),hasMore:false}};
  }});
 function roster(room){return room.nativePlayers??=Array.from({length:room.players},(_,i)=>({uuid:randomUUID(),name:`${room.key==='plexoncraft'?'Craft':'Tonim'}Player${i+1}`,world:'Survival',pingMillis:28+i*17,gameMode:'SURVIVAL',health:20,maximumHealth:20,onlineDurationMillis:3600000+i*60000,sessionId:randomUUID(),sessionStartedAt:new Date(Date.now()-3600000).toISOString()}));}


 if(task==='stabilize'){
  const build=launch(['node_modules/next/dist/bin/next','build'],{NEXT_PUBLIC_PLEXON_RELAY_URL:fixture.base});
  assert.equal(await new Promise(resolve=>build.on('exit',resolve)),0,'Measurement build');
 }
 server=launch(['node_modules/next/dist/bin/next',task==='stabilize'?'start':'dev','--hostname','127.0.0.1','--port','3400'],{NEXT_PUBLIC_PLEXON_RELAY_URL:fixture.base});
 let ready=false;for(let i=0;i<300;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}if(server.exitCode!==null)break;await wait(100);}assert.ok(ready,'Next started');
 browser=await chromium.launch({headless:true,executablePath:process.env.PLEXON_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-webgl','--disable-software-rasterizer']});
 const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 await page.addInitScript(()=>{window.__ui6Shifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__ui6Shifts.push({value:e.value,fleet:e.sources.some(s=>s.node?.closest?.('[data-ui6-workspace=Fleet]')),sources:e.sources.map(s=>({tag:s.node?.tagName,cls:s.node?.className,previous:s.previousRect.toJSON(),current:s.currentRect.toJSON()}))});}).observe({type:'layout-shift',buffered:true});window.__ui6LongTasks=[];new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__ui6LongTasks.push(entry.duration);}).observe({type:'longtask',buffered:true});});
 await page.goto(base);
 const end=Date.now();
 const history=Array.from({length:7200},(_,i)=>{const at=end-1800000+i*250;return {at,sources:{paperHealth:Math.floor(at/2000)*2000,paperSystem:Math.floor(at/5000)*5000,hostSystem:at,service:Math.floor(at/5000)*5000},tps:20,mspt:12,players:3,heap:2e9,hostCpu:35,processCpu:22,memory:8e9,serviceCpu:150,serviceMemory:4e9,gc:null};});
 await page.evaluate(async ({credentials,cache})=>{
  localStorage.setItem('plexonpanel-ui-preferences-v1',JSON.stringify({schemaVersion:1,theme:'dark',accent:'monochrome',motion:'off',density:'compact',chartWindowMinutes:5,displayUpdateRateMs:500}));
  await new Promise((resolve,reject)=>{const r=indexedDB.open('plexonpanel-browser-v3',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>{const db=r.result,tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace');for(const c of credentials)store.put(c,'credential:'+c.serverId);store.put(credentials[0].serverId,'selected');store.put(cache,'cache:'+cache.serverId);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
 },{credentials:fixture.credentials,cache:{...emptyControlState(fixture.rooms[0].serverId),history,updatedAt:end}});
 for(const state of ['healthy','skew','stopped'])for(const theme of ['light','dark'])for(const width of [390,1280]){
   await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
   await page.evaluate(({theme,serverId})=>{localStorage.setItem('plexonpanel-ui-preferences-v1',JSON.stringify({schemaVersion:1,theme,accent:'monochrome',motion:'off',density:'compact',chartWindowMinutes:5,displayUpdateRateMs:500}));localStorage.setItem('plexonpanel-section:'+serverId,'Overview');},{theme,serverId:fixture.rooms[0].serverId});
   await page.reload();await page.getByRole('heading',{name:'Your servers',exact:true}).waitFor();
   await page.getByRole('button',{name:/Open PlexonCraft/}).click();await page.locator('[data-ui6-overview]').waitFor();
   fixture.rooms[0].captureOffsetMs=state==='healthy'?0:-12000;await fixture.telemetry();await wait(700);
   await page.locator('summary').filter({hasText:'Tick history charts'}).click();
   await page.locator('summary').filter({hasText:'Source details and safe diagnostics'}).click();
   if(state==='stopped'){await page.evaluate(()=>{const real=Date.now;Date.now=()=>real()+31000;});await wait(1200);}
   const paper=page.locator('[data-instrument="tps"]');
   if(state==='healthy'){assert.equal(await paper.locator('strong').innerText(),'20.00');assert.doesNotMatch(await paper.innerText(),/clock skew/);}
   else {assert.match(await paper.innerText(),/clock skew \+12 s/);assert.match(await page.locator('.pp-chart').first().innerText(),/Clock skew/);assert.equal(await paper.locator('strong').innerText(),state==='stopped'?'—':'20.00');assert.match(await page.locator('.shell-health').innerText(),state==='stopped'?/telemetry unavailable/:/clock.*ahead/);}
   await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.scrollTo(0,0));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');
   const name=`overview-${state}-${theme}-${width}.png`;await page.screenshot({path:output+'/'+name,fullPage:true});result.screenshots.push(name);
   const axe=await new AxeBuilder({page}).analyze();result.axe.push({state,theme,width,violations:axe.violations.map(v=>({id:v.id,impact:v.impact}))});assert.equal(axe.violations.filter(v=>v.impact==='serious'||v.impact==='critical').length,0,'Serious/critical axe violations');
 }
 assert.equal(fixture.requests.filter(r=>/^(server\.(start|stop|restart)|console\.execute|files\.write|maintenance\.(full-backup\.create|settings\.update|restart\.now)|player\.)/.test(r.action)).length,0,'Verification never dispatches a mutation');
 assert.equal(result.errors.length,0,'Browser errors');result.status='passed';
}catch(error){result.status='failed';result.failure=error.stack;throw error;}
finally{await writeFile(`${output}/results.json`,JSON.stringify(result,null,2)+'\n');await writeFile(`${output}/server.log`,log);await browser?.close();server?.kill('SIGTERM');await fixture?.close();}
console.log(JSON.stringify(result));
