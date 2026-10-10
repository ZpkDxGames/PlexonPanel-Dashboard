// Ordinary release regressions for receipt-aware telemetry freshness.
import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const rootPath=path.resolve(process.env.REGRESSION_ROOT||'.');
const moduleAt=async name=>import(pathToFileURL(path.join(rootPath,'.test-dist',name)));
const {classifyTelemetry}=await moduleAt('lib/telemetry-freshness.js');
const {applyControlMessage,emptyControlState}=await moduleAt('lib/control-state.js');
const {connectionState}=await moduleAt('lib/connection-state.js');
const {OverviewView}=await moduleAt('app/overview-view.js');
const {TelemetryChart}=await moduleAt('app/telemetry-chart.js');
const {UiPreferencesProvider}=await moduleAt('components/ui-preferences-provider.js');
const {bindLiveSocket}=await moduleAt('lib/data-source.js');
const TickPulse=existsSync(path.join(rootPath,'.test-dist/app/charts/tick-pulse.js'))?(await moduleAt('app/charts/tick-pulse.js')).TickPulse:null;
const originalNow=Date.now;let now=originalNow();
const iso=offset=>new Date(now+offset).toISOString();
function ready(session){return {type:'dashboard.ready',protocolVersion:3,serverId:'fixture-server',device:{deviceId:'fixture-device',role:'Owner',scopes:[]},agents:{paper:true,host:true,hostInstalled:true},server:{serverName:'Fixture server',paperSession:session,hostSession:'host-session',hostTargetCompatible:true,paperTargetCompatible:true}};}
function capture(state,offset=0,session='paper-1'){
  for(const [eventType,body] of [['telemetry.server',{capturedAt:iso(offset),tps:[20],averageTickMillis:12,onlinePlayers:3,maximumPlayers:20}],['telemetry.system',{capturedAt:iso(offset),jvmHeapUsedBytes:1e9,jvmHeapMaximumBytes:4e9}]])state=applyControlMessage(state,{type:'server.event',serverId:state.serverId,agentKind:'PAPER',agentSession:session,eventType,body});
  return applyControlMessage(state,{type:'server.event',serverId:state.serverId,agentKind:'HOST',agentSession:'host-session',eventType:'service.status',body:{state:'active',minecraftReady:true,resources:{capturedAt:iso(0),scope:'MINECRAFT_SERVICE',source:'SYSTEMD_CGROUP',cpuAvailable:true,cpuUnit:'PERCENT_OF_ONE_CORE',cpuPercent:150,memoryAvailable:true,memoryBytes:2e9}}});
}
function state(offset=0){return capture(applyControlMessage(emptyControlState('fixture-server'),ready('paper-1')),offset);}
const props=s=>({state:s,connected:true,can:()=>false,notice(){},run:async()=>{throw new Error('No mutations in regression replay');}});
const spec={field:'tps',label:'Tick health',shortLabel:'TPS',format:n=>`${n.toFixed(2)} TPS`,source:'paper-health',domain:[0,20],series:1};
function tile(document,field){return document.querySelector(`[data-instrument="${field}"]`)||[...document.querySelectorAll('.metric-tile')].find(n=>n.textContent.startsWith({tps:'TPS',mspt:'MSPT',players:'Online players',heap:'JVM heap',serviceCpu:'Service CPU'}[field]));}
async function mounted(fn,rate=500){
  const dom=new JSDOM('<div id="root"></div>',{pretendToBeVisual:true,url:'http://localhost'});const saved=new Map();
  const originalInterval=globalThis.setInterval,originalClear=globalThis.clearInterval;const timers=new Map();let nextTimer=0;
  dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  dom.window.localStorage.setItem('plexonpanel-ui-preferences-v1',JSON.stringify({schemaVersion:1,displayUpdateRateMs:rate,motion:'off'}));
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,WebSocket:{OPEN:1},IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
  Date.now=()=>now;globalThis.setInterval=callback=>{timers.set(++nextTimer,callback);return nextTimer;};globalThis.clearInterval=id=>timers.delete(id);
  const {createRoot}=await import('react-dom/client');const root=createRoot(dom.window.document.getElementById('root'));
  const render=async children=>act(async()=>root.render(React.createElement(UiPreferencesProvider,null,children)));
  try{await fn({document:dom.window.document,window:dom.window,render,timers,tick:async ms=>{now+=ms;await act(async()=>{for(const callback of timers.values())callback();});}});}finally{await act(async()=>root.unmount());bindLiveSocket(null);Date.now=originalNow;globalThis.setInterval=originalInterval;globalThis.clearInterval=originalClear;dom.window.close();for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
}
test('receipt-aware classifier preserves skew values and expires stopped receipts',()=>{
 const receivedAt=now;
 for(const seconds of [6,30,120]){
  const capturedAt=iso(seconds*1000);
  assert.equal(classifyTelemetry({capturedAt,receivedAt,connected:true,now}).kind,'skew');
  assert.equal(classifyTelemetry({capturedAt,receivedAt,connected:true,now:now+10001}).kind,'delayed');
  const expired=classifyTelemetry({capturedAt,receivedAt,connected:true,now:now+30001});assert.equal(expired.kind,'stale');assert.equal(expired.usable,false);assert.match(expired.label,/clock skew/);
 }
 assert.equal(classifyTelemetry({capturedAt:iso(4000),receivedAt,connected:true,now}).kind,'live');
 assert.equal(classifyTelemetry({capturedAt:iso(-60000),receivedAt,connected:true,now}).kind,'stale');
});
for(const seconds of [6,30,120])test(`Overview, chart, compact Pulse and banner agree at +${seconds} s`,async()=>mounted(async({document,render})=>{
 const s=state(seconds*1000);
 await render(React.createElement(React.Fragment,null,React.createElement(OverviewView,props(s)),React.createElement(TelemetryChart,{history:s.history,spec,windowMinutes:5,sourceLabel:'Paper health',sourceIntervalMs:2000,sourceCapturedAt:Date.parse(s.server.capturedAt),receivedAt:s.updatedAt,status:'stale'}),React.createElement(TickPulse,{history:s.history,receivedAt:s.updatedAt,compact:true,status:'live'})));
 for(const field of ['tps','mspt','players','heap']){assert.notEqual(tile(document,field).querySelector('strong').textContent,'—');assert.ok(tile(document,field).textContent.includes(`clock skew +${seconds} s`));}
 assert.equal(tile(document,'serviceCpu').querySelector('strong').textContent,'150.0%');
 assert.match(connectionState(s,'live',now).detail,/clock.*ahead/);assert.doesNotMatch([...document.querySelectorAll('[data-instrument="tps"], [data-instrument="mspt"], [data-instrument="players"], [data-instrument="heap"], .tick-pulse, .pp-chart')].map(n=>n.textContent).join(' '),/Last sample 0\.0s ago|\blive\b/i);
 assert.match(document.querySelector('.pp-chart').textContent,/Clock skew/);
 assert.match(document.querySelector('.tick-pulse-compact').textContent,/clock skew/);
}));
for(const rate of [0,500,2000])test(`skew receipt clock advances at Display rate ${rate}`,async()=>mounted(async({document,render,timers,tick})=>{
 const s=state(12000);await render(React.createElement(OverviewView,props(s)));assert.equal(timers.size,1);
 await tick(11000);assert.match(tile(document,'tps').textContent,/delayed.*clock skew/);
 await tick(20000);assert.equal(tile(document,'tps').querySelector('strong').textContent,'—');assert.match(tile(document,'tps').textContent,/stale.*clock skew/);
},rate));
test('new Paper session clears source receipts and accepts first captures with missing uptime',async()=>mounted(async({document,render})=>{
 let s=state(12000);s=applyControlMessage(s,ready('paper-2'));assert.equal(s.receipts?.paperHealth,undefined);s=capture(s,0,'paper-2');await render(React.createElement(OverviewView,props(s)));assert.equal(tile(document,'tps').querySelector('strong').textContent,'20.00');assert.doesNotMatch(document.body.textContent,/clock skew/);assert.match(document.querySelector('.overview-identity').textContent,/Paper uptimeNot supplied/);
}));

const {clockDiagnostics}=await moduleAt('lib/clock-diagnostics.js');
test('clock diagnostics separate Paper, Host, receipt and capture offsets without speculating',()=>{
 const input={now,paperCapturedAt:iso(12000),paperReceivedAt:now,hostCapturedAt:iso(12000),hostReceivedAt:now};
 assert.match(clockDiagnostics(input).interpretation,/Server clock and this browser disagree/);
 assert.match(clockDiagnostics({...input,hostCapturedAt:iso(0)}).interpretation,/Paper-side timestamp issue/);
 assert.equal(clockDiagnostics({...input,paperCapturedAt:iso(0),hostCapturedAt:iso(0)}).interpretation,'Clocks agree.');
 assert.equal(clockDiagnostics({...input,hostCapturedAt:undefined}).interpretation,'Not enough data.');
 assert.equal(clockDiagnostics({...input,paperCapturedAt:iso(-60000)}).rows.find(r=>r[0]==='Paper offset')[1],'−60.0 s');
});
test('mounted Clocks disclosure copies only the already observed diagnostic values',async()=>mounted(async({document,window,render})=>{
 const s=state(12000);let copied;Object.defineProperty(window.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});
 await render(React.createElement(OverviewView,props(s)));
 const clocks=document.querySelector('[aria-label="Clocks"]');assert.match(clocks.textContent,/Paper offset\+12\.0 s/);assert.match(clocks.textContent,/Paper-side timestamp issue/);
 await act(async()=>clocks.querySelector('button').click());assert.match(copied,/Browser time now:/);assert.match(copied,/Paper browser receipt:/);assert.doesNotMatch(copied,/token|credential|secret/i);
}));

