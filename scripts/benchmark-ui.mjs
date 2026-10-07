// Compare identical signed telemetry fixtures; labels explicitly distinguish source/duration.
import {spawn,execFileSync} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {createFleetFixture} from './support/fleet-fixture.mjs';
const root=resolve(process.env.PLEXON_UI_PROJECT_ROOT??'.'),label=process.env.PLEXON_UI_BENCHMARK_LABEL??'after';
const duration=Number(process.env.PLEXON_UI_SOAK_MS??900000);
const fixture=await createFleetFixture({port:8788,names:['PlexonCraft','TonimSMP'],instanceKeys:['plexoncraft','tonimsmp'],intervalMs:250,richerTelemetry:true});
const next=spawn(process.execPath,[root+'/node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1'],{cwd:root,env:{...process.env,NEXT_PUBLIC_PLEXON_RELAY_URL:fixture.base,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let browser;let serverOutput='';next.stdout.on('data',chunk=>{serverOutput+=chunk;});next.stderr.on('data',chunk=>{serverOutput+=chunk;});
const result={label,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),root,durationRequestedMs:duration,telemetryIntervalMs:250,mode:'Next development, unthrottled headless Chromium, software GPU, signed simulated two-server fixture; all streams stressed at 250ms',samples:[]};
try{
 let ready=false;for(let i=0;i<150;i++){if(next.exitCode!==null)throw new Error('Next startup failed: '+serverOutput);try{const response=await fetch(fixture.origin,{signal:AbortSignal.timeout(5000)});if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw new Error('Next startup timeout: '+serverOutput);
 browser=await chromium.launch({headless:true,...(process.env.PLEXON_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLEXON_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(30000);await page.goto(fixture.origin);
 await page.evaluate(async credentials=>{await new Promise(resolve=>{const r=indexedDB.open('plexonpanel-browser-v3',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>{const db=r.result,tx=db.transaction('workspace','readwrite'),s=tx.objectStore('workspace');for(const c of credentials)s.put(c,'credential:'+c.serverId);s.put(credentials[0].serverId,'selected');tx.oncomplete=()=>{db.close();resolve()}}})},fixture.credentials);
 await page.reload();await page.getByRole('heading',{name:'Your servers'}).waitFor();await page.waitForTimeout(700);if(label==='before')await page.screenshot({path:'docs/ui-evidence/before/fleet-1440.png',fullPage:true});await page.getByRole('button',{name:/Open PlexonCraft/}).click();await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();if(label==='before'){await page.waitForTimeout(500);await page.screenshot({path:'docs/ui-evidence/before/overview-1440.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:'docs/ui-evidence/before/overview-390.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(300);}await page.locator('nav').getByRole('button',{name:'Performance',exact:true}).click();await page.getByRole('heading',{name:'Performance',exact:true}).waitFor();await page.waitForTimeout(2000);
 const session=await page.context().newCDPSession(page);await session.send('Performance.enable');const start=Date.now();
 const capture=async()=>{const data=await session.send('Performance.getMetrics');result.samples.push({atMs:Date.now()-start,...Object.fromEntries(data.metrics.filter(m=>['JSHeapUsedSize','Nodes','TaskDuration','ScriptDuration','LayoutCount','RecalcStyleCount'].includes(m.name)).map(m=>[m.name,m.value])),...await page.evaluate(()=>({paths:document.querySelectorAll('svg path').length,pathBytes:[...document.querySelectorAll('svg path')].reduce((s,p)=>s+(p.getAttribute('d')?.length??0),0)}))});};
 await capture();
 while(Date.now()-start<duration){await page.waitForTimeout(Math.min(10000,duration-(Date.now()-start)));await capture();if(result.samples.length%6===1)console.log(JSON.stringify({label,elapsedMs:Date.now()-start,heap:result.samples.at(-1).JSHeapUsedSize}));}
 result.durationMs=Date.now()-start;
 // Repeated dialog and same-server navigation cycles exercise cleanup separately from the stationary soak.
 for(let i=0;i<10;i++){await page.locator('nav').getByRole('button',{name:'Overview',exact:true}).click();await page.waitForTimeout(100);await page.locator('nav').getByRole('button',{name:'Performance',exact:true}).click();await page.waitForTimeout(100);if(i%2===0){await page.getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');}}
 const select=page.getByRole('combobox',{name:'Selected server'});for(let i=0;i<2;i++){for(const name of ['TonimSMP','PlexonCraft']){await select.click();await page.getByRole('option').filter({hasText:name}).click();await page.waitForTimeout(500);}}
 await session.send('HeapProfiler.collectGarbage');result.retainedHeapAfterCycles=Object.fromEntries((await session.send('Performance.getMetrics')).metrics.filter(m=>['JSHeapUsedSize','Nodes'].includes(m.name)).map(m=>[m.name,m.value]));
 result.postNavigationNodes=await page.evaluate(()=>document.querySelectorAll('*').length);
 result.status='PASS';
 console.log(JSON.stringify({label,durationMs:result.durationMs,first:result.samples[0],last:result.samples.at(-1)}));
}catch(error){result.status='FAIL';result.failure=error.message;throw error;}finally{
 await mkdir('docs/ui-evidence/benchmarks',{recursive:true});await writeFile(`docs/ui-evidence/benchmarks/${label}.json`,JSON.stringify(result,null,2)+'\n');next.kill('SIGTERM');if(browser)await Promise.race([browser.close(),new Promise(r=>setTimeout(r,1500))]);await Promise.race([fixture.close(),new Promise(r=>setTimeout(r,1500))]);setTimeout(()=>process.exit(),250).unref();
}
