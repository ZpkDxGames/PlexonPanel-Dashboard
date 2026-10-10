// One lightweight signed-fixture pass. No production identity or server action.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {createFleetFixture} from './support/fleet-fixture.mjs';
import {emptyControlState} from '../.test-dist/lib/control-state.js';
const task='mobile';
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

 result.firstScreen=[];
 const sections=['Overview','Performance','Players','Console','Chat','Plugins','Server','Backups','Configuration','Access','Audit','Settings'];
 for(const theme of ['light','dark'])for(const width of [360,390]){
  await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
  await page.evaluate(({theme,serverId})=>{localStorage.setItem('plexonpanel-ui-preferences-v1',JSON.stringify({schemaVersion:1,theme,accent:'monochrome',motion:'off',density:'compact',chartWindowMinutes:5,displayUpdateRateMs:500}));localStorage.setItem('plexonpanel-section:'+serverId,'Overview');},{theme,serverId:fixture.rooms[0].serverId});
  await page.reload();await page.getByRole('heading',{name:'Your servers',exact:true}).waitFor();await seed();await fixture.telemetry();await wait(800);
  const capture=async name=>{
   await page.evaluate(()=>document.fonts.ready);await wait(350);
   if(await page.getByRole('button',{name:'Dismiss notification',exact:true}).count())await page.getByRole('button',{name:'Dismiss notification',exact:true}).click();
   const measurements=await page.evaluate(()=>{
    const visible=n=>{const style=getComputedStyle(n),rect=n.getBoundingClientRect();return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&!n.closest('details:not([open]) :not(summary)')&&!n.closest('dialog:not([open])')&&!n.closest('[inert]');};
    const targetNodes=[...document.querySelectorAll('.deepslate button,.deepslate input:not([type=checkbox]),.deepslate textarea,.deepslate select,.deepslate a:not(.shell-skip),.deepslate summary')].filter(visible);
    const small=targetNodes.filter(n=>n.getBoundingClientRect().height<43.5).map(n=>({text:n.textContent?.slice(0,60)||n.getAttribute('aria-label'),height:n.getBoundingClientRect().height}));
    const workspace=document.querySelector('[data-ui6-workspace], [data-ui6-overview]');const header=workspace?.querySelector('.pp-page-header,.overview-heading')||workspace;
    const primary=workspace?.hasAttribute('data-ui6-overview') ? document.querySelector('.shell-page-heading button') : [...workspace?.querySelectorAll('.pp-button-primary')||[]].find(visible);
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,small,title:(document.querySelector('main h1')||header?.querySelector('h2'))?.getBoundingClientRect().bottom,status:header?.querySelector('p')?.getBoundingClientRect().bottom,primary:primary?.getBoundingClientRect().bottom};
   });
   assert.ok(measurements.scroll<=width,`${name} ${width}: page overflow`);assert.deepEqual(measurements.small,[],`${name}: 44 px targets`);
   {assert.ok(measurements.title<=900,`${name}: title in first screen`);assert.ok(measurements.status<=900,`${name}: status in first screen`);assert.ok(measurements.primary<=900,`${name}: primary action in first screen`);}
   result.firstScreen.push({name,theme,...measurements});const file=`${name.toLowerCase()}-${theme}-${width}.png`;await page.screenshot({path:output+'/'+file,fullPage:true});result.screenshots.push(file);
  };
  await capture('Fleet');await page.getByRole('button',{name:/Open PlexonCraft/}).click();await page.getByRole('heading',{name:'Overview',level:1,exact:true}).waitFor();
  for(const name of sections){if(name!=='Overview'){await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.locator('dialog.shell-drawer .shell-nav').getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name,level:1,exact:true}).waitFor();}await capture(name);}
 }
 result.keyboard.push('Actual drawer navigation through 13 workspaces at 360/390 in both themes; 44 px controls and first-screen anatomy checked');
 assert.equal(fixture.requests.filter(r=>/^(server\.(start|stop|restart)|console\.execute|files\.write|maintenance\.(full-backup\.create|settings\.update|restart\.now)|player\.)/.test(r.action)).length,0,'Verification never dispatches a mutation');
 assert.equal(result.errors.length,0,'Browser errors');result.status='passed';
}catch(error){result.status='failed';result.failure=error.stack;throw error;}
finally{await writeFile(`${output}/results.json`,JSON.stringify(result,null,2)+'\n');await writeFile(`${output}/server.log`,log);await browser?.close();server?.kill('SIGTERM');await fixture?.close();}
console.log(JSON.stringify(result));
