import { firefox, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4173",
  browser = await firefox.launch(),
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
await context.route("**/*", (r) =>
  new URL(r.request().url()).origin === base
    ? r.continue()
    : r.abort("blockedbyclient"),
);
await context.addInitScript(() =>
  localStorage.setItem(
    "plexon:preferences",
    JSON.stringify({ theme: "light", motion: "off", skinProvider: "disabled" }),
  ),
);
const page = await context.newPage(),
  results = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("artifacts/reconstruction/interactions", { recursive: true });
async function go(name) {
  await page.goto(`${base}/?fixture=healthy#${name}`);
  await page.locator(".workspace-heading h1").waitFor();
  await page.locator(".route-skeleton").waitFor({ state: "detached" });
}
async function record(name, fn) {
  await fn();
  results.push({ name, passed: true });
}
try {
  await record(
    "sidebar, console-led overview and real resource modules replace Operations Desk",
    async () => {
      await go("Overview");
      await expect(page.locator(".sidebar")).toBeVisible();
      await expect(
        page
          .getByRole("navigation", { name: "Primary navigation" })
          .getByRole("button"),
      ).toHaveCount(8);
      await expect(page.locator(".overview-console")).toBeVisible();
      await expect(page.locator(".usage-panel")).toBeVisible();
      await expect(page.locator(".stat-cell")).toHaveCount(4);
      await expect(
        page.locator(".signal-landscape,.runtime-register,.workspace-bar"),
      ).toHaveCount(0);
      const usageTop = await page
        .locator(".usage-panel")
        .evaluate((el) => el.getBoundingClientRect().top);
      expect(usageTop).toBeLessThan(900);
    },
  );
  await record(
    "signal catalog exposes all eight instruments and a synchronized comparison",
    async () => {
      await go("Performance");
      await expect(page.locator(".signal-catalog button")).toHaveCount(8);
      await expect(page.locator(".time-series")).toHaveCount(1);
      await page
        .locator(".signal-catalog")
        .getByRole("button", { name: /Minecraft service CPU/ })
        .click();
      await expect(page.locator(".analysis-title")).toContainText(
        "Minecraft service CPU",
      );
      await expect(page.locator(".analysis-focus")).toContainText(
        "percent of one core",
      );
      await page
        .getByRole("button", { name: "Compare all signals", exact: true })
        .click();
      await expect(page.locator(".comparison-track")).toHaveCount(8);
      await page.locator(".time-series").first().focus();
      await page.keyboard.press("ArrowRight");
      expect(await page.locator(".chart-tooltip").count()).toBeGreaterThan(1);
      await page.keyboard.press("Enter");
      await page.screenshot({
        path: "artifacts/reconstruction/interactions/compare-desktop.png",
        fullPage: true,
      });
    },
  );
  await record(
    "full player profile and reviewed moderation restore focus without dispatch",
    async () => {
      await go("Players");
      const row = page.locator(".player-row").first();
      await row.click();
      await expect(
        page.getByRole("region", { name: "Selected player details" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Moderate", exact: true }).click();
      const ban = page.getByRole("button", { name: "Ban", exact: true });
      await ban.click();
      await expect(page.locator(".review-dialog")).toBeVisible();
      await expect(
        page
          .locator(".review-dialog")
          .getByRole("button", { name: "Dispatch operation" }),
      ).toBeDisabled();
      await page
        .locator(".review-dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await expect(ban).toBeFocused();
      await page
        .getByRole("button", { name: "Back to players", exact: true })
        .click();
      await expect(row).toBeFocused();
    },
  );
  await record(
    "access views retain device safeguards and effective scopes",
    async () => {
      await go("Access");
      await expect(
        page.getByLabel("Filter audit", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Paired devices/ }).click();
      await expect(page.locator(".device-row")).toHaveCount(2);
      await expect(
        page.getByRole("button", { name: "Review revoke" }).first(),
      ).toBeDisabled();
      await page.getByRole("button", { name: /Your authority/ }).click();
      await expect(
        page.getByRole("region", { name: "Effective device scopes" }),
      ).toBeVisible();
    },
  );
  await record(
    "settings section navigation reaches real connection and privacy fields",
    async () => {
      await go("Settings");
      await page.getByRole("link", { name: /Connections/ }).click();
      await expect(
        page.getByLabel("Relay HTTPS origin", { exact: true }).first(),
      ).toBeInViewport();
      await page.getByRole("link", { name: /Privacy & skins/ }).click();
      await expect(page.getByLabel("Skin provider")).toBeInViewport();
    },
  );
  for (const width of [390, 820, 1280])
    await record(
      `large text preference and player profile accessibility at ${width}px`,
      async () => {
        await page.setViewportSize({ width, height: 900 });
        await go("Players");
        await page.evaluate(async () => {
          const { preferences } = await import("/src/store/preferences.ts");
          preferences.update({ textSize: "large", skinProvider: "disabled" });
        });
        await page.locator(".player-row").first().click();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `artifacts/reconstruction/interactions/inspector-${width}.png`,
        });
        await page
          .getByRole("button", { name: "Back to players", exact: true })
          .click();
      },
    );
  for (const width of [390, 820])
    await record(`large text all-route layouts at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      for (const name of [
        "Fleet",
        "Overview",
        "Performance",
        "Players",
        "Console",
        "Backups",
        "Access",
        "Settings",
      ]) {
        await go(name);
        await page.evaluate(async () => {
          const { preferences } = await import("/src/store/preferences.ts");
          preferences.update({ textSize: "large", skinProvider: "disabled" });
        });
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
          `${name} overflow`,
        ).toBe(true);
      }
    });
  await record(
    "mobile workspace sheet has complete navigation and returns focus",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await go("Overview");
      const trigger = page.getByRole("button", { name: "Open navigation" });
      await trigger.click();
      await expect(
        page
          .getByRole("navigation", { name: "Navigation drawer" })
          .getByRole("button"),
      ).toHaveCount(8);
      await page
        .getByRole("dialog", { name: "Navigation" })
        .getByRole("button", { name: "Backups", exact: true })
        .click();
      await expect(page.locator(".workspace-heading h1")).toHaveText("Backups");
      await trigger.click();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    },
  );
  await record(
    "mobile signal picker reaches every source without a clipped catalog",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await go("Performance");
      await expect(page.getByLabel("Performance signal")).toBeVisible();
      await expect(page.locator(".mobile-signal-picker option")).toHaveCount(8);
      await page.getByLabel("Performance signal").selectOption("serviceMemory");
      await expect(page.locator(".analysis-title h2")).toHaveText(
        "Minecraft service memory",
      );
      await page.screenshot({
        path: "artifacts/reconstruction/interactions/mobile-performance.png",
        fullPage: true,
      });
    },
  );
  expect(errors).toEqual([]);
} catch (error) {
  results.push({ name: "Failure", passed: false, error: error.message });
  await page.screenshot({
    path: "artifacts/reconstruction/interactions/failure.png",
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await writeFile(
    "artifacts/reconstruction/interactions/results.json",
    JSON.stringify({ results, errors }, null, 2),
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
