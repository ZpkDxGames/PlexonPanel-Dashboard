import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTickPulseModel, tpsCategory } from '../.test-dist/lib/tick-pulse-model.js';
import { TICK_THRESHOLDS } from '../.test-dist/lib/tick-thresholds.js';
const capture=(capturedAt,tps=20,mspt=10)=>({capturedAt,tps,mspt});
const model=(captures,opts={})=>buildTickPulseModel({captures,windowStartAt:0,windowEndAt:100,plotWidthPx:30,gapToleranceMs:10,...opts});

test('raw selection uses the minimum actual spacing, including the exact 2px boundary',()=>{
  assert.equal(model([capture(0),capture(10)],{plotWidthPx:20}).mode,'raw');
  assert.equal(model([capture(0),capture(9)],{plotWidthPx:20}).mode,'summarized');
  assert.equal(model([capture(0),capture(50),capture(51),capture(100)],{plotWidthPx:100}).mode,'summarized','Average spacing must not hide a dense pair');
  assert.equal(model([capture(50)]).mode,'raw');
});

test('summary buckets are half-open and the exact right endpoint is retained',()=>{
  const m=model([capture(0),capture(1),capture(9.999),capture(10),capture(99.999),capture(100)]);
  assert.equal(m.mode,'summarized');assert.equal(m.summaryBucketCount,10);
  assert.deepEqual(m.buckets.map(b=>[b.index,b.captureCount,b.startAt,b.endAt]),[[0,3,0,10],[1,1,10,20],[9,2,90,100]]);
  assert.equal(m.buckets.reduce((sum,b)=>sum+b.captureCount,0),m.captures.length);
});

test('TPS thresholds retain real zero and expose unknown independently',()=>{
  for(const [value,category] of [[20,'healthy'],[19,'healthy'],[18.999,'degraded'],[15,'degraded'],[14.999,'critical'],[0,'critical'],[null,'unknown'],[NaN,'unknown'],[Infinity,'unknown'],[-1,'unknown']])assert.equal(tpsCategory(value),category);
  assert.equal(TICK_THRESHOLDS.budgetMspt,50);assert.equal(TICK_THRESHOLDS.viewportMspt,100);
  const b=model([capture(1,20,0),capture(2,null,null),capture(3,0,150)]).buckets[0];
  assert.equal(b.worstTpsCategory,'critical');assert.equal(b.unknownTpsCount,1);assert.equal(b.msptMin,0);assert.equal(b.msptMax,150);assert.equal(b.unknownMsptCount,1);
});

test('null metrics never become zero and one metric cannot supply the other',()=>{
  let b=model([capture(1,null,12),capture(2,null,50)]).buckets[0];
  assert.equal(b.worstTpsCategory,'unknown');assert.equal(b.unknownTpsCount,2);assert.equal(b.msptMin,12);assert.equal(b.msptMax,50);assert.equal(b.unknownMsptCount,0);
  b=model([capture(1,20,null),capture(2,19,null)]).buckets[0];assert.equal(b.worstTpsCategory,'healthy');assert.equal(b.msptMin,null);assert.equal(b.msptMax,null);assert.equal(b.unknownMsptCount,2);
  const normalized=model([capture(1,Infinity,NaN),capture(2,-1,-1)]);assert.deepEqual(normalized.captures,[capture(1,null,null),capture(2,null,null)]);
});

test('gaps and unobserved time remain separate even inside an occupied summary bucket',()=>{
  const m=model([capture(20),capture(21),capture(29),capture(50)],{gapToleranceMs:5});
  assert.deepEqual(m.timeRegions,[{startAt:0,endAt:20,kind:'unknown-time'},{startAt:21,endAt:29,kind:'gap'},{startAt:29,endAt:50,kind:'gap'},{startAt:50,endAt:100,kind:'unknown-time'}]);
  assert.equal(m.buckets[0].captureCount,3);assert.equal(m.observedCoverageMs,1);
  assert.ok(m.timeColumns.some(c=>c.startAt>=20&&c.startAt<30&&c.gapDurationMs>0));
  assert.ok(Math.abs(m.timeColumns.reduce((s,c)=>s+c.gapDurationMs,0)-29)<1e-9);
  assert.ok(Math.abs(m.timeColumns.reduce((s,c)=>s+c.unknownDurationMs,0)-70)<1e-9);
});

