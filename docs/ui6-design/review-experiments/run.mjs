// Run from the repository root. Fonts remain in an external experiment directory.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {chromium} from '@playwright/test';
import {createFleetFixture} from '../../../scripts/support/fleet-fixture.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const out=resolve(process.env.UI6_REVIEW_OUTPUT||'artifacts/ui6-review');
const fontRoot=process.env.UI6_EXPERIMENT_FONT_ROOT;
assert.ok(fontRoot,'Set UI6_EXPERIMENT_FONT_ROOT to the external node_modules containing @fontsource-variable.');
await mkdir(out,{recursive:true});
const tokens=JSON.parse(await readFile(join(here,'../tokens.json'),'utf8'));
const css=await readFile(join(here,'specimen.css'),'utf8');
const pulse=await readFile(join(here,'pulse.js'),'utf8');
const html=await readFile(join(here,'prototype.html'),'utf8');
const families={hanken:'hanken-grotesk',noto:'noto-sans'};
const sizes={};
async function fontCss(key,base='',nonce='') {
  const family=families[key];const source=await readFile(join(fontRoot,'@fontsource-variable',family,'wght.css'),'utf8');
  const faces=[...source.matchAll(/@font-face\s*\{[^}]+\}/g)].map(x=>x[0]).filter(x=>/-latin-(?:ext-)?wght-normal/.test(x));
  assert.equal(faces.length,2);
  return faces.join('\n').replaceAll(/font-family: '[^']+';/g,"font-family: 'ReviewFont';").replaceAll('./files/',base+'/fonts/').replaceAll('.woff2)',`.woff2?case=${nonce})`);
}
function palette(theme) {return ':root{'+Object.entries(tokens[theme]).map(([k,v])=>`--${k}:${v}`).join(';')+";--review-family:'ReviewFont'}";}
for(const family of Object.values(families)) {
  sizes[family]={};for(const subset of ['latin','latin-ext'])sizes[family][subset]=(await stat(join(fontRoot,'@fontsource-variable',family,'files',`${family}-${subset}-wght-normal.woff2`))).size;
}
const requests=[];
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');let body,type;
    if(url.pathname.startsWith('/fonts/')) {
      const name=url.pathname.split('/').at(-1),family=Object.values(families).find(n=>name.startsWith(n+'-'));
      assert.ok(family&&/^[-a-z0-9]+\.woff2$/.test(name));body=await readFile(join(fontRoot,'@fontsource-variable',family,'files',name));type='font/woff2';requests.push({url:url.pathname+url.search,bytes:body.length});
    } else if(url.pathname==='/font.css') {body=await fontCss(url.searchParams.get('family')||'hanken','',url.searchParams.get('case')||'');type='text/css';
    } else if(url.pathname==='/specimen.css') {body=css;type='text/css';
    } else if(url.pathname==='/pulse.js') {body=pulse;type='text/javascript';
    } else if(url.pathname==='/') {
      const query=url.searchParams,theme=query.get('theme')||'light';
      body=html.replace('/font.css',`/font.css?${query.toString().replaceAll('&','&amp;')}`).replace('</head>',`<style>${palette(theme)}</style>`+(query.get('preload')==='1'?`<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/${families[query.get('family')||'hanken']}-latin-ext-wght-normal.woff2?case=${query.get('case')}">`:'')+'</head>');type='text/html';
    } else {res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(body);
  } catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise(r=>server.listen(3911,'127.0.0.1',r));
