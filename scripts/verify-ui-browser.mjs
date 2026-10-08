// Native Chromium on the real Dashboard + signed local relay. Agents/operations are simulated.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createFleetFixture} from './support/fleet-fixture.mjs';
const output='docs/ui-evidence/after';
await mkdir(output,{recursive:true});
let browser,next,fixture;
const result={schemaVersion:1,sourceCommit:(process.env.PLEXON_SOURCE_COMMIT??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'})).trim(),capturedAt:new Date().toISOString(),environment:'Chromium / local Next development server / signed standalone relay / simulated agents',widths:[360,390,768,1024,1440,1920],views:[],errors:[],accessibility:[],interactions:[]};
try {
  let backupJob=null;
  fixture=await createFleetFixture({port:8788,names:['PlexonCraft','TonimSMP'],instanceKeys:['plexoncraft','tonimsmp'],intervalMs:250,richerTelemetry:true,
    async beforeActionResult({body,room}) {
      if(body.action==='players.snapshot.request') {
        const data={snapshotId:randomUUID(),capturedAt:new Date().toISOString(),players:roster(room)};
        await room.paper.send('inventory.players',{...data,offset:0,complete:true});
        return {data};
      }
      if(body.action.startsWith('console.history'))return {data:{lines:Array.from({length:24},(_,i)=>({capturedAt:new Date(Date.now()-(24-i)*1000).toISOString(),content:i===23?'Fixture journal: world save completed':`Fixture journal entry ${i+1}: ${i%7===0?'slow task observed':'server tick completed'}`,level:i%7===0?'WARN':'INFO',source:'HOST',journalCursor:`fixture-${room.key}-${i}`,journalEpoch:'fixture-epoch'})),hasMore:false}};
      if(body.action==='maintenance.status')return {data:{commandChannel:{enabled:true},currentOperation:backupJob??{}}};
      if(body.action==='maintenance.settings.get')return {data:{settings:{schemaVersion:3,timezone:'UTC',restart:{},fullRestorePoint:{canonicalFilename:'Fixture-Latest.zip'}}}};
      if(body.action==='backup.full.list')return {data:{backups:[],recoveryRequired:false}};
      if(body.action==='provider.status')return {data:{configured:true,status:'CONNECTED',remote:'gdrive:plexonpanel/fixture'}};
      if(body.action==='backup.preflight')return {data:{hostAuthenticated:true,backupRootWritable:true,commandChannelConfigured:true,usableBytes:10000000000,requiredBytes:10000000,provider:'RCLONE',providerStatus:'CONNECTED'}};
    }});
  function roster(room) {
    return room.nativePlayers??=Array.from({length:room.players},(_,i)=>({uuid:randomUUID(),name:`${room.key==='plexoncraft'?'Craft':'Tonim'}Player${i+1}`,world:'Survival',pingMillis:28+i*17,gameMode:'SURVIVAL',health:20,maximumHealth:20,onlineDurationMillis:3600000+i*60000,sessionId:randomUUID(),sessionStartedAt:new Date(Date.now()-3600000).toISOString()}));
  }
  const seedSignedContent=async()=>{for(const room of fixture.rooms){await room.paper.send('inventory.players',{snapshotId:randomUUID(),capturedAt:new Date().toISOString(),players:roster(room),offset:0,complete:true});await room.paper.send('inventory.plugins',{snapshotId:randomUUID(),capturedAt:new Date().toISOString(),offset:0,plugins:[{name:'PlexonPanel',version:'5.0.0',authors:['Fixture team'],enabled:true},{name:'FixturePermissions',version:'1.0.0',authors:['Fixture team'],enabled:true},{name:'FixtureChat',version:'2.0.0',authors:['Fixture team'],enabled:true},{name:'FixtureMaintenance',version:'1.0.0',authors:['Fixture team'],enabled:false}]});for(const [i,content] of ['Welcome to the fixture survival world.','Meet at the village after the next world save.','The build is ready for review.'].entries())await room.paper.send('chat.message',{messageId:randomUUID(),capturedAt:new Date().toISOString(),playerName:roster(room)[i%room.players].name,content});}};
  next=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1'],{env:{...process.env,NEXT_PUBLIC_PLEXON_RELAY_URL:fixture.base,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','ignore','inherit']});
  let ready=false;for(let i=0;i<200;i++){if(next.exitCode!==null)throw new Error('Next exited during startup');try{const response=await fetch(fixture.origin,{signal:AbortSignal.timeout(5000)});if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'Next startup timed out');
  const executable=process.env.PLEXON_CHROMIUM_EXECUTABLE;
  browser=await chromium.launch({headless:true,...(executable?{executablePath:executable,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
  result.browserVersion=browser.version();
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
  page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(30000);await page.goto(fixture.origin);await page.screenshot({path:output+'/pairing-1440-light.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:output+'/pairing-390-light.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(async credentials=>{await new Promise((resolve,reject)=>{const r=indexedDB.open('plexonpanel-browser-v3',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>{const db=r.result,tx=db.transaction('workspace','readwrite'),s=tx.objectStore('workspace');for(const c of credentials)s.put(c,'credential:'+c.serverId);s.put(credentials[0].serverId,'selected');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}})},fixture.credentials);
  await page.reload();await page.getByRole('heading',{name:'Your servers'}).waitFor();await page.waitForTimeout(1200);
  await page.screenshot({path:output+'/fleet-1440-light.png',fullPage:true});
  const check=async(name,width,theme)=>{
    await page.setViewportSize({width,height:width<800?844:1000});
    await page.waitForTimeout(300);
    const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:document.querySelectorAll('*').length}));
    assert.ok(size.scroll<=size.width,`${name} ${width} overflows (${size.scroll})`);
    result.views.push({name,width,theme,...size});
  };
  for(const width of result.widths)await check('Fleet',width,'light');await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:/Open PlexonCraft/}).click();await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();
  await seedSignedContent();
  const sections=['Overview','Performance','Players','Console','Chat','Plugins','Server','Backups','Configuration','Audit','Access','Settings'];
  const navigate=async name=>{if(await page.getByRole('button',{name:'Open navigation',exact:true}).isVisible())await page.getByRole('button',{name:'Open navigation',exact:true}).click();const start=performance.now();await page.locator('.workspace-nav').getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name,exact:true,level:1}).waitFor();await page.waitForTimeout(200);result.interactions.push({action:'navigate '+name,milliseconds:performance.now()-start});};
  const verifyPopulated=async name=>{const text={Players:'CraftPlayer1',Console:'Fixture journal: world save completed',Chat:'Meet at the village after the next world save.',Plugins:'FixturePermissions'}[name];if(text){await page.getByText(text,{exact:true}).first().waitFor();result.interactions.push({action:'populated '+name,transport:'signed Paper inventory/chat or scoped Host history response'});}};
  for(const name of sections){await page.setViewportSize({width:1440,height:1000});await navigate(name);await verifyPopulated(name);await page.waitForTimeout(300);console.log('Verify light: '+name);for(const width of result.widths)await check(name,width,'light');await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:output+'/'+name.toLowerCase()+'-1440-light.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/'+name.toLowerCase()+'-390-light.png',fullPage:true});
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();result.accessibility.push({name,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
  }
  await page.setViewportSize({width:1440,height:1000});await navigate('Overview');
  await page.evaluate(()=>{localStorage.setItem('plexonpanel-ui-preferences-v1',JSON.stringify({schemaVersion:1,theme:'dark',textScale:125,contrast:'high',motion:'off'}));});await page.reload();await page.getByRole('heading',{name:'Your servers'}).waitFor();await page.getByRole('button',{name:/Open PlexonCraft/}).click();await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();
  await seedSignedContent();
  for(const name of sections){await page.setViewportSize({width:1440,height:1000});await navigate(name);await verifyPopulated(name);console.log('Verify dark/125%: '+name);for(const width of result.widths){await check(name,width,'dark/high contrast/125%/motion off');if(name==='Overview'||width===1440||width===390)await page.screenshot({path:output+`/${name.toLowerCase()}-${width}-dark-125.png`,fullPage:true});}await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();result.accessibility.push({name:name+' dark/125%',violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});}await page.setViewportSize({width:1440,height:1000});await navigate('Overview');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.keyboard.press('Escape');assert.ok(await page.getByRole('button',{name:'Open navigation',exact:true}).isVisible());
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Appearance'}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  const select=page.getByRole('combobox',{name:'Selected server'});await select.click();await page.getByRole('option').filter({hasText:'TonimSMP'}).click();await page.waitForTimeout(600);assert.ok(await page.locator('.workspace-server-identity').getByText('TonimSMP',{exact:true}).isVisible());
  await select.click();await page.getByRole('option').filter({hasText:'PlexonCraft'}).click();await page.waitForTimeout(600);
  fixture.rooms[0].paper.socket.close();await page.waitForTimeout(150);fixture.rooms[0].captureOffsetMs=60000;await fixture.attach(fixture.rooms[0],'PAPER');await fixture.sync(fixture.rooms[0]);await fixture.telemetry();await page.waitForTimeout(1300);await page.screenshot({path:output+'/overview-stale.png',fullPage:true});assert.match(await page.locator('.workspace-health').innerText(),/telemetry unavailable/);
  fixture.rooms[0].captureOffsetMs=0;await fixture.telemetry();await page.waitForTimeout(600);
  fixture.rooms[0].paper.socket.close();await page.waitForTimeout(700);await page.screenshot({path:output+'/overview-paper-offline.png',fullPage:true});
  fixture.rooms[0].serviceState='inactive';await fixture.telemetry();await page.waitForTimeout(600);await page.screenshot({path:output+'/overview-stopped.png',fullPage:true});assert.match(await page.locator('.workspace-health').innerText(),/Minecraft stopped/);
  await fixture.attach(fixture.rooms[0],'PAPER');await fixture.sync(fixture.rooms[0]);fixture.rooms[0].serviceState='active';await fixture.telemetry();
  await navigate('Backups');backupJob={operationId:'00000000-0000-4000-8000-000000000001',jobId:'00000000-0000-4000-8000-000000000001',type:'FULL_BACKUP',phase:'UPLOADING_REMOTE',startedAt:new Date().toISOString()};await page.getByRole('button',{name:'Refresh',exact:true}).last().click();await page.waitForTimeout(500);await page.getByRole('heading',{name:'Active Host operation',exact:true}).waitFor();await page.screenshot({path:output+'/backup-uploading.png',fullPage:true});
  await navigate('Performance');
  const session=await context.newCDPSession(page);await session.send('Performance.enable');
  const snapshots=[];const duration=Number(process.env.PLEXON_UI_SOAK_MS??60000),start=Date.now();
  while(Date.now()-start<duration){await page.waitForTimeout(Math.min(10000,duration));const metrics=await session.send('Performance.getMetrics');snapshots.push({at:Date.now()-start,metrics:Object.fromEntries(metrics.metrics.filter(m=>['JSHeapUsedSize','Nodes','TaskDuration','ScriptDuration','LayoutCount','RecalcStyleCount'].includes(m.name)).map(m=>[m.name,m.value]))});}
  result.soak={durationMs:Date.now()-start,telemetryIntervalMs:250,snapshots};
  assert.equal(result.errors.length,0,'Browser JS errors');
  assert.equal(result.accessibility.flatMap(a=>a.violations).length,0,'WCAG A/AA automated violations');
  result.status='PASS';
  console.log(JSON.stringify({views:result.views.length,axeViolations:result.accessibility.flatMap(a=>a.violations).length,soakMs:result.soak.durationMs,errors:result.errors.length}));
} catch(error) { result.status='FAIL';result.failure=error.message;throw error; } finally {
  await writeFile(output+'/browser-results.json',JSON.stringify(result,null,2)+'\n');
  next?.kill('SIGTERM');
  if(browser)await Promise.race([browser.close(),new Promise(r=>setTimeout(r,2000))]);
  if(fixture)await Promise.race([fixture.close(),new Promise(r=>setTimeout(r,2000))]);
  setTimeout(()=>process.exit(),250).unref();
}
