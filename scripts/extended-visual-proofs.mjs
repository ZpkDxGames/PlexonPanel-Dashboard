import { firefox, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4173",
  browser = await firefox.launch(),
  results = [];
await mkdir("artifacts/previews", { recursive: true });
for (const theme of ["dark", "light"])
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      reducedMotion: "reduce",
    });
    await context.route("**/*", (r) =>
      new URL(r.request().url()).origin === base
        ? r.continue()
        : r.abort("blockedbyclient"),
    );
    await context.addInitScript(
      (p) => localStorage.setItem("plexon:preferences", JSON.stringify(p)),
      { theme, motion: "off", skinProvider: "disabled" },
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    async function capture(name, fullPage = true) {
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const axe = await new AxeBuilder({ page }).analyze();
      await page.screenshot({
        path: `artifacts/previews/${name}-${width}-${theme}.png`,
        fullPage,
      });
      results.push({
        name,
        width,
        theme,
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        violations: axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      });
    }
    await page.goto(`${base}/?fixture=healthy#Overview`);
    await page.locator(".overview-grid").waitFor();
    await capture("overview-viewport", false);
    if (width === 1440) {
      const rect = await page.locator(".usage-panel").boundingBox();
      results.push({
        name: "usage-visible-at-900px",
        theme,
        width,
        top: rect.y,
        passed: rect.y < 900,
      });
    }
    await page.evaluate(() => (location.hash = "Players"));
    await page.locator(".player-row").first().click();
    await capture("player-profile");
    await page.evaluate(() => (location.hash = "Settings"));
    await page.locator("#settings-appearance").waitFor();
    for (const [section, label] of [
      ["connection", "Connections"],
      ["privacy", "Privacy & skins"],
      ["diagnostics", "Diagnostics"],
    ]) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await capture(`settings-${section}`);
    }
    await page.evaluate(() => (location.hash = "Console"));
    await page.getByRole("tab", { name: "Live chat", exact: true }).click();
    await capture("chat");
    await page
      .getByRole("tab", { name: "Plugin inventory", exact: true })
      .click();
    await capture("plugins");
    await page.goto(base);
    await page
      .getByRole("heading", { name: "Connect a server", exact: true })
      .waitFor();
    await capture("pairing");
    results.push({ name: "page-errors", theme, width, errors });
    await context.close();
  }
await browser.close();
await writeFile(
  "artifacts/previews/extended-results.json",
  JSON.stringify(results, null, 2),
);
const failures = results.filter(
  (r) =>
    r.overflow ||
    r.violations?.length ||
    r.errors?.length ||
    r.passed === false,
);
console.log(JSON.stringify({ cases: results.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
