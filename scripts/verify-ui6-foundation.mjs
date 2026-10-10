import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const production = process.env.UI6_MODE === 'production';
const base = process.env.UI6_BASE_URL || 'http://127.0.0.1:3400';
const out = process.env.UI6_OUTPUT || 'artifacts/ui6-m2';
await mkdir(out, { recursive: true });
const port = new URL(base).port;
let serverLog = '';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', production ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', port], {env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
let ready = false;
for(let i=0;i<200;i++){try{if((await fetch(base+(production?'/':'/dev/kitchen-sink'),{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}if(server.exitCode!==null)break;await new Promise(r=>setTimeout(r,100));}
if(!ready){server.kill();await writeFile(join(out,'server.log'),serverLog);throw new Error('Server did not become ready: '+serverLog);}
const browser = await chromium.launch({headless: true, executablePath: process.env.PLEXON_CHROMIUM_EXECUTABLE, args: ['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-webgl','--disable-software-rasterizer']});
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
const result = { recordedAt: new Date().toISOString(), browser: browser.version(), mode: production ? 'production' : 'development', pages: [], interactions: [], errors: [] };
page.on('pageerror', e => result.errors.push(e.message));
async function focusName() { return page.evaluate(() => document.activeElement?.textContent?.trim()); }
async function axe(name) {
  const analysis = await new AxeBuilder({page}).analyze();
  const controlledTargets = await page.locator('.deepslate [aria-controls]').evaluateAll(els=>els.map(el=>({name:el.getAttribute('aria-label')||el.textContent?.trim(),id:el.getAttribute('aria-controls'),exists:Boolean(document.getElementById(el.getAttribute('aria-controls'))),expanded:el.getAttribute('aria-expanded'),nativeOpen:document.getElementById(el.getAttribute('aria-controls'))?.matches(':popover-open')})));
  assert.ok(controlledTargets.every(t=>t.exists),'A foundation controlled target must exist, including a closed native popover: '+JSON.stringify(controlledTargets.filter(t=>!t.exists)));
  assert.ok(controlledTargets.filter(t=>t.expanded!==null).every(t=>(t.expanded==='true')===t.nativeOpen),'Expanded state must match the actual popover state');
  const contrastReviews=[];
  for(const check of analysis.incomplete.filter(c=>c.id==='color-contrast'))for(const node of check.nodes) {
    const rendered=await page.locator(node.target[0]).evaluate(el=>{const background=el.closest('.pp-floating');return {foreground:getComputedStyle(el).color,background:background?getComputedStyle(background).backgroundColor:null};});
    const fg=rendered.foreground?.match(/[\d.]+/g)?.map(Number);const bg=rendered.background?.match(/[\d.]+/g)?.map(Number);
    assert.ok(fg&&bg&&fg.length===3&&bg.length===3,'Reviewed popover text must be on an opaque background');
    const lum=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5);
    contrastReviews.push({target:node.target,...rendered,ratio,status:'PASS'});
  }
  result.pages.push({name,violations:analysis.violations,passes:analysis.passes.length,incomplete:analysis.incomplete.map(({id,nodes})=>({id,nodes:nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),supplementalReviews:{controlledTargets,contrastReviews}});
  assert.equal(analysis.violations.length,0,JSON.stringify(analysis.violations));
}

const storageKey = 'plexonpanel-ui-preferences-v1';
try {
  if (!production) {
    // First load is a smoke gate before the screenshot matrix.
    await page.goto(base + '/dev/kitchen-sink'); await page.getByRole('heading', {name: 'Deepslate laboratory'}).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('h1').evaluate(el => getComputedStyle(el).fontFamily.includes('Plexon Hanken')), true);
    result.smoke = 'PASS';
    for (const theme of ['light','dark']) for (const width of [390,1280]) {
      await page.setViewportSize({width,height:900}); await page.emulateMedia({colorScheme: theme});
      await page.evaluate(({storageKey,theme})=>localStorage.setItem(storageKey,JSON.stringify({schemaVersion:1,theme,accent:'cyan',density:'compact',motion:'reduced'})),{storageKey,theme});
      await page.reload(); await page.getByRole('heading',{name:'Deepslate laboratory'}).waitFor(); await page.evaluate(()=>document.fonts.ready);
      await page.getByRole('combobox',{name:`${theme === 'light' ? 'Light' : 'Dark'} — Theme`,exact:true}).waitFor();
      await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
      assert.equal(await page.locator('html').getAttribute('data-plexon-theme'),theme);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,'Horizontal document overflow');
      await page.screenshot({path:join(out,`kitchen-${theme}-${width}.png`),fullPage:true});
      assert.equal(await page.getByRole('combobox',{name:'Choose… — Empty select'}).isDisabled(),true);
      assert.equal(await page.getByRole('button',{name:'Working…',exact:true}).first().isDisabled(),true);
      const readonly=page.getByRole('combobox',{name:'Fixed selection — Read-only select'});
      await readonly.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
      assert.equal(await readonly.getAttribute('aria-expanded'),'false');
      assert.equal(await readonly.evaluate(el=>el===document.activeElement),true);
      const modes=await page.locator('.pp-field[data-mode]').evaluateAll(fields=>fields.map(field=>({mode:field.dataset.mode,cue:field.querySelector('.pp-field-mode')?.textContent,border:getComputedStyle(field.querySelector('input,button')).borderTopStyle})));
      assert.ok(modes.filter(m=>m.mode==='readonly').every(m=>m.cue==='Read only'&&m.border==='double'));
      assert.ok(modes.filter(m=>m.mode==='disabled').every(m=>m.cue==='Unavailable'&&m.border==='dashed'));
      assert.ok(modes.some(m=>m.mode==='readonly')&&modes.some(m=>m.mode==='disabled'));
      result.interactions.push({theme,width,nonColorFieldAndSelectModes:modes});
      await axe(`${theme}-${width}-closed`);
      // Focus/disabled/busy semantics, select skipping disabled options and exact restore.
      const select = page.getByRole('combobox',{name:'First option — Normal select'});
      await select.focus(); await page.keyboard.press('ArrowDown'); await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='First option'); assert.equal(await focusName(),'First option');
      await page.keyboard.press('ArrowDown'); assert.equal(await focusName(),'Second option');
      await page.keyboard.press('ArrowDown'); assert.equal(await focusName(),'Third option');
      await page.keyboard.press('Home'); assert.equal(await focusName(),'First option');
      await page.keyboard.press('End'); assert.equal(await focusName(),'Third option');
      await page.keyboard.press('s'); assert.equal(await focusName(),'Second option');
      await axe(`${theme}-${width}-select`); await page.screenshot({path:join(out,`select-${theme}-${width}.png`)});
      await page.keyboard.press('Enter'); await page.getByRole('combobox',{name:'Second option — Normal select'}).waitFor();
      assert.equal(await page.getByRole('combobox',{name:'Second option — Normal select'}).evaluate(el=>el===document.activeElement),true);
      await page.getByRole('button',{name:'Open menu',exact:true}).click(); await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Copy fixture'); assert.equal(await focusName(),'Copy fixture');
      await page.keyboard.press('ArrowDown'); assert.equal(await focusName(),'Download fixture');
      await page.keyboard.press('ArrowDown'); assert.equal(await focusName(),'Copy fixture');
      await page.keyboard.press('End'); assert.equal(await focusName(),'Download fixture');
      await page.keyboard.press('Home'); assert.equal(await focusName(),'Copy fixture');
      await page.keyboard.press('d'); assert.equal(await focusName(),'Download fixture');
      await axe(`${theme}-${width}-menu`); await page.screenshot({path:join(out,`menu-${theme}-${width}.png`)});
      await page.keyboard.press('Escape'); assert.equal(await page.getByRole('button',{name:'Open menu',exact:true}).evaluate(el=>el===document.activeElement),true);
      await page.getByRole('button',{name:'Open popover',exact:true}).click(); await page.getByRole('dialog',{name:'Source disclosure'}).waitFor();
      await axe(`${theme}-${width}-popover`); await page.screenshot({path:join(out,`popover-${theme}-${width}.png`)});
      await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'Open popover',exact:true}).click(); await page.getByRole('dialog',{name:'Source disclosure'}).waitFor();
      await page.getByRole('heading',{name:'Tabs & Disclosure',exact:true}).click(); await page.getByRole('dialog',{name:'Source disclosure'}).waitFor({state:'hidden'});
      await page.getByRole('button',{name:'Open dialog specimen'}).click(); const dialog=page.getByRole('dialog',{name:'Dialog specimen'}); await dialog.waitFor();
      for(let i=0;i<9;i++){ await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,'Dialog focus escaped'); }
      await axe(`${theme}-${width}-dialog`); await page.screenshot({path:join(out,`dialog-${theme}-${width}.png`)});
      await dialog.getByRole('combobox',{name:'Second option — Dialog select'}).click(); await page.getByRole('option',{name:'First option',exact:true}).click();
      await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
      assert.equal(await page.getByRole('button',{name:'Open dialog specimen'}).evaluate(el=>el===document.activeElement),true);
      await page.getByRole('button',{name:'Open dialog specimen'}).click(); await dialog.waitFor(); await page.mouse.click(2,2); await dialog.waitFor({state:'hidden'});
      assert.equal(await page.getByRole('button',{name:'Open dialog specimen'}).evaluate(el=>el===document.activeElement),true);
      await page.getByRole('tab',{name:'Current',exact:true}).focus(); await page.keyboard.press('ArrowRight'); assert.equal(await focusName(),'History');
      assert.equal(await page.getByRole('tab',{name:'Current',exact:true}).getAttribute('aria-selected'),'true');
      await page.keyboard.press('Enter'); assert.equal(await page.getByRole('tab',{name:'History',exact:true}).getAttribute('aria-selected'),'true');
      await page.getByText('Closed disclosure',{exact:true}).click(); await page.getByRole('button',{name:'Contained action'}).waitFor();
      result.interactions.push({theme,width,select:'PASS',menu:'PASS',popover:'PASS',dialogFocusTrapRestoreAndNestedSelect:'PASS',tabsManualActivation:'PASS',disclosure:'PASS'});
    }
    // Persistence + OS following through the existing provider, then saved override.
    await page.evaluate(key=>localStorage.removeItem(key),storageKey); await page.emulateMedia({colorScheme:'dark'}); await page.reload();
    await page.getByRole('heading',{name:'Deepslate laboratory'}).waitFor();
    await page.waitForFunction(key=>localStorage.getItem(key)!==null,storageKey);
    await page.waitForFunction(()=>document.documentElement.dataset.plexonTheme==='dark');
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).theme,storageKey),'system');
    await page.emulateMedia({colorScheme:'light'}); await page.waitForFunction(()=>document.documentElement.dataset.plexonTheme==='light');
    await page.getByRole('combobox',{name:'System — Theme',exact:true}).click(); await page.getByRole('option',{name:'Dark',exact:true}).click();
    await page.emulateMedia({colorScheme:'light'}); await page.reload(); await page.waitForFunction(()=>document.documentElement.dataset.plexonTheme==='dark');
    result.savedAndSystemTheme = 'PASS';
    // Reduced motion, forced colors, and 200% text scaling retain usable layouts.
    await page.setViewportSize({width:390,height:900}); await page.emulateMedia({forcedColors:'active'});
    await page.screenshot({path:join(out,'kitchen-forced-colors-390.png'),fullPage:true});
    await page.emulateMedia({forcedColors:'none'});
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'200% text overflow');
    await page.screenshot({path:join(out,'kitchen-text-200-390.png'),fullPage:true}); result.text200AndForcedColors = 'PASS';
  } else {
    result.productionBuildId=(await readFile('.next/BUILD_ID','utf8')).trim();
    const client=await context.newCDPSession(page); await client.send('Network.enable'); await client.send('Network.setCacheDisabled',{cacheDisabled:true}); await client.send('DOM.enable');await client.send('CSS.enable');
    const fontFiles={};
    const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
    const sources={};for(const file of ['hanken-latin.woff2','hanken-latin-ext.woff2','commit-mono-400.woff2'])sources[hash(await readFile(join('app/fonts',file)))]=file;
    for(const file of await readdir('.next/static/media'))if(file.endsWith('.woff2'))fontFiles[file]=sources[hash(await readFile(join('.next/static/media',file)))]||'other';
    const requests=[]; page.on('response',async response=>{if(response.url().includes('.woff2'))requests.push({url:response.url(),file:fontFiles[new URL(response.url()).pathname.split('/').at(-1)],status:response.status(),bytes:Number(response.headers()['content-length'])});});
    const response=await page.goto(base+'/');assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
    const preloads=await page.locator('link[rel="preload"][as="font"]').evaluateAll(els=>els.map(el=>el.getAttribute('href')));
    assert.equal(preloads.length,1); assert.equal(fontFiles[preloads[0].split('/').at(-1)],'hanken-latin.woff2');
    const initial=[...requests];assert.ok(initial.some(r=>r.file==='hanken-latin.woff2'));assert.ok(!initial.some(r=>r.file==='hanken-latin-ext.woff2'));
    async function probe(text,mono=false) {await page.evaluate(({text,mono})=>{let p=document.getElementById('font-probe');if(!p){p=document.createElement('p');p.id='font-probe';document.body.append(p);}p.textContent=text;p.style.fontFamily=mono?'var(--ds-font-mono)':'var(--ds-font-ui)';p.getBoundingClientRect();},{text,mono});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);const {root}=await client.send('DOM.getDocument');const {nodeId}=await client.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#font-probe'});return (await client.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;}
    const portugueseFonts=await probe('Overview conexão João São Paulo configuração ação');const portuguese=[...requests];assert.ok(!portuguese.some(r=>r.file==='hanken-latin-ext.woff2'));assert.ok(portugueseFonts.every(f=>f.isCustomFont));
    const extendedFonts=await probe('Łukasz');assert.equal(requests.filter(r=>r.file==='hanken-latin-ext.woff2').length,1);
    const monoFonts=await probe('status --server example.local',true);assert.equal(requests.filter(r=>r.file==='commit-mono-400.woff2').length,1);
    const fallbackFonts=await probe('Ж');assert.ok(fallbackFonts.some(f=>!f.isCustomFont));
    const emittedCss=[];
    for(const file of await readdir('.next/static/chunks'))if(file.endsWith('.css')){const css=await readFile(join('.next/static/chunks',file),'utf8');if(css.includes('Plexon Hanken')||css.includes('Plexon Commit Mono'))emittedCss.push({file,faces:[...css.matchAll(/@font-face\{[^}]+\}/g)].map(m=>m[0])});}
    assert.ok(emittedCss.some(c=>c.faces.filter(f=>f.includes('Plexon Hanken')&&f.includes('unicode-range')).length===2));
    result.fontTrace={cacheDisabled:true,preloads,fontFiles,initial,portuguese,allRequests:requests,portugueseFonts,extendedFonts,monoFonts,fallbackFonts,emittedCss};
    const excluded=await page.goto(base+'/dev/kitchen-sink');assert.equal(excluded.status(),404);result.productionKitchenSinkHttp=404;
  }
  assert.equal(result.errors.length,0,JSON.stringify(result.errors));
  result.status='PASS';
} catch(error) {result.status='FAIL';result.failure=error.stack;result.overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].map(el=>({tag:el.tagName,cls:el.className,text:el.textContent?.slice(0,90),right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width})).filter(el=>el.right>innerWidth+1).slice(0,15)).catch(()=>[]);throw error;} finally {await writeFile(join(out,production?'production-font-trace.json':'kitchen-verification.json'),JSON.stringify(result,null,2));await browser.close();server.kill();await writeFile(join(out,production?'production-server.log':'development-server.log'),serverLog);console.log(JSON.stringify({status:result.status,pages:result.pages.length,interactions:result.interactions.length,failure:result.failure}));}
