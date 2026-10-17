import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { harness } from "./v5-harness.mjs";
await harness(
  async ({ browser, origin, output }) => {
    const results = [];
    for (const mode of [
      "stopped",
      "offline",
      "denied",
      "stale",
      "skew",
      "partial",
    ]) {
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
      await page.goto(`${origin}/overview?fixture=${mode}`, {
        waitUntil: "networkidle",
      });
      await page.locator("#workspace").waitFor();
      const text = await page.locator("body").innerText();
      if (mode === "stopped") assert(text.includes("Service stopped"));
      if (mode === "denied") assert(text.includes("Viewer"));
      if (mode === "stale") assert(/stale/i.test(text));
      if (mode === "skew") assert(/skew/i.test(text));
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(errors, []);
      assert.equal(axe.violations.length, 0);
      results.push({
        mode,
        result: "PASS",
        pageErrors: errors,
        axeViolations: 0,
      });
      await context.close();
    }
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem(
        "plexon:preferences",
        JSON.stringify({
          theme: "light",
          textSize: "large",
          density: "spacious",
          motion: "reduced",
          skinProvider: "disabled",
        }),
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
    await page.goto(`${origin}/backups?fixture=healthy`, {
      waitUntil: "networkidle",
    });
    await page.locator("#workspace").waitFor();
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    const links = page.locator(".mobile-route-list a");
    assert.equal(await links.count(), 8);
    for (const link of await links.all()) {
      const box = await link.boundingBox();
      assert(box.height >= 44);
    }
    await page.keyboard.press("Escape");
    const launcher = page.getByRole("button", {
      name: "Review schedule changes",
      exact: true,
    });
    await launcher.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const text = await dialog.innerText();
    assert(
      text.includes("HOST") &&
        text.includes("b820ad3e-02d7-4ec5-9a3d-b66fa4300c3e"),
    );
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      assert(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      );
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    assert(await launcher.evaluate((el) => document.activeElement === el));
    await page.locator("#workspace").focus();
    await page.keyboard.type("g3");
    await page.waitForURL("**/performance");
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.equal(axe.violations.length, 0);
    assert.deepEqual(errors, []);
    results.push({
      mode: "mobile-large-spacious",
      drawerTargets44px: "PASS",
      reviewFocusTrapAndRestoration: "PASS",
      exactPreparedTarget: "PASS",
      keyboardRouteShortcut: "PASS",
      overflow,
      pageErrors: errors,
      axeViolations: 0,
    });
    writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
    await page.screenshot({
      path: `${output}/mobile-large-spacious.png`,
      fullPage: true,
    });
    await context.close();
  },
  { tag: "v5-interactions" },
);
