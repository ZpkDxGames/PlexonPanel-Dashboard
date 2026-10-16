import { firefox, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.argv[2] ?? "http://127.0.0.1:4173";
const browser = await firefox.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
await context.route("**/*", (route) =>
  new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue()
    : route.abort("blockedbyclient"),
);
const page = await context.newPage(),
  errors = [],
  results = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
await context.addInitScript(() =>
  localStorage.setItem(
    "plexon:preferences",
    JSON.stringify({ theme: "dark", motion: "off", skinProvider: "disabled" }),
  ),
);
await mkdir("artifacts/acceptance", { recursive: true });
async function go(route, fixture = "healthy") {
  await page.goto(`${base}/?fixture=${fixture}#${route}`, {
    waitUntil: "networkidle",
  });
  await page.locator(".workspace-heading h1").waitFor();
  await page.locator(".route-skeleton").waitFor({ state: "detached" });
}
async function record(name, fn) {
  await fn();
  results.push({ name, passed: true });
}
try {
  await record(
    "chart keyboard inspection, pin, table and series toggle",
    async () => {
      await go("Overview");
      const chart = page.locator(".time-series").first();
      await chart.focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.locator(".chart-tooltip").first()).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page.locator(".chart-tooltip").first()).toContainText(
        "pinned",
      );
      await page.keyboard.press("Escape");
      await expect(page.locator(".chart-tooltip")).toHaveCount(0);
      await page
        .getByRole("button", { name: "View data", exact: true })
        .first()
        .click();
      await expect(
        page
          .getByRole("region", { name: "Paper tick rate sample table" })
          .locator("tbody tr"),
      ).toHaveCount(50);
      await page
        .getByRole("button", { name: "Show Tick rate", exact: true })
        .click();
      await expect(
        page.getByText("All signals hidden", { exact: true }),
      ).toBeVisible();
    },
  );
  await record(
    "player search, sort, editable parameters and reviewed UUID target",
    async () => {
      await go("Players");
      await page
        .getByLabel("Search players", { exact: true })
        .fill("LumaCraft");
      await expect(page.locator(".player-row")).toHaveCount(4);
      await page.locator(".player-row").first().click();
      await page
        .getByLabel("Private message", { exact: true })
        .fill("A reviewed test message");
      await page
        .getByRole("button", { name: "Review message", exact: true })
        .click();
      const dialog = page.locator("dialog.review-dialog");
      await expect(dialog).toContainText("player.message");
      await expect(dialog).toContainText("A reviewed test message");
      await expect(dialog).toContainText("playerId");
      await page.keyboard.press("Escape");
      await page
        .getByRole("combobox", { name: /Game mode/ })
        .selectOption("CREATIVE");
      await page
        .getByRole("button", { name: "Review game mode", exact: true })
        .click();
      await expect(page.locator("dialog.review-dialog")).toContainText(
        "CREATIVE",
      );
      await page.keyboard.press("Escape");
    },
  );
  await record(
    "high risk action requires typed confirmation; server context change discards review",
    async () => {
      await page.getByRole("button", { name: "Moderate", exact: true }).click();
      await page.getByRole("button", { name: "Ban", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Dispatch operation" }),
      ).toBeDisabled();
      await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        const { makeFixture, fixtureAction } =
          await import("/src/development/fixtures.ts");
        const next = makeFixture();
        next.serverId = "3c37e785-5102-46b4-bf08-294781babd87";
        next.ready.serverId = next.serverId;
        session.installFixture("switched-server", next, fixtureAction);
      });
      await expect(page.locator("dialog.review-dialog")).toHaveCount(0);
      const mutations = await page.evaluate(async () => {
        const { actionLog } = await import("/src/development/fixtures.ts");
        return actionLog.filter((e) => e.action.startsWith("player."));
      });
      expect(mutations).toHaveLength(0);
    },
  );
  await record(
    "Host journal and Paper command authority remain separate",
    async () => {
      await go("Console");
      await page.getByLabel("Server command", { exact: true }).fill("list");
      await page.getByRole("button", { name: "Review", exact: true }).click();
      const dialog = page.locator("dialog.review-dialog");
      await expect(dialog).toContainText("PAPER");
      await expect(dialog).toContainText("console.execute");
      await dialog.getByRole("button", { name: "Dispatch operation" }).click();
      await expect(dialog).toContainText("Agent result received");
      await expect(dialog.getByLabel("Agent response")).toContainText(
        "fixture",
      );
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Resume", exact: true }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Live chat", exact: true }).click();
      await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
      await page
        .getByRole("tab", { name: "Plugin inventory", exact: true })
        .click();
      await expect(page.locator(".plugin-row")).toHaveCount(3);
    },
  );
  await record(
    "unknown backup preflight fails closed; no fake completed job",
    async () => {
      await go("Backups");
      await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        const { makeFixture, fixtureAction } =
          await import("/src/development/fixtures.ts");
        session.installFixture(
          "unknown-preflight",
          makeFixture(),
          async (a, p) =>
            a === "backup.preflight"
              ? {
                  status: "SUCCESS",
                  code: "OK",
                  data: { hostAuthenticated: true },
                }
              : fixtureAction(a, p),
        );
      });
      await expect(
        page.getByRole("button", { name: "Review new backup", exact: true }),
      ).toBeDisabled();
      await expect(page.locator(".gate-list")).toContainText("Unknown");
      await expect(page.getByText("DEGRADED", { exact: true })).toBeVisible();
    },
  );
  await record(
    "read-only grant hides roster and plugin data and cannot create backups",
    async () => {
      await go("Players", "denied");
      await expect(page.locator(".player-row")).toHaveCount(0);
      await expect(
        page.getByText("Roster access restricted", { exact: true }),
      ).toBeVisible();
      await go("Backups", "denied");
      await expect(
        page.getByRole("button", { name: "Review new backup", exact: true }),
      ).toBeDisabled();
      await go("Console", "denied");
      await page
        .getByRole("tab", { name: "Plugin inventory", exact: true })
        .click();
      await expect(page.locator(".plugin-row")).toHaveCount(0);
    },
  );
  await record(
    "current device revoke disabled; reviewed revoke is bound to Paper",
    async () => {
      await go("Access");
      await page.getByRole("button", { name: /Paired devices/ }).click();
      await expect(
        page.getByRole("button", { name: "Review revoke" }).first(),
      ).toBeDisabled();
      await page.getByRole("button", { name: "Review revoke" }).last().click();
      await expect(page.locator("dialog.review-dialog")).toContainText("PAPER");
      await expect(page.locator("dialog.review-dialog")).toContainText(
        "fixture-observer",
      );
      await page.keyboard.press("Escape");
    },
  );
  await record(
    "settings preference persistence and modular connections",
    async () => {
      await go("Settings");
      await page.getByRole("button", { name: "Light Light workspace" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await page.getByRole("link", { name: /Connections/ }).click();
      await expect(
        page.getByLabel("Relay HTTPS origin", { exact: true }).first(),
      ).toBeVisible();
      await page.getByRole("link", { name: /Privacy & skins/ }).click();
      await expect(
        page.getByRole("combobox", { name: /Skin provider/ }),
      ).toBeVisible();
    },
  );
  for (const width of [360, 390, 768, 820, 1024, 1280, 1440, 1920]) {
    await record(`responsive ${width}px, all routes`, async () => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "Fleet",
        "Overview",
        "Performance",
        "Players",
        "Console",
        "Backups",
        "Access",
        "Settings",
      ]) {
        await go(route);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
      }
    });
  }
  for (const fixture of [
    "stale",
    "skew",
    "partial",
    "stopped",
    "offline",
    "denied",
  ]) {
    await record(`${fixture} source state`, async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await go("Overview", fixture);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations).toEqual([]);
      await page.screenshot({
        path: `artifacts/acceptance/${fixture}-mobile.png`,
        fullPage: true,
      });
    });
  }
  await record(
    "first visit resolves splash to pairing, rejects invalid claim and never opens shell",
    async () => {
      const fresh = await browser.newContext({
          viewport: { width: 390, height: 844 },
        }),
        p = await fresh.newPage();
      await fresh.route("**/*", (route) =>
        new URL(route.request().url()).origin === new URL(base).origin
          ? route.continue()
          : route.abort("blockedbyclient"),
      );
      await p.goto(base);
      await expect(
        p.getByRole("main", { name: "Initializing PlexonPanel" }),
      ).toBeVisible();
      await expect(
        p.getByRole("heading", { name: "Connect a server" }),
      ).toBeVisible({ timeout: 15000 });
      await expect(p.locator(".workspace")).toHaveCount(0);
      await p.route("https://relay.example/v1/pairings/claim", (route) =>
        route.fulfill({
          status: 401,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ error: "Invalid or expired pairing code." }),
        }),
      );
      await p.getByLabel("Relay HTTPS origin").fill("https://relay.example");
      await p.getByLabel("Device name").fill("QA browser");
      await p.getByLabel("Pairing code").fill("INVALID-CODE");
      await p.getByRole("button", { name: /Pair/ }).click();
      await expect(p.locator(".notice.error")).toBeVisible();
      await expect(p.locator(".workspace")).toHaveCount(0);
      await p.screenshot({
        path: "artifacts/acceptance/pairing-mobile.png",
        fullPage: true,
      });
      const axe = await new AxeBuilder({ page: p }).analyze();
      expect(axe.violations).toEqual([]);
      await fresh.close();
    },
  );
  await record(
    "Host generation change does not connect old source history",
    async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await go("Performance");
      await page
        .getByRole("button", { name: "Compare all signals", exact: true })
        .click();
      await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        const ready = structuredClone(session.getSnapshot().state.ready);
        ready.server.hostSession = "next-host-generation";
        session.receiveFixture({ ...ready, type: "dashboard.ready" });
      });
      await page
        .locator(".signal-catalog")
        .getByRole("button", { name: /Minecraft service CPU/ })
        .click();
      await expect(
        page
          .locator(".analysis-focus")
          .getByText("No observed signal", { exact: true }),
      ).toBeVisible();
      await expect(page.locator(".analysis-summary")).toContainText("0");
      await page
        .locator(".signal-catalog")
        .getByRole("button", { name: /^Tick rate/ })
        .click();
      await expect(page.locator(".analysis-focus .chart-empty")).toHaveCount(0);
      const retained = await page.evaluate(async () => {
        const { session } = await import("/src/adapter/session.ts");
        return session.getSnapshot().state.history.length;
      });
      expect(retained).toBe(300);
    },
  );
  await record("touch pins an actual chart observation", async () => {
    const touchContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    await touchContext.route("**/*", (route) =>
      new URL(route.request().url()).origin === new URL(base).origin
        ? route.continue()
        : route.abort("blockedbyclient"),
    );
    await touchContext.addInitScript(() =>
      localStorage.setItem(
        "plexon:preferences",
        JSON.stringify({ motion: "off", skinProvider: "disabled" }),
      ),
    );
    const touchPage = await touchContext.newPage();
    await touchPage.goto(`${base}/?fixture=healthy#Overview`);
    await touchPage.locator(".workspace-heading h1").waitFor();
    await touchPage
      .locator(".time-series")
      .first()
      .tap({ position: { x: 150, y: 70 } });
    await expect(touchPage.locator(".chart-tooltip").first()).toContainText(
      "pinned",
    );
    await touchContext.close();
  });
  expect(errors).toEqual([]);
} catch (error) {
  results.push({ name: "Failure", passed: false, error: error.message });
  await page.screenshot({
    path: "artifacts/acceptance/failure.png",
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await writeFile(
    "artifacts/acceptance/results.json",
    JSON.stringify({ results, consoleErrors: errors }, null, 2),
  );
  await browser.close();
}
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
