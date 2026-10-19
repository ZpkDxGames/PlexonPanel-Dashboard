import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const out = process.env.EVIDENCE_DIR ?? "artifacts/v5";
await fs.mkdir(`${out}/after`, { recursive: true });
await fs.mkdir(`${out}/states`, { recursive: true });
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "-H",
    "127.0.0.1",
    "-p",
    "4176",
  ],
  { stdio: "ignore" },
);
let browser;
const receipts = [];
const interactions = [];
const configs = [
  { name: "mobile-dark", width: 390, height: 844, theme: "dark" },
  { name: "desktop-light", width: 1440, height: 900, theme: "light" },
  { name: "laptop-dark", width: 1280, height: 800, theme: "dark" },
  { name: "desktop-dark", width: 1440, height: 900, theme: "dark" },
];
const routes = [
  "fleet",
  "overview",
  "performance",
  "players",
  "console",
  "backups",
  "access",
  "settings",
];
async function axe(page) {
  return (await new AxeBuilder({ page }).analyze()).violations
    .filter((v) => ["serious", "critical"].includes(v.impact))
    .map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    }));
}
try {
  for (let i = 0; i < 200; i++) {
    try {
      await fetch("http://127.0.0.1:4176");
      break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? chromium.executablePath(),
    args: ["--no-sandbox"],
  });
  for (const c of configs) {
    const context = await browser.newContext({
      viewport: { width: c.width, height: c.height },
    });
    await context.addInitScript(
      ({ theme }) =>
        localStorage.setItem(
          "plexon:preferences",
          JSON.stringify({ theme, skinProvider: "disabled" }),
        ),
      c,
    );
    context.setDefaultTimeout(30000);
    context.setDefaultNavigationTimeout(60000);
    const p = await context.newPage();
    await p.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    for (const route of routes) {
      await p.goto(`http://127.0.0.1:4176/${route}?fixture=healthy`);
      await p.waitForSelector("main h1", { timeout: 60000 });
      await p.waitForTimeout(1400);
      assert.ok(
        !(await p.locator("main").innerText()).includes(
          "Workspace unavailable",
        ),
      );
      const overflow = await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (route === "overview") {
        assert.equal(await p.locator('[data-slot="viz"]').count(), 4);
        for (const pill of await p
          .locator('[data-testid="kpi-row"] header .pill')
          .all())
          await expect(pill).toBeVisible();
        for (const card of await p
          .locator('[data-testid="kpi-row"] .pp-card')
          .all())
          assert.equal(await card.locator('[data-slot="viz"]').count(), 1);
        assert.ok((await p.locator('path[fill^="url(#fill-"]').count()) > 0);
        const ticks = await p
          .locator(".recharts-xAxis .recharts-cartesian-axis-tick-value")
          .allTextContents();
        assert.equal(new Set(ticks).size, ticks.length);
        const plot = await p.locator(".studio .chart-well").boundingBox(),
          footer = await p.locator(".studio .chart-footer").boundingBox();
        assert.ok(footer.y >= plot.y + plot.height);
      }
      if (route === "console") {
        assert.ok((await p.locator("[data-level]").count()) > 0);
        await expect(
          p.locator(".live-console .composer .source-chip"),
        ).toBeVisible();
        assert.ok(
          !(await p.locator("main").innerText()).includes(
            "This operation is already in progress.",
          ),
        );
        assert.ok(
          await p.locator(".console-row").evaluateAll((rows) =>
            rows.every((row) => {
              const chip = row.querySelector(".plugin-chip"),
                message = row.querySelector('[data-slot="message"]');
              return (
                !chip ||
                !message ||
                chip.getBoundingClientRect().right <=
                  message.getBoundingClientRect().left
              );
            }),
          ),
          "plugin chips must stay inside their column",
        );
        assert.equal(
          await p.locator("[data-level]").count(),
          await p.locator("[data-level] .severity").count(),
        );
        assert.ok(
          !(await p.locator('[data-slot="message"]').allTextContents()).some(
            (t) => /\[(voicechat|MiniMOTD)\]/.test(t),
          ),
        );
      }
      if (c.width >= 1280) {
        const badge = await p
          .locator(".desktop-sidebar .server-switch > .pp-icon-badge")
          .boundingBox();
        assert.ok(badge && Math.abs(badge.width - 36) < 1);
      }
      await p.screenshot({
        path: `${out}/after/${c.name}-${route}.png`,
        fullPage: true,
        timeout: 60000,
        animations: "disabled",
      });
      const violations = await axe(p);
      const receipt = {
        viewport: c.name,
        route,
        overflow,
        axe: violations,
        errors: [...errors],
      };
      receipts.push(receipt);
      console.log(JSON.stringify(receipt));
      await fs.writeFile(
        `${out}/browser-receipts.json`,
        JSON.stringify(receipts, null, 2),
      );
      assert.equal(overflow, false, JSON.stringify(receipt));
      assert.deepEqual(violations, [], JSON.stringify(receipt));
      assert.deepEqual(errors, []);
    }
    await p.goto("http://127.0.0.1:4176/overview?fixture=healthy");
    await p.getByRole("button", { name: "Stop", exact: true }).waitFor();
    await p.getByRole("button", { name: "Stop", exact: true }).click();
    await p.getByRole("dialog").waitFor();
    assert.equal(
      await p
        .getByRole("button", { name: "Confirm stop", exact: true })
        .isDisabled(),
      true,
    );
    assert.deepEqual(await axe(p), []);
    await p.screenshot({
      path: `${out}/after/${c.name}-review.png`,
      fullPage: true,
      timeout: 60000,
      animations: "disabled",
    });
    await p.keyboard.press("Escape");
    await expect(
      p.getByRole("button", { name: "Stop", exact: true }),
    ).toBeFocused();
    await p.getByRole("button", { name: "Stop", exact: true }).click();
    await p.getByLabel("Type server name").fill("Survival · São Paulo");
    await p.getByRole("button", { name: "Confirm stop", exact: true }).click();
    await p.getByRole("status").filter({ hasText: "SUCCESS" }).waitFor();
    await p.keyboard.press("Escape");
    await p.goto("http://127.0.0.1:4176/players?fixture=healthy");
    await p
      .getByRole("button", { name: "AntônioNeto", exact: false })
      .first()
      .click();
    assert.ok(
      (await p.getByRole("dialog").innerText()).includes(
        "19f50206-26de-410c-a1bc-000000000000",
      ),
    );
    await p.screenshot({
      path: `${out}/states/${c.name}-player-inspector.png`,
      fullPage: true,
      timeout: 60000,
      animations: "disabled",
    });
    await p.keyboard.press("Escape");
    await p.goto("http://127.0.0.1:4176/console?fixture=healthy");
    await p.getByLabel("Server command", { exact: true }).fill("list");
    await p.getByRole("button", { name: /Review command/ }).click();
    await p.getByRole("dialog").waitFor();
    await p.keyboard.press("Escape");
    await p.getByLabel("Server command", { exact: true }).fill("draft");
    await p.getByLabel("Server command", { exact: true }).press("ArrowUp");
    assert.equal(
      await p.getByLabel("Server command", { exact: true }).inputValue(),
      "list",
    );
    await p.getByLabel("Server command", { exact: true }).press("ArrowDown");
    assert.equal(
      await p.getByLabel("Server command", { exact: true }).inputValue(),
      "draft",
    );
    await p.goto("http://127.0.0.1:4176/settings?fixture=healthy");
    await p.getByLabel("Motion", { exact: true }).selectOption("off");
    await p.getByLabel("Chart area fills", { exact: true }).uncheck();
    assert.equal(
      await p.evaluate(() => document.documentElement.dataset.motion),
      "off",
    );
    assert.equal(
      await p
        .locator(".pp-card")
        .first()
        .evaluate((el) => getComputedStyle(el, "::after").animationName),
      "none",
    );
    if (c.width < 768)
      await p
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
    await p
      .locator('nav[aria-label="Primary"]:visible a[href="/performance"]')
      .click();
    await p.waitForURL("**/performance");
    await p.waitForSelector(".studio");
    assert.equal(await p.locator('path[fill^="url(#fill-"]').count(), 0);
    await p.goto("http://127.0.0.1:4176/access?fixture=healthy");
    await p
      .getByRole("button", { name: "Open pairing gate", exact: true })
      .click();
    assert.equal(await p.locator(".otp-cells input").count(), 6);
    await p.screenshot({
      path: `${out}/after/${c.name}-pairing.png`,
      fullPage: true,
      timeout: 60000,
      animations: "disabled",
    });
    assert.deepEqual(await axe(p), []);
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    interactions.push({
      viewport: c.name,
      typedReview: true,
      focusRestored: true,
      uuidInspector: true,
      commandHistory: true,
      motionOff: true,
      chartFillOff: true,
      pairingAxe: 0,
    });
    await context.close();
  }
  {
    const c = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await c.addInitScript(() =>
      localStorage.setItem(
        "plexon:preferences",
        JSON.stringify({ skinProvider: "disabled" }),
      ),
    );
    const p = await c.newPage();
    await p.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
    await p.goto("http://127.0.0.1:4176/overview?fixture=healthy");
    await p
      .getByRole("button", { name: "Collapse sidebar", exact: true })
      .click();
    await expect
      .poll(async () =>
        Math.round((await p.locator(".desktop-sidebar").boundingBox()).width),
      )
      .toBe(72);
    const well = await p
        .locator(".desktop-sidebar .server-switch")
        .boundingBox(),
      badge = await p
        .locator(".desktop-sidebar .server-switch > .pp-icon-badge")
        .boundingBox();
    assert.ok(
      badge.x >= well.x && badge.x + badge.width <= well.x + well.width,
    );
    await p.screenshot({
      path: `${out}/states/sidebar-collapsed.png`,
      fullPage: true,
      timeout: 60000,
      animations: "disabled",
    });
    assert.deepEqual(await axe(p), []);
    await p
      .getByRole("button", { name: "Expand sidebar", exact: true })
      .click();
    await expect
      .poll(async () =>
        Math.round((await p.locator(".desktop-sidebar").boundingBox()).width),
      )
      .toBe(264);
    interactions.push({
      mode: "sidebar-collapse",
      collapsedWidth: 72,
      expandedWidth: 264,
      axe: [],
    });
    await c.close();
  }
  for (const theme of ["dark", "light"])
    for (const accent of ["teal", "blue", "violet"]) {
      const c = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      await c.addInitScript(
        ({ theme, accent }) =>
          localStorage.setItem(
            "plexon:preferences",
            JSON.stringify({ theme, accent, skinProvider: "disabled" }),
          ),
        { theme, accent },
      );
      const p = await c.newPage();
      await p.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
      await p.goto("http://127.0.0.1:4176/overview?fixture=healthy");
      await p.waitForSelector('[data-slot="viz"]');
      await p.waitForTimeout(1200);
      const violations = await axe(p);
      assert.deepEqual(violations, []);
      await p.screenshot({
        path: `${out}/after/accent-${theme}-${accent}.png`,
        fullPage: true,
        timeout: 60000,
        animations: "disabled",
      });
      receipts.push({ theme, accent, axe: violations });
      await c.close();
    }
  for (const mode of [
    "stale",
    "skew",
    "partial",
    "stopped",
    "offline",
    "denied",
  ]) {
    const c = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await c.addInitScript(() =>
      localStorage.setItem(
        "plexon:preferences",
        JSON.stringify({ skinProvider: "disabled" }),
      ),
    );
    const p = await c.newPage();
    await p.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
    await p.goto(`http://127.0.0.1:4176/overview?fixture=${mode}`);
    await p.waitForSelector('[data-slot="viz"]');
    await p.waitForTimeout(400);
    const overflow = await p.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false);
    if (mode === "denied")
      assert.ok(
        !/AntônioNeto|LumaCraft|EnderScout/.test(
          await p.locator("main").innerText(),
        ),
      );
    await p.screenshot({
      path: `${out}/states/${mode}-overview.png`,
      fullPage: true,
      timeout: 60000,
      animations: "disabled",
    });
    interactions.push({ mode, overflow });
    await c.close();
  }
  for (const theme of ["dark", "light"])
    for (const gallery of ["surfaces", "primitives"]) {
      const c = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      await c.addInitScript(
        (theme) =>
          localStorage.setItem(
            "plexon:preferences",
            JSON.stringify({ theme, skinProvider: "disabled" }),
          ),
        theme,
      );
      const page = await c.newPage();
      await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
      await page.goto(`http://127.0.0.1:4176/dev/${gallery}`);
      await page
        .getByRole("heading", { name: "Surface & primitive proofs" })
        .waitFor();
      await page.screenshot({
        path: `${out}/states/gallery-${theme}-${gallery}.png`,
        fullPage: true,
        timeout: 60000,
        animations: "disabled",
      });
      await c.close();
    }
  await fs.writeFile(
    `${out}/browser-receipts.json`,
    JSON.stringify(receipts, null, 2),
  );
  await fs.writeFile(
    `${out}/interaction-receipts.json`,
    JSON.stringify(interactions, null, 2),
  );
  console.log(
    "PASS: " +
      receipts.length +
      " visual configurations and " +
      interactions.length +
      " interaction/state configurations",
  );
} finally {
  await browser?.close();
  server.kill();
}