test('gap tolerance equality follows the existing report adapter and no interval is invented',()=>{
  assert.equal(model([capture(0),capture(10)]).timeRegions.filter(r=>r.kind==='gap').length,0);
  assert.equal(model([capture(0),capture(10.001)]).timeRegions.filter(r=>r.kind==='gap').length,1);
});

test('out-of-order captures are sorted, exact duplicates replace, and input is not mutated',()=>{
  const input=[capture(70),capture(10,20,12),capture(20),capture(10,0,0)];const snapshot=structuredClone(input);
  const m=model(input);assert.deepEqual(m.captures.map(c=>c.capturedAt),[10,20,70]);assert.equal(m.captures[0].tps,0);assert.equal(m.captures[0].mspt,0);assert.equal(m.duplicateCount,1);assert.deepEqual(input,snapshot);
});

test('future, invalid and outside-window captures stay in diagnostics and never become live marks',()=>{
  const m=model([capture(0),capture(10),capture(100),capture(100.001),capture(5000),capture(NaN),capture(-1)],{windowStartAt:10});
  assert.deepEqual(m.captures.map(c=>c.capturedAt),[10,100]);assert.deepEqual(m.excluded.map(e=>e.reason),['before-window','future','future','invalid-time','invalid-time']);
  assert.equal(m.excluded.length+m.captures.length,7);
});

test('empty and single observations have unknown time and zero fabricated coverage',()=>{
  const empty=model([]);assert.equal(empty.captures.length,0);assert.equal(empty.buckets.length,0);assert.equal(empty.observedCoverageMs,0);assert.deepEqual(empty.timeRegions,[{startAt:0,endAt:100,kind:'unknown-time'}]);
  const single=model([capture(50,null,null)]);assert.equal(single.observedCoverageMs,0);assert.equal(single.timeRegions.length,2);assert.deepEqual(single.captures,[capture(50,null,null)]);
});

test('8192 retained captures remain exact while raster-facing output is pixel-bounded at mobile and desktop',()=>{
  const input=Array.from({length:8192},(_,i)=>capture(i/8191*1_800_000,i%100===0?0:20,i%100===0?0:12));
  for(const plotWidthPx of [390,1920]) {
    const m=model(input,{windowEndAt:1_800_000,plotWidthPx,gapToleranceMs:6000});assert.equal(m.mode,'summarized');assert.equal(m.captures.length,8192);
    assert.ok(m.buckets.length<=Math.floor(plotWidthPx/3));assert.equal(m.buckets.reduce((s,b)=>s+b.captureCount,0),8192);assert.equal(m.timeColumns.length,plotWidthPx);
    assert.equal(m.captures.at(-1).capturedAt,1_800_000);assert.equal(m.excluded.length,0);
  }
});

test('fractional and tiny plot widths still have bounded buckets and hatch columns',()=>{
  for(const plotWidthPx of [.5,1,3,390.5]) {const m=model([capture(0),capture(.1),capture(100)],{plotWidthPx});assert.ok(m.buckets.length<=Math.max(1,Math.floor(plotWidthPx/3)));assert.equal(m.timeColumns.length,Math.ceil(plotWidthPx));}
});

test('invalid model geometry is rejected instead of fabricated',()=>{
  for(const opts of [{windowEndAt:0},{windowStartAt:-1},{windowEndAt:Infinity},{plotWidthPx:0},{plotWidthPx:NaN},{gapToleranceMs:0}])assert.throws(()=>model([],opts),RangeError);
});
