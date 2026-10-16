import { firefox, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4173",
  browser = await firefox.launch(),
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
await context.route("**/*", (r) =>
  new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
);
await context.addInitScript(() =>
  localStorage.setItem(
    "plexon:preferences",
    JSON.stringify({ motion: "off", skinProvider: "disabled" }),
  ),
);
const page = await context.newPage(),
  results = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let journey = 0;
async function go(route) {
  await page.goto(`${base}/?fixture=healthy&journey=${++journey}#${route}`);
  await page.locator(".workspace-heading h1").waitFor();
  await page.locator(".route-skeleton").waitFor({ state: "detached" });
}
const only = process.argv
  .find((a) => a.startsWith("--only="))
  ?.slice(7)
  .split(",");
async function check(name, fn) {
  if (only && !only.some((prefix) => name.startsWith(prefix))) return;
  try {
    await fn();
    results.push({ name, passed: true });
  } catch (e) {
    results.push({ name, passed: false, error: e.message });
    await page.screenshot({
      path: `artifacts/nextgen/failure-${results.length}.png`,
      fullPage: true,
    });
    throw e;
  }
}
await mkdir("artifacts/nextgen", { recursive: true });
try {
  await check("Q05: queued Host acceptance is never completion", async () => {
    await go("Backups");
    await page.evaluate(async () => {
      const { session } = await import("/src/adapter/session.ts");
      const original = session.execute;
      session.execute = function (p, c) {
        return p.action === "maintenance.full-backup.create"
          ? Promise.resolve({
              status: "SUCCESS",
              code: "OK",
              message: "accepted",
              data: { state: "QUEUED", jobId: "local-queued-job" },
            })
          : original.call(this, p, c);
      };
    });
    await page
      .getByRole("button", { name: "Review new backup", exact: true })
      .click();
    await expect(page.locator(".review-target")).toContainText("b820ad3e");
    await page
      .getByRole("button", { name: "Dispatch operation", exact: true })
      .click();
    await expect(page.locator(".review-dialog")).toContainText(
      "Host accepted job · not completed",
    );
    await expect(page.locator(".review-dialog")).not.toContainText(
      "Backup complete",
    );
  });
  await check(
    "Q06: unknown outcome retains context, cannot redispatch, offers read-only audit",
    async () => {
      await go("Overview");
      await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        window.dispatches = 0;
        session.execute = async () => {
          window.dispatches++;
          throw Error("Timeout. Outcome unknown.");
        };
      });
      await page.getByRole("button", { name: "Restart", exact: true }).click();
      await page
        .getByRole("button", { name: "Dispatch operation", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Dispatch operation", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Inspect agent audit" }),
      ).toBeVisible();
      expect(await page.evaluate(() => window.dispatches)).toBe(1);
    },
  );
  await check("Q01: a changed prepared target cannot dispatch", async () => {
    await go("Overview");
    await page.getByRole("button", { name: "Restart", exact: true }).click();
    await page.evaluate(async () => {
      const { session } = await import("/src/adapter/session.ts");
      const { makeFixture, fixtureAction } = await import(
        "/src/development/fixtures.ts"
      );
      const state = makeFixture();
      state.serverId = "different-target";
      session.installFixture("changed", state, fixtureAction);
    });
    await expect(page.locator(".review-dialog")).toHaveCount(0);
  });
  await check(
    "Q21: preflight failure preserves successful durable status and inventory",
    async () => {
      await go("Backups");
      await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        const original = session.query;
        session.query = function (a, p, k) {
          return a === "backup.preflight"
            ? Promise.reject(Error("RCLONE_UNAVAILABLE: provider failed"))
            : original.call(this, a, p, k);
        };
      });
      await page
        .getByRole("button", { name: "Refresh evidence", exact: true })
        .click();
      await expect(page.locator(".read-error")).toContainText(
        "RCLONE_UNAVAILABLE",
      );
      await expect(
        page.getByRole("button", { name: "Review new backup", exact: true }),
      ).toBeDisabled();
      await expect(page.locator(".job-book")).toContainText("DEGRADED");
      await expect(page.locator(".backup-table tbody tr")).toHaveCount(2);
      await expect(page.locator(".gate-list")).not.toContainText("Ready");
    },
  );
  await check(
    "Q21: inventory failure stays distinct from empty and from durable job failure",
    async () => {
      await go("Backups");
      await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        const original = session.query;
        session.query = function (a, p, k) {
          return a === "backup.full.list"
            ? Promise.reject(Error("Inventory read denied"))
            : original.call(this, a, p, k);
        };
      });
      await page
        .getByRole("button", { name: "Refresh evidence", exact: true })
        .click();
      await expect(page.locator(".archive-book")).toContainText(
        "Inventory read denied",
      );
      await expect(page.locator(".backup-table tbody tr")).toHaveCount(2);
      await expect(page.locator(".job-book")).toContainText("DEGRADED");
    },
  );
  await check(
    "Q16: expiry disables creation without pretending historical checks are current",
    async () => {
      await go("Backups");
      await expect(
        page.getByRole("button", { name: "Review new backup", exact: true }),
      ).toBeEnabled();
      await page.clock.install();
      await page.clock.fastForward(31000);
      await expect(
        page.getByRole("button", { name: "Review new backup", exact: true }),
      ).toBeDisabled();
      await expect(page.locator(".gate-list")).not.toContainText("Ready");
      await page.clock.resume();
    },
  );
  await check(
    "Q18/Q20: recovery status and 100% transfer never invent remote verification",
    async () => {
      await go("Backups");
      await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        const original = session.query;
        session.query = function (a, p, k) {
          if (a === "maintenance.status")
            return Promise.resolve({
              status: "SUCCESS",
              data: {
                currentOperation: {
                  jobId: "recovery",
                  phase: "RECOVERY_REQUIRED",
                  localBackupVerified: true,
                  progressPercent: 100,
                  message: "Manual recovery procedure required",
                },
              },
            });
          if (a === "backup.preflight")
            return Promise.resolve({
              status: "SUCCESS",
              data: {
                hostAuthenticated: true,
                operationBusy: false,
                recoveryRequired: true,
                backupRootWritable: true,
                commandChannelConfigured: true,
              },
            });
          return original.call(this, a, p, k);
        };
      });
      await page
        .getByRole("button", { name: "Refresh evidence", exact: true })
        .click();
      await expect(page.locator(".job-book")).toContainText(
        "RECOVERY_REQUIRED",
      );
      await expect(
        page
          .locator(".operation-register")
          .getByText("Unknown", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Review new backup", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: /restore|clear recovery/i }),
      ).toHaveCount(0);
    },
  );
  await check(
    "Q24: Owner missing scope or capability receives no bypass in authority ledger",
    async () => {
      await go("Access");
      await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        const { makeFixture, fixtureAction } = await import(
          "/src/development/fixtures.ts"
        );
        const s = makeFixture();
        s.ready.device.scopes = s.ready.device.scopes.filter(
          (x) => x !== "player.op",
        );
        delete s.ready.server.hostCapabilities["server.restart"];
        session.installFixture("missing-grant", s, fixtureAction);
      });
      await page.getByRole("button", { name: /Your authority/ }).click();
      await page.getByLabel("Search authority").fill("player.op");
      await expect(page.locator(".authority-ledger")).toContainText(
        "Not granted",
      );
      await expect(page.locator(".authority-ledger")).toContainText(
        "does not permit",
      );
      await page.getByLabel("Search authority").fill("server.restart");
      await expect(page.locator(".authority-ledger")).toContainText(
        "Not reported",
      );
      await expect(page.locator(".authority-ledger")).toContainText(
        "does not permit",
      );
    },
  );
  await check(
    "Q12/Q11: terminal geometry follows large text/viewport; bounded wrap and explicit tail return",
    async () => {
      await go("Console");
      await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        const { makeFixture, fixtureAction } = await import(
          "/src/development/fixtures.ts"
        );
        const { preferences } = await import("/src/store/preferences.ts");
        const s = makeFixture();
        s.console = Array.from({ length: 2500 }, (_, i) => ({
          id: `row-${i}`,
          capturedAt: new Date().toISOString(),
          level: "INFO",
          source: "HOST",
          content: `Synthetic retained line ${i}`,
        }));
        session.installFixture("terminal-measure", s, fixtureAction);
        preferences.update({ textSize: "large" });
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator(".terminal-line").last().waitFor();
      const geometry = await page
        .locator(".terminal-scroll")
        .evaluate((el) => ({
          height: el.clientHeight,
          row: el.querySelector(".terminal-ruler").getBoundingClientRect()
            .height,
          count: el.querySelectorAll(".terminal-line").length,
        }));
      expect(geometry.row).toBe(31.5);
      expect(geometry.count).toBeLessThanOrEqual(
        Math.ceil(geometry.height / geometry.row) + 16,
      );
      await expect
        .poll(() =>
          page
            .locator(".terminal-scroll")
            .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
        )
        .toBeLessThanOrEqual(geometry.row * 2);
      await page.locator(".terminal-scroll").evaluate((el) => {
        el.scrollTop = 0;
        el.dispatchEvent(new Event("scroll"));
      });
      await expect(page.locator(".terminal-status")).toContainText(
        "Inspecting retained output",
      );
      await page
        .getByRole("button", { name: "Return to live", exact: true })
        .click();
      await expect(page.locator(".terminal-status")).toContainText("Live tail");
      await page.locator(".console-filters summary").click();
      await page.getByRole("button", { name: "Wrap", exact: true }).click();
      expect(await page.locator(".terminal-line").count()).toBeLessThanOrEqual(
        400,
      );
      await page.setViewportSize({ width: 1440, height: 900 });
    },
  );
  await check(
    "Q26: blocked optional storage applies preferences without a false saved claim",
    async () => {
      await go("Settings");
      await page.evaluate(() => {
        Storage.prototype.setItem = function () {
          throw new DOMException("blocked", "SecurityError");
        };
      });
      await page.getByRole("button", { name: /^Light/ }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await expect(page.locator(".save-feedback")).toHaveText(
        "Applied in this browser",
      );
    },
  );
  await check(
    "Q09: provider failure resets with provider change; disabled prevents image requests",
    async () => {
      await go("Players");
      await page.route("https://crafatar.com/**", (r) =>
        r.fulfill({ status: 404, body: "" }),
      );
      let requested = 0;
      await page.route("https://mc-heads.net/**", (r) => {
        requested++;
        return r.fulfill({
          status: 200,
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=",
            "base64",
          ),
        });
      });
      await page.evaluate(async () => {
        const { preferences } = await import("/src/store/preferences.ts");
        preferences.update({ skinProvider: "crafatar" });
      });
      await expect(
        page.locator(".player-row").first().locator(".player-head img"),
      ).toHaveCount(0);
      await page.evaluate(async () => {
        const { preferences } = await import("/src/store/preferences.ts");
        preferences.update({ skinProvider: "mc-heads" });
      });
      await expect.poll(() => requested).toBeGreaterThan(0);
      await expect(page.locator(".player-head img").first()).toHaveAttribute(
        "src",
        /mc-heads/,
      );
      await page.evaluate(async () => {
        const { preferences } = await import("/src/store/preferences.ts");
        preferences.update({ skinProvider: "disabled" });
      });
      await expect(page.locator(".player-head img")).toHaveCount(0);
    },
  );
  expect(errors).toEqual([]);
} catch (e) {
  process.exitCode = 1;
  console.error(e.message);
} finally {
  await writeFile(
    "artifacts/nextgen/regressions.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify(
    {
      passed: results.filter((x) => x.passed).length,
      failures: results.filter((x) => !x.passed),
    },
    null,
    2,
  ),
);
