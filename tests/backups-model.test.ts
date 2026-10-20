import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePreflight, deriveCreateGate, classifyArchive, buildStages, timeOptions, retentionOptions, FALLBACK_STAGE_LABELS, FALLBACK_STAGE_KEYS } from "../src/ui/bindings/backups-model";
const raw = { recoveryRequired:false, localBackupReady:true, offsiteBackupReady:true, sourceState:"READY", storageState:"READY", providerState:"CONNECTED", sourceBytes:2048, entryCount:3, includes:["world"], backupRootWritable:true, usableBytes:2**40, requiredBytes:268439552 };
const p = (patch={}) => normalizePreflight({...raw,...patch})!;
const gate = (patch: Partial<Parameters<typeof deriveCreateGate>[0]>={}) => deriveCreateGate({jobBusy:false,preflight:p(),mode:"AUTO",allowLocalFallback:false,...patch});
test("defensive preflight normalization and legacy successful Host fields",()=>{
  for(const value of [null,undefined,[],"bad",4]) assert.equal(normalizePreflight(value),null);
  assert.equal(normalizePreflight({})!.legacyHost,true);
  assert.equal(gate({preflight:normalizePreflight({})}).blocked,true);
  assert.equal(normalizePreflight({providerStatus:"CONNECTED",hostAuthenticated:true})!.offsiteBackupReady,true);
  assert.deepEqual(p().includes,["world"]); assert.equal(p().sourceBytes,2048);
  assert.equal(p({sourceBytes:NaN}).sourceBytes,0);
  assert.equal(p({sourceState:"oops"}).sourceState,"FAILED");
});
test("create gate keeps real priority: job, recovery, source, storage, provider",()=>{
  const down=p({recoveryRequired:true,sourceState:"FAILED",sourceErrorCode:"SOURCE_EMPTY",storageState:"FAILED",storageErrorCode:"INSUFFICIENT_DISK_SPACE",providerState:"NOT_CONFIGURED",providerErrorCode:"RCLONE_UNAVAILABLE"});
  assert.equal(gate({jobBusy:true,preflight:down}).code,"JOB_RUNNING");
  assert.equal(gate({preflight:null}).code,"PREFLIGHT_PENDING");
  assert.equal(gate({preflight:down}).code,"RECOVERY_REQUIRED");
  down.recoveryRequired=false; assert.equal(gate({preflight:down}).code,"SOURCE_EMPTY");
  down.sourceState="READY"; assert.equal(gate({preflight:down}).code,"INSUFFICIENT_DISK_SPACE");
  down.storageState="READY"; assert.equal(gate({preflight:down}).code,"RCLONE_UNAVAILABLE");
});
test("all destination, provider and fallback combinations plus legacy mode",()=>{
  for(const mode of ["AUTO","DRIVE_AND_LOCAL","LOCAL_ONLY"] as const) for(const providerState of ["CONNECTED","NOT_CONFIGURED","FAILED"] as const) for(const allowLocalFallback of [false,true]) {
    const blocked=providerState!=="CONNECTED" && (mode==="DRIVE_AND_LOCAL" || mode==="AUTO"&&!allowLocalFallback);
    assert.equal(gate({mode,allowLocalFallback,preflight:p({providerState})}).blocked,blocked,`${mode}/${providerState}/${allowLocalFallback}`);
    if(providerState!=="CONNECTED") assert.equal(gate({mode,allowLocalFallback,preflight:normalizePreflight({providerState})}).blocked,true);
  }
});
test("archive classifications require evidence, including no location",()=>{
  assert.equal(classifyArchive({local:true,offsite:true,verification:"VERIFIED_REMOTE"}),"DRIVE_AND_LOCAL");
  assert.equal(classifyArchive({local:true,verification:"VERIFIED_LOCAL"}),"LOCAL_ONLY");
  assert.equal(classifyArchive({offsite:true,verification:"VERIFIED_REMOTE"}),"DRIVE_ONLY");
  assert.equal(classifyArchive({local:true}),"UNVERIFIED");
  assert.equal(classifyArchive({verification:"VERIFIED_LOCAL"}),"UNVERIFIED");
});
test("stage fallback pins the real Java enum and handles skipped/failed states",()=>{
  assert.equal(FALLBACK_STAGE_LABELS.length,14); assert.equal(FALLBACK_STAGE_LABELS[5],"Stop service");
  const java=readFileSync(new URL("../docs/V60_BINDINGS.md",import.meta.url),"utf8");
  FALLBACK_STAGE_KEYS.forEach((key,i)=>assert.ok(java.includes(`| ${i+1} | ${key} | ${FALLBACK_STAGE_LABELS[i]} |`)));
  const stages=buildStages({currentIndex:6,failed:true,skipped:[12,13]});
  assert.equal(stages[0].state,"done"); assert.equal(stages[5].state,"failed"); assert.equal(stages[6].state,"pending"); assert.equal(stages[11].state,"skipped");
  assert.equal(buildStages({currentIndex:0})[0].state,"pending");
  assert.deepEqual(buildStages({labels:["Custom"],currentIndex:1}),[{index:1,label:"Custom",state:"current"}]);
});
test("custom stored time and retention values are retained without duplicates",()=>{
  assert.ok(timeOptions("04:07").includes("04:07")); assert.equal(timeOptions().length,48);
  assert.equal(retentionOptions(10).filter(n=>n===10).length,1); assert.ok(retentionOptions(52).includes(52));
});