test('memoized instruments disclose each actual Paper receipt and ignore unrelated Host traffic',async()=>mounted(async({document,render})=>{
 let s=state();const first=s.receipts.paperHealth;await render(React.createElement(OverviewView,props(s)));
 const disclosed=()=>[...tile(document,'tps').querySelectorAll('dl > div')].find(n=>n.querySelector('dt')?.textContent==='Latest browser receipt')?.querySelector('dd')?.textContent;
 assert.equal(disclosed(),new Date(first).toISOString());
 now+=100;s=applyControlMessage(s,{type:'server.event',serverId:s.serverId,agentKind:'PAPER',agentSession:'paper-1',eventType:'telemetry.server',body:{...s.server}});
 assert.equal(s.receipts.paperHealth,now);await render(React.createElement(OverviewView,props(s)));assert.equal(disclosed(),new Date(now).toISOString());
 const receipt=s.receipts.paperHealth;now+=100;s=applyControlMessage(s,{type:'server.event',serverId:s.serverId,agentKind:'HOST',agentSession:'host-session',eventType:'service.status',body:{...s.service}});
 await render(React.createElement(OverviewView,props(s)));assert.equal(s.receipts.paperHealth,receipt);assert.equal(disclosed(),new Date(receipt).toISOString());
}));

test('Clocks selects the most recently received Host capture instead of the largest timestamp',async()=>mounted(async({document,render})=>{
 let s=state();s={...s,hostSystem:{...s.hostSystem,capturedAt:iso(120000)},receipts:{...s.receipts,hostSystem:now-1000,service:now}};
 await render(React.createElement(OverviewView,props(s)));
 const hostOffset=()=>[...document.querySelectorAll('[aria-label="Clocks"] dl > div')].find(n=>n.querySelector('dt')?.textContent==='Host offset')?.querySelector('dd')?.textContent;
 assert.equal(hostOffset(),'+0.0 s');
 s={...s,receipts:{...s.receipts,hostSystem:now+100,service:now}};
 await render(React.createElement(OverviewView,props(s)));assert.equal(hostOffset(),'+119.9 s');
}));
