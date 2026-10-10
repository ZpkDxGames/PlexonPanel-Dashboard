import test from 'node:test';
import assert from 'node:assert/strict';
import {tickObservations,nearestCapture} from '../.test-dist/lib/tick-pulse-observations.js';
import {metricSeries} from '../.test-dist/lib/metric-reports.js';
const row=(paperHealth,tps=20,mspt=12)=>({at:999,sources:{paperHealth,paperSystem:700,hostSystem:800,service:900},tps,mspt,hostCpu:35,processCpu:22,serviceCpu:150});
test('Pulse uses only source captures, preserves null and zero, deduplicates and sorts',()=>{
 assert.deepEqual(tickObservations([{at:1,tps:20,mspt:1},row(null),row(40,null,null),row(20,0,0),row(20,0,0),row(30,-1,Infinity)]),[{capturedAt:20,tps:0,mspt:0},{capturedAt:30,tps:null,mspt:null},{capturedAt:40,tps:null,mspt:null}]);
});
test('Host repeats do not manufacture Paper captures or merge CPU meanings',()=>{
 const rows=[row(10),{...row(10),at:200},{...row(10),at:300}];
 assert.equal(tickObservations(rows).length,1);
 for(const [field,value] of [['hostCpu',35],['processCpu',22],['serviceCpu',150]])assert.deepEqual(metricSeries(rows,field,5,1000).map(p=>p.value),[value]);
});
test('exact capture lookup retains endpoints and deterministically chooses the earlier equidistant capture',()=>{
 const c=tickObservations([row(10),row(20),row(30)]);
 for(const [at,index] of [[-1,0],[10,0],[15,0],[16,1],[25,1],[100,2]])assert.equal(nearestCapture(c,at),index);
 assert.equal(nearestCapture([],1),-1);
});
