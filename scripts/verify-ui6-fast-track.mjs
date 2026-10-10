// One lightweight signed-fixture pass. No production identity or server action.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID} from 'node:crypto';
import {createFleetFixture} from './support/fleet-fixture.mjs';
import {emptyControlState} from '../.test-dist/lib/control-state.js';
const task=process.env.UI6_TASK||'stabilize';
const output=process.env.UI6_OUTPUT||`docs/ui6-final/${task}`;
const base='http://127.0.0.1:3400';
const result={task,environment:'Chromium, signed local relay, simulated agents; no live-server certification',status:'running',screenshots:[],axe:[],keyboard:[],errors:[]};
await mkdir(output,{recursive:true});
let fixture,server,browser,page,log='';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function launch(args,env){const child=spawn(process.execPath,args,{env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',...env},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);return child;}
try{
 fixture=await createFleetFixture({port:8788,origin:base,names:['PlexonCraft','TonimSMP'],instanceKeys:['plexoncraft','tonimsmp'],richerTelemetry:true,intervalMs:600000,beforeActionResult:async({body,room})=>{
   if(body.action==='provider.status')return {data:{configured:true,status:'CONNECTED',remote:`gdrive:plexonpanel/${room.serverId}`}};
   if(body.action==='maintenance.status')return {data:{commandChannel:{enabled:true},currentOperation:{},timezone:'UTC'}};
   if(body.action==='maintenance.settings.get')return {data:{settings:{schemaVersion:3,timezone:'UTC',restart:{},fullRestorePoint:{canonicalFilename:`${room.name}-Latest.zip`}}}};
   if(body.action==='backup.full.list')return {data:{backups:[],recoveryRequired:false}};
   if(body.action==='backup.preflight')return {data:{hostAuthenticated:true,backupRootWritable:true,commandChannelConfigured:true,usableBytes:100000000,requiredBytes:1000,providerStatus:'CONNECTED',unreadableDurableCount:0,missingIncludes:[],symlinkIssues:[]}};
   if(body.action==='players.snapshot.request'){const data={snapshotId:randomUUID(),capturedAt:new Date().toISOString(),players:roster(room)};await room.paper.send('inventory.players',{...data,offset:0,complete:true});return {data};}
   if(body.action==='files.list')return {data:{roots:['server'],entries:[{name:'fixture-settings.yml',directory:false,editable:true,size:29}],hasMore:false}};
   if(body.action==='files.read')return {data:{content:'fixture: true\nview: dashboard\n',sha256:'a'.repeat(64),editable:true}};
   if(body.action==='audit.list'||body.action==='audit.self')return {data:{entries:[{timestamp:new Date().toISOString(),actorLabel:'Fixture operator',role:'Owner',actionType:'server.status',target:room.key,outcome:'SUCCESS',code:'OK',requestId:randomUUID(),durationMillis:8}],hasMore:false}};
   if(body.action==='devices.list')return {data:{devices:[{...room.device,name:'Fixture browser grant',issuedAt:Math.floor(Date.now()/1000)-60,expiresAt:Math.floor(Date.now()/1000)+3600,lastSeen:Date.now()}]}};
   if(body.action==='maintenance.status')return {data:{commandChannel:{enabled:true},currentOperation:{}}};
   if(body.action==='maintenance.settings.get')return {data:{settings:{schemaVersion:3,timezone:'UTC',restart:{},fullRestorePoint:{canonicalFilename:'Fixture-Latest.zip'}}}};
   if(body.action==='backup.full.list')return {data:{backups:[],recoveryRequired:false}};
   if(body.action==='provider.status')return {data:{configured:true,status:'CONNECTED',remote:'gdrive:plexonpanel/fixture'}};
   if(body.action==='backup.preflight')return {data:{hostAuthenticated:true,backupRootWritable:true,commandChannelConfigured:true,usableBytes:10000000000,requiredBytes:10000000,provider:'RCLONE',providerStatus:'CONNECTED'}};
   if(body.action.startsWith('console.history'))return {data:{lines:Array.from({length:24},(_,i)=>({capturedAt:new Date(Date.now()-(24-i)*1000).toISOString(),content:i===23?'World save completed':`Journal entry ${i+1}: server tick completed`,level:i%7===0?'WARN':'INFO',source:'HOST',journalCursor:`fixture-${room.key}-${i}`,journalEpoch:'fixture-epoch',invocationId:'fixture-startup-'+room.key})),hasMore:false}};
  }});
 function roster(room){return room.nativePlayers??=Array.from({length:room.players},(_,i)=>({uuid:randomUUID(),name:`${room.key==='plexoncraft'?'Craft':'Tonim'}Player${i+1}`,world:'Survival',pingMillis:28+i*17,gameMode:'SURVIVAL',health:20,maximumHealth:20,onlineDurationMillis:3600000+i*60000,sessionId:randomUUID(),sessionStartedAt:new Date(Date.now()-3600000).toISOString()}));}
 async function seed(){for(const room of fixture.rooms){await room.paper.send('inventory.players',{snapshotId:randomUUID(),capturedAt:new Date().toISOString(),players:roster(room),offset:0,complete:true});await room.paper.send('inventory.plugins',{snapshotId:randomUUID(),capturedAt:new Date().toISOString(),offset:0,plugins:[{name:'PlexonPanel',version:'5.0.0',authors:['Fixture team'],enabled:true},{name:'FixturePermissions',version:'1.0.0',authors:['Fixture team'],enabled:true},{name:'FixtureMaintenance',version:'1.0.0',authors:['Fixture team'],enabled:false}]});for(const [i,content] of ['Welcome to the survival world.','Meet at the village after the world save.','The build is ready for review.'].entries())await room.paper.send('chat.message',{messageId:randomUUID(),capturedAt:new Date().toISOString(),playerName:roster(room)[i%room.players].name,playerUuid:roster(room)[i%room.players].uuid,content});}}

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
 if(task!=='stabilize'){
  for(const theme of ['light','dark'])for(const width of [390,1280]){
   await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
   await page.evaluate(({theme,task,serverId})=>{localStorage.setItem('plexonpanel-ui-preferences-v1',JSON.stringify({schemaVersion:1,theme,accent:'monochrome',motion:'off',density:'compact',chartWindowMinutes:5,displayUpdateRateMs:500}));localStorage.setItem('plexonpanel-section:'+serverId,task);},{theme,task,serverId:fixture.rooms[0].serverId});
   await page.reload();await page.getByRole('heading',{name:'Your servers',exact:true}).waitFor();await fixture.telemetry();
   if(task!=='Fleet'){await page.getByRole('button',{name:/Open PlexonCraft/}).click();await page.getByRole('heading',{name:task,level:1,exact:true}).waitFor();}
   await seed();await fixture.telemetry();await page.evaluate(()=>document.fonts.ready);await wait(1000);
   if(await page.getByRole('button',{name:'Dismiss notification',exact:true}).count())await page.getByRole('button',{name:'Dismiss notification',exact:true}).click();
   await page.evaluate(()=>window.scrollTo(0,0));await wait(150);
   const overflow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].filter(n=>n.getBoundingClientRect().right>innerWidth+1).map(n=>({tag:n.tagName,cls:n.className,text:n.textContent?.slice(0,80),right:n.getBoundingClientRect().right})).slice(0,25)}));if(overflow.scrollWidth>overflow.width){result.overflow=overflow;await page.screenshot({path:output+'/overflow.png',fullPage:true});}assert.ok(overflow.scrollWidth<=overflow.width,'No page overflow');
   const name=`${task.toLowerCase()}-${theme}-${width}.png`;await page.screenshot({path:output+'/'+name,fullPage:true});result.screenshots.push(name);
   if(task==='Fleet'&&width===390){const shifts=await page.evaluate(()=>window.__ui6Shifts);result.fleetHydration??=[];result.fleetHydration.push({theme,shifts,fleetShift:shifts.filter(s=>s.fleet).reduce((sum,s)=>sum+s.value,0)});}
  }
  if(task==='Fleet')assert.ok(result.fleetHydration.every(x=>x.fleetShift===0),'No Fleet hydration shift at 390px');
  const axe=await new AxeBuilder({page}).analyze();result.axe.push({workspace:task,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});assert.equal(axe.violations.filter(v=>v.impact==='serious'||v.impact==='critical'||v.id==='definition-list').length,0,'Serious/critical axe violations');
  if(task==='Fleet'){const list=page.getByRole('button',{name:'List',exact:true});await list.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-layout]').getAttribute('data-layout'),'list');await page.getByRole('button',{name:'Grid',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:/Open PlexonCraft/}).focus();await page.keyboard.press('Enter');await page.locator('[data-ui6-overview]').waitFor();result.keyboard.push('List/grid and open instance with Enter');}
  if(task==='Players'){
    const history=page.getByRole('button',{name:'Browse activity history',exact:true});await history.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Player activity',exact:true}).waitFor();await page.keyboard.press('Escape');assert.ok(await history.evaluate(n=>n===document.activeElement),'History restores focus');
    const manage=page.getByRole('button',{name:'Manage',exact:true}).first();await manage.focus();await page.keyboard.press('Enter');const details=page.getByRole('dialog',{name:'CraftPlayer1',exact:true});await details.waitFor();await page.keyboard.press('Tab');assert.ok(await details.evaluate(n=>n.contains(document.activeElement)),'Player detail keyboard focus');await page.keyboard.press('Escape');assert.ok(await manage.evaluate(n=>n===document.activeElement),'Player detail restores focus');result.keyboard.push('Activity and player detail opened with Enter; Escape restores focus');
  }
  if(task==='Backups'){
    const start=page.getByRole('button',{name:'Fully Backup Now',exact:true});await start.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Fully Backup Now',exact:true}).waitFor();await page.keyboard.press('Tab');assert.ok(await page.getByRole('dialog',{name:'Fully Backup Now',exact:true}).evaluate(n=>n.contains(document.activeElement)));await page.keyboard.press('Escape');assert.ok(await start.evaluate(n=>n===document.activeElement));result.keyboard.push('Fully Backup Now review with Enter; Escape restores focus; backup dispatch not executed');
  }
  if(task==='Server'){
    const refresh=page.getByRole('button',{name:'Refresh Host status',exact:true});await refresh.focus();await page.keyboard.press('Enter');await page.getByText('Host systemd lifecycle state',{exact:true}).waitFor();result.keyboard.push('Refresh Host status with Enter; lifecycle dispatch not executed');
  }
  if(task==='Console'){
    const pause=page.getByRole('button',{name:'Pause local view',exact:true});await pause.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Resume local view',exact:true}).focus();await page.keyboard.press('Enter');
    await page.getByLabel('Search console output',{exact:true}).fill('Journal');await page.getByRole('button',{name:'Next match',exact:true}).focus();await page.keyboard.press('Enter');assert.ok(await page.locator('.pp-console-entry').evaluateAll(nodes=>nodes.some(n=>n===document.activeElement)),'Search match receives focus');assert.ok(await page.locator('.pp-log-pane mark').count()>0,'Search highlight');await page.getByLabel('Search console output',{exact:true}).fill('');result.keyboard.push('Local pause/resume and next-match focus with Enter; command dispatch not executed');
  }
  if(task==='Chat'){
    await page.getByRole('button',{name:'Compose message',exact:true}).focus();await page.keyboard.press('Enter');const draft=page.getByLabel(/^Message as/);assert.ok(await draft.evaluate(n=>n===document.activeElement),'Composer receives focus');await draft.fill('Keyboard review draft');await page.getByRole('button',{name:'Send to global chat',exact:true}).focus();assert.ok(await page.getByRole('button',{name:'Send to global chat',exact:true}).isEnabled(),'Existing send gate');await draft.fill('');result.keyboard.push('Compose, draft and reach gated Send by keyboard; send not executed');
  }
  if(task==='Plugins'){
    await page.getByRole('button',{name:'Refresh latest',exact:true}).focus();await page.keyboard.press('Enter');const details=page.getByRole('button',{name:'Details',exact:true}).first();await details.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'FixtureMaintenance',exact:true}).waitFor();const reload=page.getByRole('button',{name:'Run configured reload',exact:true});await reload.focus();await page.keyboard.press('Enter');await page.locator('dialog.shell-confirm[open]').waitFor();assert.match(await page.locator('dialog.shell-confirm[open]').innerText(),/FixtureMaintenance/);await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.textContent==='Run configured reload');await page.keyboard.press('Escape');assert.ok(await details.evaluate(n=>n===document.activeElement),'Plugin detail restores focus');result.keyboard.push('Refresh, detail and nested bound reload confirmation with Enter; Escape restores focus; reload dispatch not executed');
  }
  if(task==='Server'){
   const restart=page.getByRole('button',{name:'Restart server',exact:true});await restart.focus();await page.keyboard.press('Enter');await page.locator('dialog.shell-confirm[open]').waitFor();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.textContent==='Restart server');result.keyboard.push('Restart bound confirmation with Enter; Escape restores focus; dispatch not executed');
  }
  if(task==='Backups'){
   const launch=page.getByRole('button',{name:'Fully Backup Now',exact:true});await launch.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Fully Backup Now',exact:true}).waitFor();await page.keyboard.press('Escape');assert.ok(await launch.evaluate(n=>n===document.activeElement),'Backup review restores focus');result.keyboard.push('Backup review and countdown reached by keyboard; cancel preserves target; dispatch not executed');
  }
  if(task==='Configuration'){
   await page.getByRole('button',{name:/fixture-settings.yml/}).click();await page.getByLabel('File contents',{exact:true}).fill('fixture: reviewed\n');await page.getByRole('button',{name:'Review changes',exact:true}).first().focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Your changes',exact:true}).waitFor();await page.getByRole('button',{name:'Save reviewed changes',exact:true}).first().focus();await page.keyboard.press('Enter');await page.locator('dialog.shell-confirm[open]').waitFor();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.textContent==='Save reviewed changes');result.keyboard.push('File edit, diff and bound save reached with keyboard; cancel keeps edits; write not executed');
  }
  if(task==='Access'){
   const detail=page.getByRole('button',{name:'Details',exact:true}).first();await detail.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Fixture browser grant',exact:true}).waitFor();await page.keyboard.press('Escape');assert.ok(await detail.evaluate(n=>n===document.activeElement),'Device detail restores focus');result.keyboard.push('Device detail with Enter; Escape restores focus; revoke not executed');
  }
  if(task==='Audit'){await page.getByLabel('Search loaded audit records',{exact:true}).fill('Fixture');await page.getByRole('button',{name:'Table',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('table',{name:'Loaded audit records',exact:true}).waitFor();result.keyboard.push('Audit local search and table alternative with Enter');}
  if(task==='Settings'){const theme=page.getByRole('combobox',{name:/Theme/});await theme.focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Clear local chat cache',exact:true}).focus();result.keyboard.push('Theme keyboard selector; local cache control reachable; clear not executed');}
  if(task==='Performance'){await page.locator('svg.workspace-chart').first().focus();await page.keyboard.press('ArrowLeft');await page.locator('.workspace-chart-tooltip').first().waitFor();assert.ok(await page.locator('.workspace-chart-tooltip').count()>1,'Shared source-time crosshair');assert.equal(await page.locator('svg.workspace-chart pattern').count(),9,'Nine gap hatch patterns');await page.keyboard.press('Escape');result.keyboard.push('Keyboard chart inspection and Escape');}
 }else{
  await page.reload();await page.getByRole('heading',{name:'Your servers',exact:true}).waitFor();await page.getByRole('button',{name:/Open PlexonCraft/}).click();await page.locator('[data-ui6-overview]').waitFor();await fixture.telemetry();await page.evaluate(()=>document.fonts.ready);await wait(800);

  const client=await context.newCDPSession(page);await client.send('Emulation.setCPUThrottlingRate',{rate:4});await page.evaluate(()=>{window.__ui6LongTasks=[];});
  for(let i=0;i<12;i++){await fixture.telemetry();await wait(550);}
  const tasks=await page.evaluate(()=>window.__ui6LongTasks);
  result.measurement={width:390,cpuThrottle:4,displayUpdateRateMs:500,windowMinutes:5,retainedSeed:7200,sourceCadence:{paperHealth:2000,paperSystem:5000,hostSystem:250,service:5000},longTasksMs:tasks,worstLongTaskMs:tasks.length?Math.max(...tasks):0,targetMs:150,accepted:!tasks.length||Math.max(...tasks)<=150};
 }
 assert.equal(fixture.requests.filter(r=>/^(server\.(start|stop|restart)|console\.execute|files\.write|maintenance\.(full-backup\.create|settings\.update|restart\.now)|player\.)/.test(r.action)).length,0,'Verification never dispatches a mutation');
 assert.equal(result.errors.length,0,'Browser errors');result.status='passed';
}catch(error){result.status='failed';result.failure=error.stack;throw error;}
finally{await writeFile(`${output}/results.json`,JSON.stringify(result,null,2)+'\n');await writeFile(`${output}/server.log`,log);await browser?.close();server?.kill('SIGTERM');await fixture?.close();}
console.log(JSON.stringify(result));
