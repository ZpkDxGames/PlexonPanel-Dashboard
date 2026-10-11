import test from "node:test";
import assert from "node:assert/strict";
import type { Sample } from "../src/adapter/control-state";
import { metricPoints, pointSegments, plotSegments, summarize, observedSpikes, gcPauseRate, formatMeasure, axisMaximum } from "../src/lib/telemetryView";
const sample = (at: number, patch: Partial<Sample> = {}): Sample => ({at,tps:null,mspt:null,hostCpu:null,processCpu:null,heap:null,memory:null,players:null,gc:null,...patch});
test("mixed source packets never resample a held Paper value or multiply spikes", () => {
  const rows = [sample(1000,{mspt:70,sources:{paperHealth:1000,paperSystem:null,hostSystem:1000,service:null}}),sample(4000,{mspt:70,sources:{paperHealth:1000,paperSystem:null,hostSystem:4000,service:null}}),sample(7000,{mspt:20,sources:{paperHealth:7000,paperSystem:null,hostSystem:4000,service:null}})];
  assert.deepEqual(metricPoints(rows,"mspt"),[{at:1000,value:70},{at:7000,value:20}]);
  assert.equal(observedSpikes(rows).length,1);
  assert.deepEqual(metricPoints(rows,"mspt",{from:3000,to:8000}),[{at:7000,value:20}]);
});
test("missing capture timestamps cannot turn carried values into observations", () => {
  const rows = [sample(1000,{heap:20,sources:{paperHealth:null,paperSystem:null,hostSystem:1000,service:null}})];
  assert.deepEqual(metricPoints(rows,"heap"),[{at:1000,value:null}]);
  assert.equal(summarize(metricPoints(rows,"heap")),null);
});
test("zero player counts and zero resource values remain valid measurements", () => {
  assert.equal(summarize(metricPoints([sample(1000,{players:0})],"players"))?.max,0);
  assert.equal(formatMeasure(0,"bytes"),"0 B");
  assert.equal(formatMeasure(null,"ms"),"—");
  assert.equal(formatMeasure(3 * 2**30,"bytes"),"3 GiB");
  assert.equal(axisMaximum([0],20),20);
});
test("line and area segments cannot bridge nulls or capture gaps", () => {
  const points=[{at:1000,value:1},{at:2000,value:2},{at:3000,value:null},{at:4000,value:3},{at:20000,value:4}];
  assert.deepEqual(pointSegments(points).map((s)=>s.map((p)=>p.at)),[[1000,2000],[4000],[20000]]);
  assert.deepEqual(plotSegments(points,4).map((s)=>s.map((p)=>p.at)),[[1000,2000],[4000],[20000]]);
});
test("large chart projections retain isolated spikes and disconnects while bounding ordinary paths", () => {
  const points=Array.from({length:8192},(_,i)=>({at:i*1000,value:i===1234?999:i===6000?null:20}));
  const segments=plotSegments(points,1400), result=segments.flat();
  assert.ok(result.length<=1400);
  assert.ok(result.some((p)=>p.value===999));
  assert.equal(segments.length,2);
  assert.equal(result[0].at,0);
  assert.equal(result.at(-1)?.at,8191000);
});
test("GC rates exclude resets and unobserved intervals instead of producing negative rates", () => {
  const rows=[sample(1000,{gc:100}),sample(6000,{gc:110}),sample(11000,{gc:5}),sample(16000,{gc:15}),sample(40000,{gc:999})];
  assert.equal(gcPauseRate(rows),120);
  assert.equal(gcPauseRate([sample(1000,{gc:100}),sample(6000,{gc:5})]),null);
});
test("nonfinite values and unordered source capture times are normalized without invention", () => {
  const points=metricPoints([sample(4000,{tps:Infinity}),sample(1000,{tps:20}),sample(2000,{tps:NaN})],"tps");
  assert.deepEqual(points,[{at:1000,value:20},{at:2000,value:null},{at:4000,value:null}]);
});
