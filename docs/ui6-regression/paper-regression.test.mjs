// Explicit investigation probes; run directly so a known, unfixed baseline
// defect does not silently become a skipped release test.
import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {existsSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const rootPath=path.resolve(process.env.REGRESSION_ROOT||'.');
const moduleAt=async name=>import(pathToFileURL(path.join(rootPath,'.test-dist',name)));
const {telemetryFreshness}=await moduleAt('lib/telemetry-freshness.js');
const {applyControlMessage,emptyControlState}=await moduleAt('lib/control-state.js');
const {connectionState}=await moduleAt('lib/connection-state.js');
const {fleetCard}=await moduleAt('lib/fleet-model.js');
const {OverviewView}=await moduleAt('app/overview-view.js');
const {TelemetryChart}=await moduleAt('app/telemetry-chart.js');
const {UiPreferencesProvider}=await moduleAt('components/ui-preferences-provider.js');
const {BackupsView}=await moduleAt('app/backups-view.js');
const {bindLiveSocket,handleRelayControlMessage}=await moduleAt('lib/data-source.js');
const TickPulse=existsSync(path.join(rootPath,'.test-dist/app/charts/tick-pulse.js'))?(await moduleAt('app/charts/tick-pulse.js')).TickPulse:null;
const evidence={version:process.env.REGRESSION_VERSION,skew:[],restart:null,backup:[],clock:[],receipt:null};
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
test('lib: future Paper captures at 6, 30 and 120 seconds reject independently of Host traffic',()=>{
  Date.now=()=>now;try{for(const seconds of [6,30,120]){const s=state(seconds*1000);assert.equal(s.updatedAt,now);assert.equal(telemetryFreshness(s.server.capturedAt,true,now).label,'clock mismatch');assert.equal(telemetryFreshness(s.system.capturedAt,true,now).label,'clock mismatch');assert.equal(connectionState(s,'live',now).label,'Minecraft telemetry unavailable');assert.equal(fleetCard(s,'live',now).tps,null);assert.equal(fleetCard(s,'live',now).serviceCpu,150);}}finally{Date.now=originalNow;}
});
test('lib: a new Paper session retires old captures and accepts first captures without uptime',()=>{
  Date.now=()=>now;try{let s=state();s=applyControlMessage(s,ready('paper-2'));assert.deepEqual(s.server,{});assert.deepEqual(s.system,{});s=capture(s,0,'paper-2');assert.equal(s.system.processUptimeMillis,undefined);assert.equal(connectionState(s,'live',now).kind,'online');assert.equal(fleetCard(s,'live',now).tps,20);}finally{Date.now=originalNow;}
});
for(const seconds of [6,30,120])test(`mounted Overview: ${seconds}s future capture has one consistent clock-mismatch presentation`,async()=>mounted(async({document,render})=>{
  const s=state(seconds*1000);await render(React.createElement(React.Fragment,null,React.createElement(OverviewView,props(s)),React.createElement(TelemetryChart,{history:s.history,spec,windowMinutes:5,sourceLabel:'Paper health',sourceIntervalMs:2000,sourceCapturedAt:Date.parse(s.server.capturedAt),receivedAt:s.updatedAt,status:'stale'}),TickPulse&&React.createElement(TickPulse,{history:s.history,receivedAt:s.updatedAt,compact:true,status:connectionState(s,'live',now).label})));
  const tiles=['tps','mspt','players','heap'].map(field=>({field,reading:tile(document,field).querySelector('strong').textContent,clockMismatch:tile(document,field).textContent.includes('clock mismatch')}));
  const chartAge=[...document.querySelectorAll('span')].map(n=>n.textContent).find(t=>/^Last sample/.test(t));
  evidence.skew.push({seconds,tiles,banner:connectionState(s,'live',now).label,hostCpu:tile(document,'serviceCpu').querySelector('strong').textContent,chartAge,headerPulse:TickPulse?'TickPulse mounted with stale connection status; full shell not executed':'not executed: Pulse did not exist in 5.0.0'});
  for(const result of tiles){assert.equal(result.reading,'—');assert.equal(result.clockMismatch,true);}
  assert.ok(!document.body.textContent.includes('Last sample 0.0s ago'),'A clock-mismatched capture must not simultaneously claim zero sample age');
}));
test('mounted Overview: restart first captures stay live with missing uptime',async()=>mounted(async({document,render})=>{let s=state();s=applyControlMessage(s,ready('paper-2'));s=capture(s,0,'paper-2');await render(React.createElement(OverviewView,props(s)));evidence.restart={tps:tile(document,'tps').querySelector('strong').textContent,heap:tile(document,'heap').querySelector('strong').textContent,uptimeSupplied:s.system.processUptimeMillis!==undefined};assert.equal(evidence.restart.tps,'20.00');assert.notEqual(evidence.restart.heap,'—');assert.ok(!document.body.textContent.includes('clock mismatch'));}));
for(const rate of [0,500,2000])test(`mounted Overview: one-second freshness clock remains subscribed with Display update rate ${rate}`,async()=>mounted(async({document,render,timers,tick})=>{
  const s=state();await render(React.createElement(OverviewView,props(s)));assert.equal(timers.size,1);await tick(11000);assert.ok(tile(document,'tps').textContent.includes('delayed'));await tick(20000);assert.equal(tile(document,'tps').querySelector('strong').textContent,'—');assert.ok(tile(document,'tps').textContent.includes('stale'));evidence.clock.push({displayRateMs:rate,clockSubscribers:'one shared interval',agedWithoutParentRender:true});
},rate));
test('mounted memoized Overview: unchanged capture reveals true latest browser receivedAt',{skip:!TickPulse?'not executed: per-instrument receipt disclosure did not exist in 5.0.0':false},async()=>mounted(async({document,render})=>{
  if(!document.querySelector('[data-instrument]')){const s=state();await render(React.createElement(OverviewView,props(s)));}
  if(!document.querySelector('[data-instrument]')){evidence.receipt='not executed: per-instrument receipt disclosure did not exist in 5.0.0';return;}
  const s=state();await render(React.createElement(OverviewView,props(s)));const initial=s.updatedAt;now+=100;const next={...s,updatedAt:now};await render(React.createElement(OverviewView,props(next)));
  const node=tile(document,'tps');const pairs=[...node.querySelectorAll('dl > div')];const actual=pairs.find(n=>n.querySelector('dt')?.textContent==='Latest browser receipt')?.querySelector('dd')?.textContent;
  evidence.receipt={initialReceivedAt:initial,trueReceivedAt:now,rendered:actual};assert.ok(actual?.includes(new Date(now).toISOString()),'Memoization must not retain the previous browser receipt');
}));
test('mounted Backups: replay degraded remote-verification failure with pass and fail preflight',async()=>mounted(async({document,render})=>{
  const job={jobId:'fixture-job',backupId:'fixture-backup',phase:'DEGRADED',result:'DEGRADED',errorCode:'REMOTE_VERIFY_FAILED',errorMessage:'Remote verification failed',retryable:true,localBackupVerified:true,remoteBackupVerified:false};let blocked=false;
  const socket={readyState:1,send(raw){const request=JSON.parse(raw);let data={};let status='SUCCESS',code='OK';
    if(request.action==='maintenance.status')data={currentOperation:job,commandChannel:{enabled:true}};
    if(request.action==='provider.status')data={configured:true,status:'DEGRADED',remote:'fixture-remote'};
    if(request.action==='backup.full.list')data={backups:[],recoveryRequired:false};
    if(request.action==='backup.preflight'){if(blocked){status='FAILED';code='BACKUP_SOURCE_UNREADABLE';}else data={hostAuthenticated:true,backupRootWritable:true,commandChannelConfigured:true,providerStatus:'CONNECTED',usableBytes:1e7,requiredBytes:1000};}
    queueMicrotask(()=>handleRelayControlMessage({type:'server.event',serverId:'fixture-server',agentKind:'HOST',eventType:'action.result',body:{requestId:request.requestId,action:request.action,status,code,message:blocked?'Preflight blocked':'Replay response',data}},socket));
  }};bindLiveSocket(socket,'fixture-server',{authorization:'replay-fixture',PAPER:'paper-1',HOST:'host-session'});
  for(const preflight of ['pass','fail']){blocked=preflight==='fail';await render(React.createElement(BackupsView,{...props(state()),key:preflight,can:()=>true}));await act(async()=>{await new Promise(resolve=>setTimeout(resolve,40));});const button=name=>[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===name);const launch=button('Fully Backup Now')||button('Review & start backup'),retry=button('Retry Upload');
    const facts=Object.fromEntries([...document.querySelectorAll('dl > div')].filter(n=>n.querySelector('dt')&&n.querySelector('dd')).map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent]));
    const result={preflight,phase:facts['Current phase'],errorCode:facts['Error code'],localVerification:facts['Local verification'],remoteVerification:facts['Remote verification'],phaseShown:document.body.textContent.includes('Degraded'),errorShown:document.body.textContent.includes('REMOTE_VERIFY_FAILED'),localVerified:facts['Local verification']==='Verified',launchLabel:launch?.textContent,launchDisabled:launch?.disabled,retryVisible:Boolean(retry),retryDisabled:retry?.disabled};evidence.backup.push(result);assert.ok(result.phaseShown&&result.errorShown&&result.localVerified);assert.equal(result.launchDisabled,blocked);assert.equal(result.retryVisible,true);assert.equal(result.retryDisabled,false);
  }
}));
process.on('exit',()=>{if(process.env.REGRESSION_OUTPUT)writeFileSync(process.env.REGRESSION_OUTPUT,JSON.stringify(evidence,null,2)+'\n');});
