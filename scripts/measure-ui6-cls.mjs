// Cold, deliberately delayed webfont measurement. Fixture-only; no remote account.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createFleetFixture } from './support/fleet-fixture.mjs';
const production = process.env.UI6_MODE === 'production';
const out = process.env.UI6_OUTPUT || 'artifacts/ui6-m3/followups';
const stage = process.env.UI6_CLS_STAGE || 'before';
const base = 'http://127.0.0.1:3400';
await mkdir(out, { recursive: true });
let browser, server, fixture, log = '';
const samples = [];
try {
  fixture = await createFleetFixture({port:8788, origin:base});
  if (production) {
    const build = spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{env:{...process.env,NEXT_PUBLIC_PLEXON_RELAY_URL:fixture.base,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
    let transcript='';build.stdout.on('data',d=>transcript+=d);build.stderr.on('data',d=>transcript+=d);
    const code=await new Promise((resolve,reject)=>{build.on('error',reject);build.on('close',resolve);});
    await writeFile(join(out,`cls-${stage}-build.txt`),transcript);
    if(code!==0)throw new Error('Fixture production build failed: '+code);
  }
  server=spawn(process.execPath,['node_modules/next/dist/bin/next',production?'start':'dev','--hostname','127.0.0.1','--port','3400'],{env:{...process.env,NEXT_PUBLIC_PLEXON_RELAY_URL:fixture.base,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
  let ready=false;for(let i=0;i<200;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}if(server.exitCode!==null)break;await new Promise(r=>setTimeout(r,100));}
  if(!ready)throw new Error('Next unavailable: '+log);
  browser=await chromium.launch({headless:true,executablePath:process.env.PLEXON_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-webgl','--disable-software-rasterizer']});
  const context=await browser.newContext({reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    window.__ui6Shifts=[];window.__ui6FontsBefore=[];
    new PerformanceObserver(list=>{for(const e of list.getEntries())window.__ui6Shifts.push({value:e.value,time:e.startTime,recentInput:e.hadRecentInput,sources:e.sources.map(s=>({tag:s.node?.tagName,classes:s.node?.className,previous:s.previousRect.toJSON(),current:s.currentRect.toJSON()}))});}).observe({type:'layout-shift',buffered:true});
    requestAnimationFrame(()=>{window.__ui6FontsBefore=[...document.fonts].map(f=>({family:f.family,status:f.status}));});
  });
  for(const theme of ['light','dark'])for(const width of [390,1280])for(let repeat=0;repeat<3;repeat++){
    await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme});
    // Seed using real browser persistence before the measured reload.
    await page.goto(base);
    await page.evaluate(async ({credentials,theme})=>{
      localStorage.setItem('plexonpanel-ui-preferences-v1',JSON.stringify({schemaVersion:1,theme,motion:'off'}));
      await new Promise((resolve,reject)=>{const r=indexedDB.open('plexonpanel-browser-v3',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>{const db=r.result,tx=db.transaction('workspace','readwrite');for(const c of credentials)tx.objectStore('workspace').put(c,'credential:'+c.serverId);tx.objectStore('workspace').put(credentials[0].serverId,'selected');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
    },{credentials:fixture.credentials,theme});
    const client=await context.newCDPSession(page);await client.send('Network.enable');await client.send('Network.setCacheDisabled',{cacheDisabled:true});
    await page.route('**/*.woff2',async route=>{await new Promise(r=>setTimeout(r,1200));await route.continue();});
    await page.goto(base+(production?'':'/dev/kitchen-sink'));
    await page.getByRole('heading',{name:production?'Your servers':'Deepslate laboratory',exact:true}).waitFor();
    await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
    const sample=await page.evaluate(production=>{
      const shifts=window.__ui6Shifts.filter(e=>!e.recentInput);let max=0,sum=0,start=-Infinity,last=-Infinity;
      for(const e of shifts){if(e.time-last>1000||e.time-start>5000){sum=0;start=e.time;}sum+=e.value;last=e.time;max=Math.max(max,sum);}
      return {cls:max,shifts,fontsBefore:window.__ui6FontsBefore,fontsAfter:[...document.fonts].map(f=>({family:f.family,status:f.status})),stack:getComputedStyle(document.querySelector(production?'h1':'main')).fontFamily,fontResources:performance.getEntriesByType('resource').filter(e=>e.name.includes('.woff2')).map(e=>({url:e.name,start:e.startTime,end:e.responseEnd}))};
    },production);
    samples.push({theme,width,repeat,...sample});await page.unroute('**/*.woff2');
  }
}finally{
  await writeFile(join(out,`cls-${stage}-${production?'production':'kitchen'}.json`),JSON.stringify({stage,production,fontDelayMs:1200,samples},null,2));
  await writeFile(join(out,`cls-${stage}-${production?'production':'kitchen'}-server.txt`),log);
  await browser?.close();server?.kill();await fixture?.close();
}
console.log(JSON.stringify({stage,production,samples:samples.length,maxCLS:Math.max(...samples.map(s=>s.cls))}));