let browser,fixture,next;
const result={recordedAt:new Date().toISOString(),fontFiles:sizes,fontLoading:[],mountedFontCaptures:[],pulseRuns:[],errors:[]};
try {
  browser=await chromium.launch({headless:true,...(process.env.PLEXON_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLEXON_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu','--no-zygote','--single-process','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-webgl','--disable-software-rasterizer']}: {})});
  result.browserVersion=browser.version();const context=await browser.newContext();
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')console.log('Browser console: '+m.text());});
  page.on('requestfailed',r=>console.log('Request failed: '+r.url()+' '+r.failure()?.errorText));
  const client=await context.newCDPSession(page);await client.send('DOM.enable');await client.send('CSS.enable');await client.send('Network.enable');await client.send('Network.setCacheDisabled',{cacheDisabled:true});
  async function faces(selector) {const {root}=await client.send('DOM.getDocument');const {nodeId}=await client.send('DOM.querySelector',{nodeId:root.nodeId,selector});return (await client.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;}

  // Cold cache, real HTTP font requests: no FontFace.load of unused subsets.
  for(const family of ['hanken','noto']) {
    const nonce=`${family}-${Date.now()}`;const before=requests.length;
    await page.goto(`http://127.0.0.1:3911/?family=${family}&case=${nonce}&theme=light`);
    await page.evaluate(()=>{document.body.getBoundingClientRect();});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
    const englishPortuguese=requests.slice(before);assert.equal(englishPortuguese.filter(r=>r.url.includes('latin-ext')).length,0);
    const corpusFonts=await faces('.portuguese');assert.ok(corpusFonts.length&&corpusFonts.every(f=>f.isCustomFont),JSON.stringify(corpusFonts));
    await page.evaluate(()=>{document.querySelector('#loading-probe').textContent='João_Łukasz';document.querySelector('#loading-probe').getBoundingClientRect();});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
    const afterExtended=requests.slice(before);assert.equal(afterExtended.filter(r=>r.url.includes('latin-ext')).length,1);
    const extendedFaces=await faces('#loading-probe');
    await page.evaluate(()=>{document.querySelector('#loading-probe').textContent='Rare name: Ж';document.body.getBoundingClientRect();});await page.evaluate(()=>document.fonts.ready);
    const rareFaces=await faces('#loading-probe');
    const preloadBefore=requests.length;
    await page.goto(`http://127.0.0.1:3911/?family=${family}&case=${nonce}-preload&theme=light&preload=1`);await page.evaluate(()=>document.fonts.ready);
    const preloadRequests=requests.slice(preloadBefore);assert.ok(preloadRequests.some(r=>r.url.includes('latin-ext')));
    result.fontLoading.push({family,englishPortuguese,corpusFonts,afterExtended,extendedFaces,rareFaces,preloadNegativeControl:preloadRequests});
  }

  // Actual mounted 5.0 Overview header; specimen inserted only by automation.
  fixture=await createFleetFixture({port:8788,names:['PlexonCraft','TonimSMP'],instanceKeys:['plexoncraft','tonimsmp'],intervalMs:1000,richerTelemetry:true});
  next=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1'],{env:{...process.env,NEXT_PUBLIC_PLEXON_RELAY_URL:fixture.base,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','ignore','inherit']});
  let ready=false;for(let i=0;i<150;i++){try{if((await fetch(fixture.origin,{signal:AbortSignal.timeout(1500)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'Next fixture did not start');
  await page.route('**/__ui6-review/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    const name=pathname.split('/').at(-1),family=Object.values(families).find(n=>name.startsWith(n+'-'));
    assert.ok(family&&name.endsWith('.woff2'));await route.fulfill({body:await readFile(join(fontRoot,'@fontsource-variable',family,'files',name)),contentType:'font/woff2'});
  });
  await page.goto(fixture.origin);
  await page.evaluate(async credentials=>{await new Promise((resolve,reject)=>{const r=indexedDB.open('plexonpanel-browser-v3',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>{const db=r.result,tx=db.transaction('workspace','readwrite'),s=tx.objectStore('workspace');for(const c of credentials)s.put(c,'credential:'+c.serverId);s.put(credentials[0].serverId,'selected');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},fixture.credentials);
  for(const family of ['hanken','noto'])for(const theme of ['light','dark'])for(const width of [390,1280]) {
    await page.setViewportSize({width,height:1080});
    await page.evaluate(theme=>localStorage.setItem('plexonpanel-ui-preferences-v1',JSON.stringify({schemaVersion:1,theme,motion:'off',textScale:100,playerHeads:false})),theme);
    await page.goto(fixture.origin);await page.getByRole('heading',{name:'Your servers'}).waitFor();
    await page.evaluate(id=>localStorage.setItem('plexonpanel-section:'+id,'Overview'),fixture.rooms[0].serverId);
    await page.getByRole('button',{name:/Open PlexonCraft/}).click();await page.getByRole('heading',{name:'Overview',exact:true,level:1}).waitFor();
    await page.waitForTimeout(1100);
    await page.evaluate(()=>{document.querySelector('.workspace-content').remove();document.querySelector('.workspace-footer')?.remove();document.querySelector('.connection-summary')?.remove();const target=document.createElement('div');target.id='review-pulse';target.style.cssText='margin:0 24px 24px';document.querySelector('.workspace-page-head').after(target);});
    await page.addStyleTag({content:await fontCss(family,'/__ui6-review',`${family}-${theme}-${width}`)+palette(theme)+css+`.workspace-topbar,.workspace-topbar *,.workspace-page-head,.workspace-page-head *{font-family:'ReviewFont',Arial,sans-serif}.workspace-page-head{font-variant-numeric:tabular-nums}.workspace-page-head h1{font-weight:600}`});
    await page.addScriptTag({content:pulse});await page.evaluate(()=>{window.reviewPulse=PulseExperiment.create(document.querySelector('#review-pulse'));});
    await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
    const clip=await page.evaluate(()=>{const top=document.querySelector('.workspace-topbar').getBoundingClientRect(),bottom=document.querySelector('#review-pulse').getBoundingClientRect();return {x:Math.max(0,top.x),y:Math.max(0,top.y),width:Math.min(innerWidth-top.x,top.width),height:bottom.bottom-top.y};});
    const file=`overview-${family}-${width}-${theme}.png`;await page.screenshot({path:join(out,file),clip,animations:'disabled'});
    const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headingWidth:document.querySelector('.workspace-page-head h1').getBoundingClientRect().width,headingText:document.querySelector('.workspace-page-head h1').textContent,numericWidths:[...document.querySelectorAll('.signals strong')].map(n=>n.getBoundingClientRect().width)}));
    const headingFonts=await faces('.workspace-page-head h1'),portugueseFonts=await faces('.portuguese');
    assert.ok(headingFonts.length&&headingFonts.every(f=>f.isCustomFont));assert.ok(portugueseFonts.length&&portugueseFonts.every(f=>f.isCustomFont));
    result.mountedFontCaptures.push({family,theme,width,file,metrics,headingFonts,portugueseFonts});
  }
  next.kill('SIGTERM');next=null;await fixture.close();fixture=null;

  const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];
  for(const width of [390,1920])for(const theme of ['light','dark'])for(const count of [900,8192])for(const throttle of [1,4]) {
    await client.send('Emulation.setCPUThrottlingRate',{rate:throttle});await page.setViewportSize({width,height:1000});
    await page.goto(`http://127.0.0.1:3911/?family=hanken&case=pulse-${width}-${theme}-${count}-${throttle}&theme=${theme}&count=${count}`);await page.evaluate(()=>document.fonts.ready);
    const trace=[];client.on('Tracing.dataCollected',onTrace);function onTrace(e){trace.push(...e.value);}
    await client.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline,blink,toplevel',transferMode:'ReportEvents'});
    const measurements=await page.evaluate(async()=>{
      const values=[],longTaskDurations=[];const observer=new PerformanceObserver(list=>longTaskDurations.push(...list.getEntries().map(e=>e.duration)));observer.observe({type:'longtask'});
      for(let i=0;i<5;i++){pulse.draw();pulse.svg.getBBox();}
      for(let i=0;i<30;i++) {
        await new Promise(requestAnimationFrame);const points=pulse.points.map((p,j)=>j===pulse.points.length-1?{...p,mspt:12+(i%2)*4}:p);
        const start=performance.now(),timing=pulse.draw(points);pulse.svg.getBBox();const flushMs=performance.now()-start;
        await new Promise(requestAnimationFrame);values.push({...timing,flushMs});
      }
      observer.disconnect();values[0].observedLongTasks=longTaskDurations;return values;
    });
    const complete=new Promise(r=>client.once('Tracing.tracingComplete',r));await client.send('Tracing.end');await complete;client.off('Tracing.dataCollected',onTrace);
    const eventTotal=name=>trace.filter(e=>e.name===name&&e.ph==='X').reduce((sum,e)=>sum+(e.dur||0),0)/1000;
    const summary={width,theme,requestedSlots:count,captures:measurements[0].marks,cpuThrottle:throttle,iterations:30,
      geometryMedianMs:percentile(measurements.map(m=>m.geometryMs),.5),geometryP95Ms:percentile(measurements.map(m=>m.geometryMs),.95),
      submitMedianMs:percentile(measurements.map(m=>m.submitMs),.5),flushMedianMs:percentile(measurements.map(m=>m.flushMs),.5),flushP95Ms:percentile(measurements.map(m=>m.flushMs),.95),
      paintTotalMs:eventTotal('Paint'),rasterTotalMs:eventTotal('RasterTask'),layoutTotalMs:eventTotal('Layout'),styleTotalMs:eventTotal('UpdateLayoutTree'),
      ...Object.fromEntries(['pathBytes','svgNodes','plotWidth','averagePitchPx','averageMarkWidthPx'].map(k=>[k,measurements[0][k]])),
      longTasks:trace.filter(e=>e.name==='RunTask'&&e.dur>100000).length,observedLongTasksMs:measurements[0].observedLongTasks};
    const file=`pulse-${width}-${theme}-${count}-cpu${throttle}.png`;
    if(throttle===1){await page.screenshot({path:join(out,file),fullPage:true});summary.file=file;
      await page.locator('.pulse-plot svg').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');assert.ok((await page.locator('.sample-readout').textContent()).includes('Paper health fixture'));
      await page.locator('.inspect summary').click();await page.evaluate(()=>pulse.inspect(pulse.points.findIndex(p=>p.mspt>100)));
      const lensFile=`pulse-lens-${width}-${theme}-${count}.png`;await page.screenshot({path:join(out,lensFile),fullPage:false});summary.lensFile=lensFile;
      const detail=await page.evaluate(()=>({rows:document.querySelectorAll('tbody tr').length,pages:document.querySelector('.page-label').textContent,selected:document.querySelector('.sample-readout').textContent}));assert.equal(detail.rows,100);summary.inspection=detail;
    }
    await writeFile(join(out,`trace-${width}-${theme}-${count}-cpu${throttle}.json`),JSON.stringify({traceEvents:trace}));
    result.pulseRuns.push(summary);console.log(JSON.stringify(summary));
  }
  assert.equal(result.errors.length,0);result.status='PASS executed experiments; readability requires design judgement';
} finally {
  await writeFile(join(out,'results.json'),JSON.stringify(result,null,2)+'\n');
  next?.kill('SIGTERM');await fixture?.close();await browser?.close();server.close();
}
