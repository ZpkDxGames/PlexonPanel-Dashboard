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
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === base
        ? route.continue()
        : route.abort("blockedbyclient"),
    );
    await context.addInitScript(
      (p) => localStorage.setItem("plexon:preferences", JSON.stringify(p)),
      { theme, motion: "off", skinProvider: "disabled" },
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
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
      await page.goto(`${base}/?fixture=healthy#${route}`, {
        waitUntil: "networkidle",
      });
      await page.locator(".workspace-heading h1").waitFor();
      await page.locator(".route-skeleton").waitFor({ state: "detached" });
      await page.evaluate(() => document.fonts.ready);
      const axe = await new AxeBuilder({ page }).analyze(),
        overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
      await page.screenshot({
        path: `artifacts/previews/${route.toLowerCase()}-${width}-${theme}.png`,
        fullPage: true,
      });
      results.push({
        theme,
        width,
        route,
        overflow,
        violations: axe.violations.map((v) => v.id),
      });
    }
    expect(errors).toEqual([]);
    await context.close();
  }
await browser.close();
await writeFile(
  "artifacts/previews/results.json",
  JSON.stringify(results, null, 2),
);
const failures = results.filter((r) => r.overflow || r.violations.length);
console.log(JSON.stringify({ cases: results.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
