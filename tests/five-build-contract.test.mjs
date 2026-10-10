import assert from "node:assert/strict";
import test from "node:test";
import { loadControlPlaneBuilds } from "../.test-dist/lib/build-identity.js";
import { ACTION_CONTRACT_ID } from "../.test-dist/lib/scopes.js";
import { FLEET_CONTRACT_ID } from "../.test-dist/lib/fleet-contract.js";

test("five build verification requires coordinated version, protocol, action and fleet contracts", async () => {
  const originalFetch = globalThis.fetch, originalUrl = process.env.NEXT_PUBLIC_PLEXON_RELAY_URL;
  const identity = { version: "5.0.0", gitCommit: "a".repeat(40), buildTimestamp: "2026-10-02T00:00:00Z",
    protocolVersion: 3, runtimeKind: "standalone", actionContract: ACTION_CONTRACT_ID, fleetContract: FLEET_CONTRACT_ID };
  let relay = { ...identity };
  process.env.NEXT_PUBLIC_PLEXON_RELAY_URL = "https://relay.example";
  globalThis.fetch = async input => Response.json(String(input) === "/api/build" ? identity : relay);
  try {
    assert.equal((await loadControlPlaneBuilds()).status, "MATCHED");
    for (const change of [{ version: "4.0.0" }, { protocolVersion: 4 }, { fleetContract: undefined },
      { actionContract: "sha256:" + "0".repeat(64) }, { gitCommit: "b".repeat(40) }]) {
      relay = { ...identity, ...change };
      assert.equal((await loadControlPlaneBuilds()).status, "MISMATCH");
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_PLEXON_RELAY_URL;
    else process.env.NEXT_PUBLIC_PLEXON_RELAY_URL = originalUrl;
  }
});

test('six UI distinguishes contract compatibility, revision parity and unavailable evidence',async()=>{
 const originalFetch=globalThis.fetch,originalUrl=process.env.NEXT_PUBLIC_PLEXON_RELAY_URL;
 const dashboard={version:'6.0.0',gitCommit:'a'.repeat(40),buildTimestamp:'2026-10-10T00:00:00Z',protocolVersion:3,runtimeKind:'dashboard',actionContract:ACTION_CONTRACT_ID,fleetContract:FLEET_CONTRACT_ID};
 let relay={...dashboard,version:'5.0.0',gitCommit:'b'.repeat(40)};
 process.env.NEXT_PUBLIC_PLEXON_RELAY_URL='https://relay.example';globalThis.fetch=async input=>Response.json(String(input)==='/api/build'?dashboard:relay);
 try{
  assert.equal((await loadControlPlaneBuilds()).status,'COMPATIBLE');
  relay={...dashboard};assert.equal((await loadControlPlaneBuilds()).status,'MATCHED');
  for(const patch of [{protocolVersion:4},{fleetContract:undefined},{actionContract:'sha256:'+'0'.repeat(64)},{version:'4.0.0'}]){relay={...dashboard,...patch};assert.equal((await loadControlPlaneBuilds()).status,'MISMATCH');}
  relay={...dashboard,gitCommit:'unavailable'};assert.equal((await loadControlPlaneBuilds()).status,'UNVERIFIED');
 }finally{globalThis.fetch=originalFetch;if(originalUrl===undefined)delete process.env.NEXT_PUBLIC_PLEXON_RELAY_URL;else process.env.NEXT_PUBLIC_PLEXON_RELAY_URL=originalUrl;}
});
