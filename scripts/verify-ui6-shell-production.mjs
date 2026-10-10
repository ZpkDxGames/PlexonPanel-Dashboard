import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile,readdir,mkdir,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createFleetFixture } from './support/fleet-fixture.mjs';
const base='http://127.0.0.1:3430',out=process.env.UI6_OUTPUT||'artifacts/ui6-m3/m3b';await mkdir(out,{recursive:true});
const result={buildExecuted:process.env.UI6_SKIP_BUILD!=='true',recordedAt:new Date().toISOString(),samples:[],errors:[]};let fixture,server,browser,log='',buildLog='';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 fixture=await createFleetFixture({port:8788,origin:base,names:['PlexonCraft','TonimSMP'],richerTelemetry:true});
 if(process.env.UI6_SKIP_BUILD !== 'true') {
 const build=spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{env:{...process.env,NEXT_PUBLIC_PLEXON_RELAY_URL:fixture.base,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});build.stdout.on('data',d=>buildLog+=d);build.stderr.on('data',d=>buildLog+=d);const exit=await new Promise((resolve,reject)=>{build.on('close',resolve);build.on('error',reject);});result.buildExitCode=exit;assert.equal(exit,0,'Production build');
 }
 console.log('Build complete');
 result.buildId=(await readFile('.next/BUILD_ID','utf8')).trim();
 const chunks=[];for(const file of await readdir('.next/static/chunks'))if(file.endsWith('.js'))chunks.push({url:'/_next/static/chunks/'+file,source:await readFile('.next/static/chunks/'+file,'utf8')});
 const workspaceStyles=[];for(const file of await readdir('.next/static/chunks'))if(file.endsWith('.css')&&(await readFile('.next/static/chunks/'+file,'utf8')).includes('.fleet-card'))workspaceStyles.push('/_next/static/chunks/'+file);result.workspaceStyles=workspaceStyles;assert.ok(workspaceStyles.length);
 const workspaceOwner=chunks.find(c=>c.source.includes('PLEXON_UI6_LEGACY_WORKSPACE_CHUNK'));assert.ok(workspaceOwner);
 result.workspaceOwnerUrl=workspaceOwner.url;
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3430'],{env:{...process.env,NEXT_PUBLIC_PLEXON_RELAY_URL:fixture.base},stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
 let ready=false;for(let i=0;i<200;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}if(server.exitCode!==null)break;await delay(100);}assert.ok(ready);
 browser=await chromium.launch({headless:true,executablePath:process.env.PLEXON_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-webgl','--disable-software-rasterizer']});
 const context=await browser.newContext({reducedMotion:'reduce'}), page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 console.log('Server ready');
 await page.goto(base);await page.getByRole('heading',{name:'Pair this browser',exact:true}).waitFor();
 await page.evaluate(async credentials=>{await new Promise((resolve,reject)=>{const r=indexedDB.open('plexonpanel-browser-v3',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>{const db=r.result,tx=db.transaction('workspace','readwrite');for(const c of credentials)tx.objectStore('workspace').put(c,'credential:'+c.serverId);tx.objectStore('workspace').put(credentials[0].serverId,'selected');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},fixture.credentials);
 await page.addInitScript(()=>{window.__ui6Shifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.__ui6Shifts.push({time:e.startTime,value:e.value,recentInput:e.hadRecentInput,sources:e.sources.map(s=>({tag:s.node?.tagName,classes:s.node?.className,previous:s.previousRect.toJSON(),current:s.currentRect.toJSON()}))});}).observe({type:'layout-shift',buffered:true});});
 const client=await context.newCDPSession(page);await client.send('Network.enable');await client.send('Network.setCacheDisabled',{cacheDisabled:true});
 let network=[];client.on('Network.requestWillBeSent',e=>{network.push({url:e.request.url,epochMs:e.wallTime*1000,type:e.type});});
 for(const theme of ['light','dark'])for(const width of [390,1280]){
  await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme});await page.evaluate(theme=>localStorage.setItem('plexonpanel-ui-preferences-v1',JSON.stringify({schemaVersion:1,theme,motion:'off'})),theme);
  network=[];let release,seen,handled;const continued=new Promise(resolve=>{handled=resolve;});const barrier=new Promise(resolve=>{release=resolve;});const encountered=new Promise(resolve=>{seen=resolve;});
  await page.route('**'+workspaceOwner.url,async route=>{seen();await barrier;await route.continue();handled();});
  console.log('Measuring '+theme+' '+width);
  await page.reload({waitUntil:'domcontentloaded'});await Promise.race([encountered,delay(15000).then(()=>{throw new Error('Workspace interception timeout');})]);await page.locator('[data-ui6-shell]').waitFor();
  assert.equal(await page.locator('[data-ui6-legacy-mounted]').count(),0);
  const order=await page.evaluate(()=>({timeOrigin:performance.timeOrigin,shellMark:performance.getEntriesByName('ui6-shell-painted').at(-1)?.startTime,frameVisible:document.querySelector('.shell-header').getBoundingClientRect().height>0,workspacePresent:Boolean(document.querySelector('[data-ui6-legacy-mounted]')),paint:performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime}))}));
  const entry=network.find(e=>e.url.endsWith(workspaceOwner.url));assert.ok(entry&&order.shellMark!==undefined);assert.ok(entry.epochMs-order.timeOrigin>=order.shellMark-2,'Workspace request must follow painted shell');assert.ok(order.frameVisible);
  assert.ok(!network.filter(e=>workspaceStyles.some(url=>e.url.endsWith(url))).some(e=>e.epochMs-order.timeOrigin<order.shellMark-2),'Legacy CSS must follow shell paint too');
  await page.waitForTimeout(250);await page.screenshot({path:join(out,`production-shell-before-workspace-${theme}-${width}.png`),fullPage:true});
  const shellShifts=await page.evaluate(()=>window.__ui6Shifts);release();await continued;await page.unroute('**'+workspaceOwner.url);await page.getByRole('heading',{name:'Your servers',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1200);
  const metrics=await page.evaluate(()=>({shifts:window.__ui6Shifts,paint:performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime})),resources:performance.getEntriesByType('resource').filter(e=>e.initiatorType==='script'||e.name.includes('.woff2')).map(e=>({url:e.name,start:e.startTime,end:e.responseEnd,size:e.transferSize})),fontStack:getComputedStyle(document.querySelector('h1')).fontFamily}));
  const cls=shifts=>{let max=0,sum=0,start=-Infinity,last=-Infinity;for(const e of shifts.filter(e=>!e.recentInput)){if(e.time-last>1000||e.time-start>5000){sum=0;start=e.time;}sum+=e.value;last=e.time;max=Math.max(max,sum);}return max;};
  const stylesheetRequests=network.filter(e=>workspaceStyles.some(url=>e.url.endsWith(url))).map(e=>({url:e.url,start:e.epochMs-order.timeOrigin}));assert.ok(stylesheetRequests.length,'Deferred legacy CSS must actually load');
  result.samples.push({theme,width,cacheDisabled:true,order,stylesheetRequests,workspaceRequestStart:entry.epochMs-order.timeOrigin,shellCLS:cls(shellShifts),shellAndLegacyFleetCLS:cls(metrics.shifts),...metrics});
 }
 assert.equal(result.errors.length,0);result.status='passed';
}catch(error){result.failure=String(error);throw error;}finally{
 await writeFile(join(out,'production-shell.json'),JSON.stringify(result,null,2));await writeFile(join(out,'production-build.txt'),buildLog);await writeFile(join(out,'production-server.txt'),log);await browser?.close();server?.kill();await fixture?.close();
}
console.log(JSON.stringify({status:result.status,samples:result.samples.map(s=>({theme:s.theme,width:s.width,shellCLS:s.shellCLS,fleetCLS:s.shellAndLegacyFleetCLS,mark:s.order.shellMark,workspaceRequest:s.workspaceRequestStart}))}));
