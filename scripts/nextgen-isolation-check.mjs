import { firefox, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:4173";
const browser = await firefox.launch();
const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
await context.route("**/*", r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
await context.addInitScript(() => localStorage.setItem("plexon:preferences", JSON.stringify({motion:"off",skinProvider:"disabled"})));
const page = await context.newPage(), results = [], errors = [];
page.on("pageerror", error => errors.push(error.message));
async function go(route) {
  await page.goto(`${base}/?fixture=healthy&isolation=${results.length}#${route}`);
  await page.locator(".workspace-heading h1").waitFor();
  await page.locator(".route-skeleton").waitFor({state:"detached"});
}
try {
  await go("Access");
  await expect(page.locator(".audit-workspace tbody")).toContainText("maintenance.full-backup.create");
  await page.evaluate(async () => {
    const {session} = await import("/src/adapter/session.ts");
    const original = session.query;
    session.query = function(action, parameters, kind) {
      if (action.startsWith("audit.")) {
        const result = {status:"SUCCESS",data:{entries:[{timestamp:new Date().toISOString(),actorLabel:kind,action:`${kind}_ONLY_RECORD`,target:kind,outcome:"SUCCESS"}]}};
        if (kind === "HOST") return new Promise(resolve => {window.releaseHostAudit = () => resolve(result);});
        return Promise.resolve(result);
      }
      return original.call(this,action,parameters,kind);
    };
  });
  await page.getByRole("button",{name:"Refresh access",exact:true}).click();
  await page.waitForFunction(() => typeof window.releaseHostAudit === "function");
  await page.getByLabel("Audit authority").selectOption("PAPER");
  await expect(page.locator(".audit-workspace tbody")).toContainText("PAPER_ONLY_RECORD");
  await page.evaluate(() => window.releaseHostAudit());
  await page.waitForTimeout(100);
  await expect(page.locator(".audit-workspace tbody")).not.toContainText("HOST_ONLY_RECORD");
  await expect(page.locator(".audit-workspace .eyebrow")).toContainText("PAPER");
  results.push({id:"Q22",passed:true,assertion:"Late Host audit response cannot overwrite current Paper records or label"});

  await go("Players");
  await page.locator(".player-row").first().click();
  await page.evaluate(async () => {
    const {session} = await import("/src/adapter/session.ts");
    const s = session.getSnapshot().state;
    session.receiveFixture({type:"server.event",serverId:s.serverId,agentKind:"PAPER",agentSession:"fixture-paper",eventType:"inventory.players",body:{snapshotId:"vanished",offset:0,complete:true,capturedAt:new Date().toISOString(),players:s.players.slice(1)}});
  });
  await expect(page.getByText("Player no longer in the roster",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Back to players",exact:true}).click();
  await expect(page.locator("#roster-heading")).toBeFocused();
  results.push({id:"Q08",passed:true,assertion:"Back restores the stable roster heading after exact selected UUID vanishes"});

  await go("Backups");
  await expect(page.locator(".job-book")).toContainText("DEGRADED");
  await page.evaluate(async () => {
    const {session} = await import("/src/adapter/session.ts");
    const original = session.query;
    session.query = function(action, parameters, kind) {
      return action === "maintenance.status" ? Promise.resolve({status:"SUCCESS",data:{currentOperation:{jobId:"current-job-B",phase:"UPLOADING_REMOTE",backupId:"archive-B",localBackupVerified:true,remoteBackupVerified:false}}}) : original.call(this,action,parameters,kind);
    };
  });
  await page.getByRole("button",{name:"Refresh evidence",exact:true}).click();
  await expect(page.locator(".job-book")).toContainText("current-job-B");
  await page.evaluate(async () => {
    const {session} = await import("/src/adapter/session.ts");
    const s = session.getSnapshot().state;
    session.receiveFixture({type:"server.event",serverId:s.serverId,agentKind:"HOST",agentSession:"fixture-host",eventType:"backup.progress",body:{jobId:"old-job-A",phase:"VERIFYING_REMOTE",progress:1,bytesUploaded:999,totalBytes:999,remoteBackupVerified:true,capturedAt:new Date().toISOString()}});
  });
  await expect(page.locator(".backup-progress")).toHaveClass(/indeterminate/);
  await expect(page.locator(".job-book")).toContainText("UPLOADING_REMOTE");
  await expect(page.locator(".operation-register")).toContainText("Not verified");
  results.push({id:"Q17",passed:true,assertion:"Mismatched prior-job progress cannot change current phase, ratio or durable verification"});
  expect(errors).toEqual([]);
} catch(error) {
  results.push({passed:false,error:error.message});
  await mkdir("artifacts/nextgen",{recursive:true});
  await page.screenshot({path:"artifacts/nextgen/isolation-failure.png",fullPage:true});
  process.exitCode = 1;
}
await mkdir("artifacts/nextgen",{recursive:true});
await writeFile("artifacts/nextgen/isolation.json",JSON.stringify({results,errors},null,2));
await browser.close();
console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,failures:results.filter(r=>!r.passed)},null,2));
