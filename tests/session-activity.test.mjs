import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendSessionActivity, SESSION_ACTIVITY_LIMIT } from '../.test-dist/lib/session-activity.js';
const serverId='11111111-1111-4111-8111-111111111111';
const action={kind:'action',serverId,action:'console.execute',authority:'HOST',status:'SUCCESS'};
test('session tray copies only canonical metadata, never operation content or unknown error text',()=>{
 const items=appendSessionActivity([],{...action,parameters:{command:'SECRET'},message:'SECRET',code:'SECRET',content:'SECRET'},100);
 assert.equal(JSON.stringify(items).includes('SECRET'),false);
 assert.deepEqual(items,[{...action,sequence:1,observedAt:100}]);
 assert.equal(appendSessionActivity(items,{...action,action:'SECRET'},200).length,1);
 assert.equal(appendSessionActivity(items,{...action,serverId:'SECRET'},200).length,1);
});
test('session tray retains repeated completions and bounds the latest 50 items',()=>{
 let items=[];for(let i=0;i<73;i++)items=appendSessionActivity(items,action,i);
 assert.equal(items.length,SESSION_ACTIVITY_LIMIT);assert.equal(items[0].sequence,24);assert.equal(items.at(-1).sequence,73);
});
test('connection and validated backup-phase snapshots deduplicate, but real changes remain',()=>{
 const connection={kind:'connection',serverId,relay:'live',paper:true,host:false};
 let items=appendSessionActivity([],connection,1);items=appendSessionActivity(items,connection,2);assert.equal(items.length,1);
 items=appendSessionActivity(items,{...connection,host:true},3);assert.equal(items.length,2);
 const phase={kind:'backup-phase',serverId,jobId:serverId,phase:'ARCHIVING'};
 items=appendSessionActivity(items,phase,4);items=appendSessionActivity(items,phase,5);assert.equal(items.length,3);
 assert.equal(appendSessionActivity(items,{...phase,phase:'SECRET'},6).length,3);
 assert.equal(appendSessionActivity(items,{...phase,jobId:'SECRET'},6).length,3);
});
