// Signed local agents are fixtures. No live server is contacted or operated.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createFleetFixture } from './support/fleet-fixture.mjs';
const production=process.env.UI6_MODE==='production';
const base='http://127.0.0.1:3400', out=process.env.UI6_OUTPUT||'artifacts/ui6-m3/m3b';
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
 const preferences=async theme=>{await page.evaluate(theme=>localStorage.setItem('plexonpanel-ui-preferences-v1',JSON.stringify({schemaVersion:1,theme,accent:'monochrome',motion:'off',density:'compact'})),theme);await page.emulateMedia({colorScheme:theme});};
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
 for(const theme of ['light','dark'])for(const width of [390,1280]){
   await page.setViewportSize({width,height:900});await preferences(theme);await page.reload();await page.getByRole('heading',{name:'Pair this browser',exact:true}).waitFor();await shot(`pairing-${theme}-${width}`);await axe(`pairing-${theme}-${width}`);
 }
 // Abort application chunks to inspect the actual server-rendered boot, without a fixture route.
 for(const theme of ['light','dark'])for(const width of [390,1280]){
   await page.setViewportSize({width,height:900});await preferences(theme);
   await page.route('**/_next/static/chunks/**',route=>route.request().resourceType()==='script'?route.abort():route.continue());
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-ui6-boot]').waitFor();await shot(`boot-${theme}-${width}`);await axe(`boot-${theme}-${width}`);await page.unroute('**/_next/static/chunks/**');
   await page.reload();await page.getByRole('heading',{name:'Pair this browser',exact:true}).waitFor();
 }
 await page.evaluate(async credentials=>{
   await new Promise((resolve,reject)=>{const r=indexedDB.open('plexonpanel-browser-v3',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>{const db=r.result,tx=db.transaction('workspace','readwrite');for(const c of credentials)tx.objectStore('workspace').put(c,'credential:'+c.serverId);tx.objectStore('workspace').put(credentials[0].serverId,'selected');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
 },fixture.credentials);
 for(const theme of ['light','dark'])for(const width of [360,390,768,1024,1280,1920]){
   await page.setViewportSize({width,height:900});await preferences(theme);await page.reload();await page.getByRole('heading',{name:'Your servers',exact:true}).waitFor();
   if(width===390||width===1280){await shot(`fleet-shell-${theme}-${width}`);await axe(`fleet-shell-${theme}-${width}`,true);const legacy=await new AxeBuilder({page}).analyze();result.pages.push({name:`retained-fleet-${theme}-${width}`,scope:'whole legacy Fleet; known M4 debt',violations:legacy.violations,incomplete:legacy.incomplete});assert.ok(legacy.violations.every(v=>v.id==='definition-list'));}
   await page.locator('.fleet-card[data-selected="true"] > button').click();await page.locator('.shell-health[data-state="online"]').waitFor();await page.locator('.overview-workspace').waitFor();await page.locator('.overview-workspace table').waitFor();
   await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow '+theme+width);
   await shot(`shell-${theme}-${width}`);await axe(`shell-${theme}-${width}`);
   await page.getByRole('button',{name:'Connection authority',exact:true}).click();await page.getByRole('heading',{name:'Connection details',exact:true}).waitFor();await axe(`authority-${theme}-${width}`);await shot(`authority-${theme}-${width}`);await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Open command palette',exact:true}).focus();await page.keyboard.press('Control+k');await page.locator('.shell-palette[open]').waitFor();await axe(`palette-${theme}-${width}`);await shot(`palette-${theme}-${width}`);await page.keyboard.press('Escape');assert.ok(await page.getByRole('button',{name:'Open command palette',exact:true}).evaluate(el=>el===document.activeElement));
   await page.keyboard.press('?');await page.getByRole('dialog',{name:'Keyboard shortcuts',exact:true}).waitFor();await axe(`shortcuts-${theme}-${width}`);await shot(`shortcuts-${theme}-${width}`);await page.keyboard.press('Escape');
   if(width<1024){
     const opener=page.getByRole('button',{name:'Open navigation',exact:true});await opener.focus();await page.keyboard.press('Enter');await page.locator('.shell-drawer[open]').waitFor();assert.equal(await page.locator('.shell-frame').getAttribute('inert'),'');
     await axe(`drawer-${theme}-${width}`);await shot(`drawer-${theme}-${width}`);
     for(let i=0;i<22;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement.closest('.shell-drawer')!==null));}
     await page.keyboard.press('Escape');assert.ok(await opener.evaluate(el=>el===document.activeElement));assert.equal(await page.locator('.shell-frame').getAttribute('inert'),null);
     result.keyboard.push({theme,width,drawerTrap22Tabs:'passed',inert:'passed',focusRestore:'passed'});
   }
 }
 // Keyboard navigation exercises the actual mounted palette and lazy views.
 await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Open command palette',exact:true}).focus();await page.keyboard.press('Control+k');
 await page.getByRole('textbox',{name:'Find workspace or server',exact:true}).fill('Server');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.locator('.workspace-lifecycle-card').waitFor();
 const mutations=()=>fixture.requests.filter(r=>/^(server\.(start|stop|restart)|console\.execute|files\.write|maintenance\.(full-backup\.create|settings\.update|restart\.now))$/.test(r.action));assert.equal(mutations().length,0);
 await page.getByRole('button',{name:'Open session activity',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Session activity',exact:true}).waitFor();await axe('session-activity');await shot('session-activity');await page.keyboard.press('Escape');
 await page.keyboard.press('g');await page.keyboard.press('o');await page.locator('.overview-workspace').waitFor();
 await page.keyboard.press('Control+k');const query=page.getByRole('textbox',{name:'Find workspace or server',exact:true});await query.fill('g s');assert.equal(await page.locator('.shell-page-heading h1').textContent(),'Overview');await page.keyboard.press('Escape');
 result.keyboard.push({paletteKeyboardNavigation:'passed',gChord:'passed',typingIgnored:'passed',navigationMutations:mutations().length});
 result.status='passed';
}catch(error){
 result.failure=String(error);if(page){await page.screenshot({path:join(out,'failure.png'),fullPage:true});await writeFile(join(out,'failure.txt'),await page.locator('body').innerText());}throw error;
}finally{
 await writeFile(join(out,'shell-verification.json'),JSON.stringify(result,null,2));await writeFile(join(out,'server.txt'),log);
 await browser?.close();server?.kill();await fixture?.close();
}
console.log(JSON.stringify({status:result.status,screenshots:result.screenshots.length,axeScans:result.pages.length,errors:result.errors}));
