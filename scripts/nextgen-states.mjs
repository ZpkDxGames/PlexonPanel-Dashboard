import { firefox, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4173",
  browser = await firefox.launch(),
  results = [],
  errors = [];
await mkdir("artifacts/nextgen/states", { recursive: true });
for (const theme of ["dark", "light"])
  for (const width of [1440, 390]) {
    const c = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      reducedMotion: "reduce",
    });
    await c.route("**/*", (r) =>
      new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
    );
    await c.addInitScript(
      (p) => localStorage.setItem("plexon:preferences", JSON.stringify(p)),
      { theme, motion: "off", skinProvider: "disabled" },
    );
    let p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    async function capture(name) {
      await p.evaluate(() => document.fonts.ready);
      const violations = (
        await new AxeBuilder({ page: p }).analyze()
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      }));
      const overflow = await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      await p.screenshot({
        path: `artifacts/nextgen/states/${name}-${width}-${theme}.png`,
        fullPage: true,
      });
      results.push({ name, width, theme, violations, overflow });
    }
    await p.goto(base);
    await p.getByRole("main", { name: "Initializing PlexonPanel" }).waitFor();
    await p.screenshot({
      path: `artifacts/nextgen/states/splash-${width}-${theme}.png`,
    });
    results.push({
      name: "splash",
      width,
      theme,
      violations: [],
      overflow: false,
      axe: "NOT_EXECUTED during timed splash; entry gate covered by unit/browser checks",
    });
    await p
      .getByRole("heading", { name: "Connect a server", exact: true })
      .waitFor();
    await p.evaluate(async () => {
      const { session } = await import("/src/adapter/session.ts");
      session.pair = async () => {
        throw Error("Synthetic rejected claim: invalid or expired code.");
      };
    });
    await p.getByLabel("Relay HTTPS origin").fill("https://relay.example");
    await p
      .getByLabel("Device name", { exact: true })
      .fill("Local fixture browser");
    await p
      .getByLabel("Pairing code", { exact: true })
      .fill("SYNTHETIC-NOT-A-CREDENTIAL");
    await p.getByRole("button", { name: "Pair server", exact: true }).click();
    await expect(p.locator(".notice.error")).toBeVisible();
    await capture("pairing-rejected");
    await p.evaluate(async () => {
      const { session } = await import("/src/adapter/session.ts");
      session.pair = async () => {};
    });
    await p.getByRole("button", { name: "Pair server", exact: true }).click();
    await expect(
      p.getByText("Pairing accepted. Establishing the signed server session."),
    ).toBeVisible();
    await capture("pairing-accepted-connecting");
    await p.close();
    p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`${base}/?fixture=healthy#Backups`);
    try {
      await p.locator(".job-book").waitFor();
      await expect(p.locator(".job-book .panel-header .status")).toHaveText(
        "DEGRADED",
      );
    } catch (e) {
      await p.screenshot({
        path: `artifacts/nextgen/states/fixture-failure-${width}-${theme}.png`,
      });
      await writeFile(
        "artifacts/nextgen/state-fixture-failure.json",
        JSON.stringify(
          { url: p.url(), body: await p.locator("body").innerText(), errors },
          null,
          2,
        ),
      );
      throw e;
    }
    await p.evaluate(async () => {
      const { session } = await import("/src/adapter/session.ts");
      window.originalStrataMethods = {
        query: session.query,
        execute: session.execute,
        valid: session.valid,
      };
    });
    for (const phase of [
      "QUEUED",
      "COUNTDOWN",
      "ARCHIVING",
      "UPLOADING_REMOTE",
      "VERIFYING_REMOTE",
      "COMPLETED",
      "DEGRADED",
      "FAILED",
      "RECOVERY_REQUIRED",
    ]) {
      await p.evaluate(async (phase) => {
        const { session } = await import("/src/adapter/session.ts");
        const { makeFixture, fixtureAction } = await import(
          "/src/development/fixtures.ts"
        );
        Object.assign(session, window.originalStrataMethods);
        const state = makeFixture("healthy");
        state.backupProgress = {
          jobId: "different-old-job",
          progress: 1,
          phase: "UPLOADING_REMOTE",
        };
        const finished = [
          "COMPLETED",
          "DEGRADED",
          "FAILED",
          "RECOVERY_REQUIRED",
        ].includes(phase);
        session.installFixture("phase-proof", state, async (a, params) => {
          if (a === "maintenance.status")
            return {
              status: "SUCCESS",
              data: {
                currentOperation: {
                  jobId: "exact-current-job",
                  backupId: "synthetic-archive",
                  phase,
                  ...(["COMPLETED", "DEGRADED", "RECOVERY_REQUIRED"].includes(
                    phase,
                  )
                    ? { localBackupVerified: true }
                    : {}),
                  ...(phase === "COMPLETED"
                    ? { remoteBackupVerified: true }
                    : phase === "DEGRADED"
                      ? {
                          remoteBackupVerified: false,
                          retryable: true,
                          message: "Synthetic remote verification failed",
                          errorCode: "REMOTE_VERIFY_FAILED",
                        }
                      : {}),
                  ...(phase === "RECOVERY_REQUIRED"
                    ? {
                        restartRecoveryRequired: true,
                        message: "Follow the Host operator recovery procedure",
                      }
                    : {}),
                },
              },
            };
          const result = await fixtureAction(a, params);
          if (a === "backup.preflight")
            result.data = {
              ...result.data,
              operationBusy: !finished,
              recoveryRequired: phase === "RECOVERY_REQUIRED",
              provider: "RCLONE",
              providerStatus: "CONNECTED",
              sourceBytes: 3e9,
              entryCount: 4210,
              requiredBytes: 5e9,
            };
          return result;
        });
        location.hash = "Backups";
      }, phase);
      await expect(p.locator(".job-book .panel-header .status")).toHaveText(
        phase,
      );
      await capture(`backup-${phase.toLowerCase()}`);
      if (
        !["COMPLETED", "DEGRADED", "FAILED", "RECOVERY_REQUIRED"].includes(
          phase,
        )
      )
        await expect(p.getByRole("progressbar")).not.toHaveAttribute(
          "aria-valuenow",
        );
      if (phase === "RECOVERY_REQUIRED")
        await expect(
          p.getByRole("button", { name: "Review new backup", exact: true }),
        ).toBeDisabled();
    }
    await p.evaluate(async () => {
      const { session } = await import("/src/adapter/session.ts");
      const { makeFixture, fixtureAction } = await import(
        "/src/development/fixtures.ts"
      );
      Object.assign(session, window.originalStrataMethods);
      session.installFixture("fleet-proof", makeFixture(), fixtureAction);
      const snap = session.getSnapshot();
      snap.fleet = Array.from({ length: 15 }, (_, i) => {
        const state = makeFixture();
        state.serverId = `passive-fixture-${i}`;
        state.ready.server.serverName = `Passive Minecraft instance ${i + 1}`;
        return { serverId: state.serverId, state, phase: "live" };
      });
      session.receiveFixture({
        type: "server.event",
        serverId: snap.state.serverId,
        agentKind: "PAPER",
        agentSession: "fixture-paper",
        eventType: "console.lines",
        body: { lines: [] },
      });
      location.hash = "Fleet";
    });
    await expect(p.locator(".server-directory-row")).toHaveCount(16);
    await expect(p.locator(".node-row")).toHaveCount(1);
    await capture("fleet-sixteen-shared-node");
    for (const name of [
      "review-invalidated",
      "review-queued",
      "review-unknown",
    ]) {
      await p.evaluate(async (name) => {
        const { session } = await import("/src/adapter/session.ts");
        const { makeFixture, fixtureAction } = await import(
          "/src/development/fixtures.ts"
        );
        Object.assign(session, window.originalStrataMethods);
        session.installFixture("review-proof", makeFixture(), fixtureAction);
        if (name === "review-invalidated") session.valid = () => false;
        if (name === "review-queued") {
          session.getSnapshot().operation = {
            action: "server.restart",
            phase: "acknowledged",
            message: "Relay accepted transport; agent result not received.",
          };
          session.execute = () => new Promise(() => {});
        }
        if (name === "review-unknown")
          session.execute = async () => {
            throw Error(
              "Synthetic disconnect after dispatch. Outcome unknown.",
            );
          };
        location.hash = "Overview";
      }, name);
      await p.getByRole("button", { name: "Restart", exact: true }).click();
      if (name !== "review-invalidated")
        await p
          .getByRole("button", { name: "Dispatch operation", exact: true })
          .click();
      await capture(name);
    }
    await c.close();
  }
await browser.close();
await writeFile(
  "artifacts/nextgen/states.json",
  JSON.stringify(
    {
      results,
      errors,
      scope:
        "Local synthetic handlers; all nonlocal network blocked. No live pairing, backup, lifecycle or revoke action.",
    },
    null,
    2,
  ),
);
const failures = results.filter((x) => x.overflow || x.violations.length);
console.log(
  JSON.stringify({ cases: results.length, failures, errors }, null, 2),
);
if (failures.length || errors.length) process.exitCode = 1;
