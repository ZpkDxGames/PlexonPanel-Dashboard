// Signed local agents are fixtures. No live server is contacted or operated.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createFleetFixture } from './support/fleet-fixture.mjs';
const production=process.env.UI6_MODE==='production';
const base='http://127.0.0.1:3400', out=process.env.UI6_OUTPUT||'docs/ui6-m4a/pre-fixes';
await mkdir(out,{recursive:true});
const result={mode:production?'production':'development',recordedAt:new Date().toISOString(),pages:[],screenshots:[],keyboard:[],errors:[]};
let fixture,server,browser,page,log='';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
 fixture=await createFleetFixture({port:8788,origin:base,names:['PlexonCraft','TonimSMP'],richerTelemetry:true});
 server=spawn(process.execPath,['node_modules/next/dist/bin/next',production?'start':'dev','--hostname','127.0.0.1','--port','3400'],{env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_PLEXON_RELAY_URL:fixture.base},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
 let ready=false;for(let i=0;i<200;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}if(server.exitCode!==null)break;await delay(100);}assert.ok(ready,'Next smoke start');
 browser=await chromium.launch({headless:true,executablePath:process.env.PLEXON_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-webgl','--disable-software-rasterizer']});
 const context=await browser.newContext({reducedMotion:'reduce'});page=await context.newPage();
 result.browser=browser.version();page.on('pageerror',e=>result.errors.push(e.message));
 const shot=async name=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:join(out,name+'.png'),fullPage:true});result.screenshots.push(name);};
 async function axe(name,excludeLegacy=false){
   let builder=new AxeBuilder({page});if(excludeLegacy)builder=builder.exclude('.legacy-workspace');
   const analysis=await builder.analyze();
   const references=await page.locator('.shell [aria-controls]').evaluateAll(els=>els.map(el=>({id:el.getAttribute('aria-controls'),exists:Boolean(document.getElementById(el.getAttribute('aria-controls'))),expanded:el.getAttribute('aria-expanded'),nativeOpen:document.getElementById(el.getAttribute('aria-controls'))?.matches(':popover-open')})));
   assert.ok(references.every(r=>r.exists));assert.ok(references.filter(r=>r.expanded!==null).every(r=>(r.expanded==='true')===r.nativeOpen));
   const contrastReviews=[];
   for(const c of analysis.incomplete.filter(c=>c.id==='color-contrast'))for(const n of c.nodes){
     const colors=await page.locator(n.target[0]).evaluate(el=>{let parent=el;let background;while(parent){const color=getComputedStyle(parent).backgroundColor;if(/^rgb\(/.test(color)){background=color;break;}parent=parent.parentElement;}const style=getComputedStyle(el);return {foreground:el.tagName.toLowerCase()==='text'?style.fill:style.color,background};});
     const rgb=v=>v?.match(/[\d.]+/g)?.map(Number);const fg=rgb(colors.foreground),bg=rgb(colors.background);assert.ok(fg?.length===3&&bg?.length===3,'Opaque text review '+JSON.stringify({name,target:n.target,colors}));
     const lum=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5);contrastReviews.push({target:n.target,...colors,ratio});
   }
   result.pages.push({name,scope:excludeLegacy?'shell excluding retained 5.0 workspace':'whole page',violations:analysis.violations,incomplete:analysis.incomplete,passes:analysis.passes.length,supplementalReviews:{references,contrastReviews}});
   assert.equal(analysis.violations.length,0,name+': '+JSON.stringify(analysis.violations));
 }
 await page.goto(base);await page.getByRole('heading',{name:'Pair this browser',exact:true}).waitFor();result.smoke='passed';
 await page.evaluate(async credentials=>{
   await new Promise((resolve,reject)=>{const r=indexedDB.open('plexonpanel-browser-v3',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>{const db=r.result,tx=db.transaction('workspace','readwrite');for(const c of credentials)tx.objectStore('workspace').put(c,'credential:'+c.serverId);tx.objectStore('workspace').put(credentials[0].serverId,'selected');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
 },fixture.credentials);
 for(const width of [390,1280]) {
 await page.setViewportSize({width,height:width===390?900:420}); await page.reload(); await page.getByRole('heading',{name:'Your servers',exact:true}).waitFor();
 await page.locator('.fleet-card[data-selected="true"] > button').click(); await page.locator('.overview-workspace').waitFor();
 await page.getByRole('button',{name:/Connection authority:/}).click(); await page.getByRole('heading',{name:'Connection details'}).waitFor();
 for(const source of ['Relay','Paper','Host','Console']) assert.ok(await page.locator('.pp-floating:popover-open dt').filter({hasText:new RegExp('^'+source+'$')}).count());
 await page.keyboard.press('Escape'); await shot('pre-fixes-'+width); await axe('pre-fixes-'+width);
 if(width===390) assert.equal(await page.locator('.shell-source-line').isVisible(),false);
 else { const rail=await page.locator('.shell-rail').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,position:getComputedStyle(el).position}));assert.equal(rail.position,'sticky');assert.equal(rail.height,420);assert.ok(rail.scroll>rail.height); await page.locator('.shell-rail').evaluate(el=>el.scrollTop=el.scrollHeight);assert.ok(await page.locator('.shell-rail > button').isVisible());result.rail=rail; }
 assert.ok((await page.locator('.overview-workspace').innerText()).includes('1 world')); 
 }
 result.status='passed';
}catch(error){
 result.failure=String(error);if(page){await page.screenshot({path:join(out,'failure.png'),fullPage:true});await writeFile(join(out,'failure.txt'),await page.locator('body').innerText());}throw error;
}finally{
 await writeFile(join(out,'shell-verification.json'),JSON.stringify(result,null,2));await writeFile(join(out,'server.txt'),log.replace(/\x1b\[[0-9;]*m/g,'').split('\n').map(s=>s.trimEnd()).join('\n'));
 await browser?.close();server?.kill();await fixture?.close();
}
console.log(JSON.stringify({status:result.status,screenshots:result.screenshots.length,axeScans:result.pages.length,errors:result.errors}));
