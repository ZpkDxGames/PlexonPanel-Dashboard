import test from 'node:test';
import assert from 'node:assert/strict';
import {metricSeries, metricReport, exportMetrics} from '../.test-dist/lib/metric-reports.js';
import {gapSegments} from '../.test-dist/lib/chart-geometry.js';
import {applyControlMessage,emptyControlState} from '../.test-dist/lib/control-state.js';
const now=Date.parse('2026-10-07T12:00:00Z');
const sample=(at,values={})=>({at,tps:20,mspt:4,hostCpu:0,processCpu:1,heap:100,memory:1000,players:0,gc:0,...values});
test('250ms Host updates cannot manufacture Paper samples or inflate observed p95',()=>{
 const history=Array.from({length:9},(_,i)=>sample(now-2000+i*250,{sources:{paperHealth:now-2000,paperSystem:now-2000,hostSystem:now-2000+i*250,service:null}}));
 assert.equal(metricSeries(history,'tps',5,now).length,1);
 assert.equal(metricSeries(history,'hostCpu',5,now).length,9);
 const report=metricReport(metricSeries(history,'tps',5,now),5,now,2000);
 assert.equal(report.count,1);assert.equal(report.coverage,0);assert.equal(report.p95,20);
});
test('actual source gaps break paths, future clocks are rejected and null is never a zero',()=>{
 const history=[sample(now-290000),sample(now-2000,{tps:null}),sample(now,{tps:0}),sample(now+6000)];
 const points=metricSeries(history,'tps',5,now);
 assert.equal(points.length,3);assert.equal(points[1].value,null);assert.equal(points[2].value,0);
 assert.equal(gapSegments(points,6000).length,2);
 assert.equal(metricSeries(history,'tps',1,now).length,2);
});
test('window coverage does not bridge missing captures and labels nearest-rank p95 as sampled',()=>{
 const report=metricReport([{at:now-60000,value:0},{at:now-58000,value:10},{at:now,value:20}],1,now,2000);
 assert.equal(report.count,3);assert.equal(report.p95,20);assert.ok(report.coverage<4);assert.equal(report.ageMs,0);
});
test('systemd CPU stays above 100% with explicit one-core units in scoped exports',()=>{
 const history=[sample(now,{serviceCpu:150,serviceMemory:123,sources:{paperHealth:null,paperSystem:null,hostSystem:null,service:now}})];
 const json=JSON.parse(exportMetrics(history,'server-A',5,now,'json'));
 assert.equal(json.serverId,'server-A');assert.equal(json.observations.length,2);
 const cpu=json.observations.find(row=>row.metric==='serviceCpu');assert.equal(cpu.value,150);assert.equal(cpu.unit,'% of one core');assert.equal(cpu.provenance,'source capture');
 const csv=exportMetrics(history,'server-A',5,now,'csv');assert.match(csv,/capturedAt,value,unit,source,provenance/);assert.doesNotMatch(csv,/accessToken|credential|playerName/);
});
test('service history only accepts authenticated Host cgroup resources; no wire change',()=>{
 let state={...emptyControlState('A'),ready:{agents:{host:true,paper:false},server:{hostSession:'h'}}};
 const msg={type:'server.event',serverId:'A',agentKind:'HOST',agentSession:'h',eventType:'service.status',body:{state:'active',resources:{capturedAt:new Date(now).toISOString(),scope:'MINECRAFT_SERVICE',source:'SYSTEMD_CGROUP',cpuUnit:'PERCENT_OF_ONE_CORE',cpuAvailable:true,cpuPercent:150,memoryAvailable:true,memoryBytes:123}}};
 assert.equal(applyControlMessage(state,{...msg,agentKind:'PAPER'}),state);
 state=applyControlMessage(state,msg);assert.equal(state.history.at(-1).serviceCpu,150);assert.equal(state.history.at(-1).sources.service,now);
 assert.equal(applyControlMessage(state,{...msg,serverId:'B'}),state);
 assert.equal(applyControlMessage(state,{...msg,agentSession:'old'}),state);
});
