import {firefox,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const base='http://127.0.0.1:4173',b=await firefox.launch(),results=[],errors=[];
try {
 for(const width of [1440,390]) {
  const c=await b.newContext({viewport:{width,height:width===390?844:900},forcedColors:'active',reducedMotion:'reduce'});
  await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  await c.addInitScript(()=>localStorage.setItem('plexon:preferences',JSON.stringify({motion:'full',skinProvider:'disabled',timezone:'browser'})));
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`${base}/?fixture=healthy#Overview`);await p.locator('.overview-grid').waitFor();
  await p.clock.setFixedTime(new Date('2026-10-16T18:00:00Z'));
  for(const route of ['Fleet','Overview','Performance','Players','Console','Backups','Access','Settings']) {
   await p.evaluate(async route=>{
    const {session}=await import('/src/adapter/session.ts');
    const {makeFixture,fixtureAction}=await import('/src/development/fixtures.ts');
    const {preferences}=await import('/src/store/preferences.ts');
    preferences.update({timezone:'browser'});location.hash=route;
    session.installFixture('accessibility',makeFixture('healthy'),fixtureAction);
   },route);
   await p.locator('.route-skeleton').waitFor({state:'detached'});
   await expect(p.locator('.workspace-heading h1')).toHaveText(route==='Console'?'Console & chat':route==='Access'?'Access & audit':route);
   if(route==='Backups')await expect(p.locator('.job-book')).toContainText('DEGRADED');
   if(route==='Access')await expect(p.locator('.audit-workspace tbody')).toContainText('maintenance.full-backup.create');
   if(route==='Players'){await p.locator('.player-row').first().click();await p.locator('.history-entry time').waitFor();}
   const stateBefore=await p.evaluate(async()=>{const {session}=await import('/src/adapter/session.ts');const s=session.getSnapshot().state;return JSON.stringify({history:s.history,receipts:s.receipts,console:s.console,server:s.server.capturedAt,host:s.hostSystem.capturedAt});});
   await p.evaluate(async()=>{const {preferences}=await import('/src/store/preferences.ts');preferences.update({timezone:'UTC'});});
   await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const stateAfter=await p.evaluate(async()=>{const {session}=await import('/src/adapter/session.ts');const s=session.getSnapshot().state;return JSON.stringify({history:s.history,receipts:s.receipts,console:s.console,server:s.server.capturedAt,host:s.hostSystem.capturedAt});});
   expect(stateAfter).toBe(stateBefore);
   if(route==='Fleet') {
    const expected=await p.evaluate(async()=>{const {session}=await import('/src/adapter/session.ts');return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(Date.parse(session.getSnapshot().state.server.capturedAt));});
    await expect(p.locator('.server-directory time').first()).toHaveText(expected);
   }
   if(route==='Backups'||route==='Access') {
    const times=p.locator(route==='Backups'?'.backup-table time':'.audit-workspace time');
    expect(await times.count()).toBeGreaterThan(0);
    for(const time of await times.all()) {
     const at=await time.getAttribute('title');
     const expected=await p.evaluate(at=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(Date.parse(at)),at);
     await expect(time).toHaveText(expected);
    }
   }
   if(route==='Players') {
    const expected=await p.evaluate(()=>new Date(Date.now()-500000).toLocaleString(undefined,{timeZone:'UTC'}));
    await expect(p.locator('.history-entry time')).toHaveText(expected);
   }
   if(route==='Overview') {
    for(const time of await p.locator('.preview-line time').all()) {
     const at=await time.getAttribute('title');
     const expected=await p.evaluate(at=>new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'UTC'}).format(Date.parse(at)),at);
     await expect(time).toHaveText(expected);
    }
   }
   if(route==='Console') {
    const expected=await p.evaluate(async()=>{const {session}=await import('/src/adapter/session.ts');const f=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit',fractionalSecondDigits:3,hour12:false,timeZone:'UTC'});return session.getSnapshot().state.console.map(x=>f.format(Date.parse(x.capturedAt)));});
    const actual=await p.locator('.terminal-line time').allTextContents();expect(actual.length).toBeGreaterThan(0);expect(actual.every(time=>expected.includes(time))).toBe(true);
   }
   if(route==='Performance') {
    await p.getByRole('button',{name:'View data',exact:true}).click();
    const expected=await p.evaluate(async()=>{const {session}=await import('/src/adapter/session.ts');const {historyFor}=await import('/src/presentation/telemetry.ts');const points=historyFor(session.getSnapshot().state.history,'paperHealth').filter(point=>Number.isFinite(point.tps));return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'UTC'}).format(points.at(-50).at);});
    await expect(p.getByRole('region',{name:'Tick rate sample table',exact:true}).locator('tbody tr').first().locator('td').first()).toHaveText(expected);
   }
   const media=await p.evaluate(()=>({forced:matchMedia('(forced-colors: active)').matches,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,duration:parseFloat(getComputedStyle(document.querySelector('.route-stage')).animationDuration),stroke:[...document.querySelectorAll('.chart-line')].map(x=>getComputedStyle(x).stroke)}));
   expect(media.forced).toBe(true);expect(media.reduced).toBe(true);expect(media.duration).toBeLessThanOrEqual(.001);expect(media.stroke.every(s=>s!=='none'&&s!=='transparent')).toBe(true);
   const violations=(await new AxeBuilder({page:p}).analyze()).violations.map(v=>v.id);expect(violations).toEqual([]);
   expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
   results.push({route,width,sourceHead,forcedColors:true,osReduceOverridesFullPreference:true,UTCDisplayAndRawClocksPreserved:true,violations});
  }
  await c.close();
 }
 expect(errors).toEqual([]);
} finally {
 await mkdir('artifacts/nextgen',{recursive:true});await writeFile('artifacts/nextgen/accessibility-final.json',JSON.stringify({sourceHead,browser:b.version(),results,errors},null,2));await b.close();
}
console.log(JSON.stringify({cases:results.length,errors}));
