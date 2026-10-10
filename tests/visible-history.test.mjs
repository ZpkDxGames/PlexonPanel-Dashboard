import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleHistory} from '../.test-dist/lib/visible-history.js';
test('ordered visible history uses logarithmic bounds and preserves nulls and source provenance',()=>{
 let reads=0;
 const rows=Array.from({length:8192},(_,i)=>({get at(){reads++;return i*1000;},sources:{paperHealth:i*1000-500},tps:i===8000?0:null}));
 const selected=visibleHistory(rows,8000000,8002000);
 assert.equal(selected.length,3);
 assert.equal(selected[0].tps,0);
 assert.equal(selected[1].tps,null);
 assert.equal(selected[0].sources.paperHealth,7999500);
 assert.ok(reads<60,`bounds read ${reads} timestamps`);
 assert.deepEqual(visibleHistory(rows,9000000,10000000),[]);
 assert.deepEqual(visibleHistory([],0,1),[]);
});
