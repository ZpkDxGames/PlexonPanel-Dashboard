import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { harness } from "./v5-harness.mjs";
await harness(
  async ({ browser, origin, output }) => {
    const results = [];
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem(
        "plexon:preferences",
        JSON.stringify({ skinProvider: "disabled", motion: "reduced" }),
      ),
    );
    await context.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const mode of [
      "stopped",
      "offline",
      "denied",
      "stale",
      "skew",
      "partial",
    ]) {
      await page.goto(`${origin}/overview?fixture=${mode}`, {
        waitUntil: "networkidle",
      });
      await page.locator("#workspace").waitFor();
      assert.equal(await page.locator("details").count(), 0);
      if (mode === "stopped")
        assert(await page.getByText("Stopped", { exact: true }).count());
      if (mode === "denied")
        assert(
          (await page.locator("body").innerText()).includes("Viewer access"),
        );
      if (mode === "stale" || mode === "skew") {
        await page
          .getByRole("button", { name: "Inspect source status" })
          .click();
        assert.match(
          await page.getByRole("dialog").innerText(),
          mode === "skew" ? /skew/i : /stale/i,
        );
        await page.keyboard.press("Escape");
      }
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
      );
      results.push({ mode, result: "PASS" });
    }
    await page.goto(`${origin}/overview?fixture=healthy`, {
      waitUntil: "networkidle",
    });
    await page.locator("#workspace").waitFor();
    const kpis = await page.getByTestId("overview-kpis").boundingBox(),
      header = await page.getByTestId("server-header").boundingBox();
    assert(kpis.y + kpis.height < 900);
    assert(header.y + header.height < 900);
    assert.equal(
      await page
        .locator("aside[aria-label=Sidebar]")
        .boundingBox()
        .then((b) => b.width),
      240,
    );
    assert.equal(
      await page.locator("[data-testid=telemetry-chart]").count(),
      1,
    );
    await page.getByRole("tab", { name: "Memory Tiers", exact: true }).click();
    assert.equal(
      await page.locator("[data-testid=telemetry-chart]").count(),
      1,
    );
    await page.getByRole("tab", { name: "CPU & Chunks", exact: true }).click();
    assert.equal(
      await page.locator("[data-testid=telemetry-chart]").count(),
      1,
    );
    await page
      .getByRole("button", { name: "Collapse sidebar", exact: true })
      .click();
    assert.equal(
      await page
        .locator("aside[aria-label=Sidebar]")
        .boundingBox()
        .then((b) => b.width),
      72,
    );
    await page
      .getByRole("button", { name: "Expand sidebar", exact: true })
      .click();
    // Inject only test messages through the development transport hook. All external requests are blocked.
    await page.evaluate(() => {
      const state = window.__PLEXON_TEST__.snapshot().state;
      window.__PLEXON_TEST__.receive({
        type: "server.event",
        serverId: state.serverId,
        agentKind: "HOST",
        agentSession: state.ready.server.hostSession,
        eventType: "console.lines",
        body: {
          invocationId: state.bootEpochId,
          lines: [
            {
              capturedAt: new Date().toISOString(),
              level: "INFO",
              content: "[06:31:47 INFO]: Single timestamp contract",
              source: "HOST_JOURNAL",
              invocationId: state.bootEpochId,
              journalCursor: "dedup-contract",
              sourceSequence: 1000,
              streamSession: "fixture",
            },
          ],
        },
      });
    });
    await page
      .getByText("Single timestamp contract", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByText("[06:31:47 INFO]: Single timestamp contract", {
          exact: true,
        })
        .count(),
      0,
    );
    const launcher = page.getByRole("button", { name: "Restart", exact: true });
    await launcher.click();
    const review = page.getByRole("dialog");
    await review.waitFor();
    assert.match(await review.innerText(), /HOST/);
    assert.match(
      await review.innerText(),
      /b820ad3e-02d7-4ec5-9a3d-b66fa4300c3e/,
    );
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      assert(
        await review.evaluate((el) => el.contains(document.activeElement)),
      );
    }
    await page.keyboard.press("Escape");
    await expect(launcher).toBeFocused();
    await page
      .getByRole("button", { name: "Find workspace or server" })
      .click();
    await page
      .getByPlaceholder("Search workspaces and servers…")
      .fill("Players");
    await page.locator("[cmdk-item]").filter({ hasText: "Players" }).click();
    await page.waitForURL("**/players");
    const inspect = page.getByRole("button", {
      name: "Inspect AntônioNeto",
      exact: true,
    });
    await inspect.click();
    assert.match(
      await page.getByRole("dialog").innerText(),
      /19f50206-26de-410c-a1bc-000000000000/,
    );
    await page.keyboard.press("Escape");
    await page.locator("#workspace").focus();
    await page.keyboard.type("g3");
    await page.waitForURL("**/performance");
    await page.locator("[data-testid=telemetry-chart]").first().waitFor();
    assert.equal(
      await page.locator("[data-testid=telemetry-chart]").count(),
      8,
    );
    await page
      .getByRole("button", { name: "Single focus", exact: true })
      .click();
    assert.equal(
      await page.locator("[data-testid=telemetry-chart]").count(),
      1,
    );
    // Verify brush changes the shared timestamp domain and reset restores it.
    const traveller = page.locator(".recharts-brush-traveller").first();
    const brushBox = await traveller.boundingBox();
    assert(brushBox);
    await page.mouse.move(brushBox.x + 4, brushBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(brushBox.x + 150, brushBox.y + 10, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator("[data-testid=telemetry-chart]")).toHaveAttribute(
      "data-zoomed",
      "true",
    );
    await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
    await expect(page.locator("[data-testid=telemetry-chart]")).toHaveAttribute(
      "data-zoomed",
      "false",
    );
    await traveller.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[data-testid=telemetry-chart]")).toHaveAttribute(
      "data-zoomed",
      "true",
    );
    await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
    results.push({
      mode: "desktop-interactions",
      aboveFoldControlsAndKpis: "PASS",
      sidebar240And72: "PASS",
      singleOverviewChart: "PASS",
      segmentedChartTabs: "PASS",
      deduplicatedConsolePrefix: "PASS",
      reviewFocusAndTarget: "PASS",
      commandPalette: "PASS",
      exactPlayerUuid: "PASS",
      sharedBrush: "PASS",
      result: "PASS",
    });
    for (const theme of ["dark", "light"]) {
      await page.evaluate(
        (theme) =>
          localStorage.setItem(
            "plexon:preferences",
            JSON.stringify({
              theme,
              skinProvider: "disabled",
              motion: "reduced",
            }),
          ),
        theme,
      );
      for (const [route, tabs] of [
        ["console", ["Live Chat", "Plugins"]],
        ["access", ["Paired devices", "Authority matrix"]],
        ["settings", ["Connection", "Privacy", "Diagnostics"]],
      ]) {
        await page.goto(`${origin}/${route}?fixture=healthy`, {
          waitUntil: "networkidle",
        });
        await page.locator("#workspace").waitFor();
        for (const tab of tabs) {
          await page.getByRole("tab", { name: tab, exact: true }).click();
          const audit = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          assert.deepEqual(
            audit.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => n.target),
            })),
            [],
            `${route}/${tab}/${theme}`,
          );
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
        }
      }
      await page.goto(`${origin}/players?fixture=healthy`, {
        waitUntil: "networkidle",
      });
      await page.locator("#workspace").waitFor();
      await page
        .getByRole("button", { name: "Inspect AntônioNeto", exact: true })
        .click();
      for (const tab of ["Gameplay", "Moderation", "Commands", "History"]) {
        await page
          .getByRole("dialog")
          .getByRole("tab", { name: tab, exact: true })
          .click();
        const audit = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(
          audit.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
          `player/${tab}/${theme}`,
        );
      }
      await page.keyboard.press("Escape");
    }
    results.push({
      mode: "secondary-panels-dark-light",
      cases: 22,
      result: "PASS",
    });
    await context.close();
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await mobile.addInitScript(() =>
      localStorage.setItem(
        "plexon:preferences",
        JSON.stringify({
          theme: "light",
          textSize: "large",
          density: "spacious",
          skinProvider: "disabled",
          motion: "reduced",
        }),
      ),
    );
    await mobile.route("**/*", (r) =>
      new URL(r.request().url()).hostname === "127.0.0.1"
        ? r.continue()
        : r.abort(),
    );
    const m = await mobile.newPage();
    m.on("pageerror", (e) => errors.push(e.message));
    await m.goto(`${origin}/backups?fixture=healthy`, {
      waitUntil: "networkidle",
    });
    await m.locator("#workspace").waitFor();
    await m
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    const links = m
      .getByRole("dialog")
      .getByRole("navigation", { name: "Workspaces" })
      .getByRole("link");
    assert.equal(await links.count(), 8);
    for (const link of await links.all()) {
      const b = await link.boundingBox();
      assert(b.height >= 44);
    }
    await m.keyboard.press("Escape");
    const schedule = m.getByRole("button", {
      name: "Review schedule",
      exact: true,
    });
    await schedule.click();
    await m.getByRole("dialog").waitFor();
    await m.keyboard.press("Escape");
    await expect(schedule).toBeFocused();
    assert.equal(
      await m.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    const axe = await new AxeBuilder({ page: m })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      axe.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
    );
    assert.deepEqual(errors, []);
    results.push({
      mode: "mobile-large-spacious",
      navigationTouch44px: "PASS",
      reviewRestoration: "PASS",
      overflow: false,
      result: "PASS",
    });
    await m.screenshot({
      path: `${output}/mobile-large-spacious.png`,
      fullPage: true,
    });
    await mobile.close();
    writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  },
  { tag: "v5-interactions", port: 4311 },
);
