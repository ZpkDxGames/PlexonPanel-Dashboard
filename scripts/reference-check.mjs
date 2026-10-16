import { firefox, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await firefox.launch(),
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  }),
  page = await context.newPage(),
  results = [];
await context.route("**/*", (r) =>
  new URL(r.request().url()).origin === "http://127.0.0.1:4173"
    ? r.continue()
    : r.abort(),
);
await context.addInitScript(() =>
  localStorage.setItem(
    "plexon:preferences",
    JSON.stringify({
      theme: "light",
      textSize: "large",
      skinProvider: "disabled",
      motion: "off",
    }),
  ),
);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let journey = 0;
async function go(route) {
  await page.goto(
    `http://127.0.0.1:4173/?fixture=healthy&journey=${++journey}#${route}`,
  );
  await page.locator(".workspace-heading h1").waitFor();
  await page.locator(".route-skeleton").waitFor({ state: "detached" });
}
async function check(name, fn) {
  await fn();
  results.push({ name, passed: true });
}
try {
  await check(
    "stored theme, text size, motion and skin privacy survive a fresh application load",
    async () => {
      await go("Players");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await expect(page.locator("html")).toHaveAttribute(
        "data-text-size",
        "large",
      );
      await expect(page.locator(".player-head img")).toHaveCount(0);
      await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    },
  );
  await check(
    "history uses exact UUID query and forwards opaque pagination unchanged",
    async () => {
      await page.locator(".player-row").first().click();
      await expect(page.locator(".history-entry")).toHaveCount(1);
      await page
        .getByRole("button", { name: "Older observations", exact: true })
        .click();
      await expect(page.locator(".history-entry")).toContainText(
        "UNKNOWN_DISCONNECT",
      );
      const calls = await page.evaluate(async () => {
        const { actionLog } = await import("/src/development/fixtures.ts");
        return actionLog.filter((c) => c.action === "players.history.list");
      });
      expect(calls[0].parameters.query).toBe(
        "19f50206-26de-410c-a1bc-000000000000",
      );
      expect(calls.at(-1).parameters.cursor).toBe("fixture-history-page-2");
      expect(calls.every((c) => c.parameters.limit === 25)).toBe(true);
    },
  );
  await check(
    "late history response is discarded when a different UUID is inspected",
    async () => {
      await go("Players");
      await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        const original = session.query;
        window.releaseHistory = undefined;
        session.query = function (a, p, k) {
          if (
            a === "players.history.list" &&
            p.query === "19f50206-26de-410c-a1bc-000000000000"
          )
            return new Promise((resolve) => {
              window.releaseHistory = () =>
                resolve({
                  status: "SUCCESS",
                  data: {
                    historyEnabled: true,
                    entries: [
                      {
                        uuid: p.query,
                        state: "JOINED",
                        eventId: "late",
                        observedAt: new Date().toISOString(),
                        name: "FORBIDDEN_OLD_PROFILE",
                      },
                    ],
                  },
                });
            });
          return original.call(this, a, p, k);
        };
      });
      await page.locator(".player-row").first().click();
      await page.waitForFunction(
        () => typeof window.releaseHistory === "function",
      );
      await page
        .getByRole("button", { name: "Back to players", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Inspect LumaCraft", exact: true })
        .click();
      await page.evaluate(() => window.releaseHistory());
      await expect(page.locator(".player-profile h2")).toHaveText("LumaCraft");
      await expect(page.locator(".player-profile-page")).not.toContainText(
        "FORBIDDEN_OLD_PROFILE",
      );
      await expect(page.locator(".history-entry")).toHaveCount(1);
    },
  );
  await check(
    "removing the inspected UUID never silently changes moderation target",
    async () => {
      await go("Players");
      await page.locator(".player-row").first().click();
      await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        const s = session.getSnapshot().state;
        session.receiveFixture({
          type: "server.event",
          serverId: s.serverId,
          agentKind: "PAPER",
          agentSession: "fixture-paper",
          eventType: "inventory.players",
          body: {
            snapshotId: "new-roster",
            offset: 0,
            complete: true,
            capturedAt: new Date().toISOString(),
            players: s.players.slice(1),
          },
        });
      });
      await expect(
        page.getByText("Player no longer in the roster", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Review game mode", exact: true }),
      ).toHaveCount(0);
    },
  );
  await check(
    "plugin inventory search retains only actual matching entries",
    async () => {
      await go("Console");
      await page
        .getByRole("tab", { name: "Plugin inventory", exact: true })
        .click();
      await page.getByLabel("Search plugins").fill("LuckPerms");
      await expect(page.locator(".plugin-row")).toHaveCount(1);
      await expect(page.locator(".plugin-row")).toContainText("LuckPerms");
      await page.getByLabel("Search plugins").fill("not-installed");
      await expect(
        page.getByText("No matching plugins", { exact: true }),
      ).toBeVisible();
    },
  );
  await check(
    "stale resource capacity never draws a current meter",
    async () => {
      await page.goto("http://127.0.0.1:4173/?fixture=stale#Overview");
      await page.locator(".resource-summary").waitFor();
      await expect(page.locator('meter[aria-label="JVM heap"]')).toHaveCount(0);
    },
  );
  await check(
    "settings section deep link and browser reload preserve the active module",
    async () => {
      await go("Settings?section=connection");
      await expect(page.locator("#settings-connection")).toBeVisible();
      await expect(page.locator("#settings-appearance")).toBeHidden();
      await page.reload();
      await page.locator(".workspace-heading h1").waitFor();
      await expect(page.locator("#settings-connection")).toBeVisible();
    },
  );
  expect(errors).toEqual([]);
} catch (e) {
  results.push({ name: "Failure", passed: false, error: e.message });
  await mkdir("artifacts/acceptance", { recursive: true });
  await page.screenshot({
    path: "artifacts/acceptance/reference-failure.png",
    fullPage: true,
  });
  process.exitCode = 1;
}
await mkdir("artifacts/acceptance", { recursive: true });
await writeFile(
  "artifacts/acceptance/reference-results.json",
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
console.log(
  JSON.stringify(
    {
      passed: results.filter((r) => r.passed).length,
      failures: results.filter((r) => !r.passed),
    },
    null,
    2,
  ),
);
