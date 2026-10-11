import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FleetFeed, type FleetSnapshot } from '../src/adapter/fleet-feed';
import { ACTION_CONTRACT_ID } from '../src/adapter/scopes';
import type { RelayCredential } from '../src/adapter/browser-store';
class Socket {
  readyState=1; closed=0;
  onopen: (()=>void)|null=null; onclose: ((event:{code:number})=>void)|null=null; onmessage: ((event:{data:string})=>void)|null=null; onerror: (()=>void)|null=null;
  send(){} close(){this.closed++;this.readyState=3;}
}
const credential=(id:string): RelayCredential=>({serverId:id,protocolVersion:3,deviceId:'device',name:'Fixture',role:'Viewer',scopes:['overview.view'],accessToken:'synthetic-only',websocketUrl:'wss://relay.example/v1/dashboard',expiresAt:new Date(Date.now()+60000).toISOString()});
test('fleet caps passive connections, ignores other room data and cleans up each roster replacement', async () => {
  const sockets:Socket[]=[]; let observed: FleetSnapshot[] | undefined;
  const feed=new FleetFeed(value=>{observed=value;},{grant:async c=>({...c,token:c.accessToken,actionContract:ACTION_CONTRACT_ID}),socket:()=>{const s=new Socket();sockets.push(s);return s as unknown as WebSocket;}});
  for(let cycle=0;cycle<20;cycle++) {
    const creds=Array.from({length:30},(_,i)=>credential(`${cycle}-${i}`));feed.updateRoster(creds,creds[0].serverId);await Promise.resolve();await Promise.resolve();
    assert.equal(sockets.filter(s=>!s.closed).length,15);
    const current=sockets.filter(s=>!s.closed)[0];current.onmessage?.({data:JSON.stringify({type:'dashboard.ready',serverId:'wrong-room',protocolVersion:3})});
    assert.ok(observed?.every(s=>s.state.serverId===s.serverId));
  }
  feed.close();assert.ok(sockets.every(s=>s.closed===1));
});
