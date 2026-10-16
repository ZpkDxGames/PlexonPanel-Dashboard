import { firefox, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim();
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4173",
  browser = await firefox.launch(),
  results = [],
  errors = [];
await mkdir("artifacts/nextgen/screenshots", { recursive: true });
const finalPass = process.argv.includes("--final");
const selectedRoutes = process.argv
  .find((a) => a.startsWith("--only="))
  ?.slice(7)
  .split(",");
const routes = [
  "Fleet",
  "Overview",
  "Performance",
  "Players",
  "Console",
  "Backups",
  "Access",
  "Settings",
];
for (const theme of ["dark", "light"]) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await context.route("**/*", (r) =>
    new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
  );
  await context.addInitScript(
    (p) => localStorage.setItem("plexon:preferences", JSON.stringify(p)),
    { theme, motion: "off", skinProvider: "disabled" },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/?fixture=healthy#Overview`);
  await page.locator(".overview-grid").waitFor();
  await page.clock.setFixedTime(new Date("2026-10-16T18:00:00Z"));
  await page.waitForTimeout(1200);
  async function go(name, prefs = {}) {
    await page.evaluate(
      async ({ name, prefs, theme }) => {
        const { session } = await import("/src/adapter/session.ts");
        const { makeFixture, fixtureAction } = await import(
          "/src/development/fixtures.ts"
        );
        const { preferences } = await import("/src/store/preferences.ts");
        preferences.update({
          theme,
          motion: "off",
          skinProvider: "disabled",
          density: "comfortable",
          textSize: "standard",
          ...prefs,
        });
        location.hash = name;
        session.installFixture("matrix", makeFixture("healthy"), fixtureAction);
      },
      { name, prefs, theme },
    );
    await page.locator(".route-skeleton").waitFor({ state: "detached" });
    await page.locator(".workspace-heading h1").waitFor();
    await page.evaluate(() => document.fonts.ready);
  }
  async function capture(name, width, { screens = true, axe = true } = {}) {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    const violations = axe
      ? (await new AxeBuilder({ page }).analyze()).violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        }))
      : [];
    if (screens) {
      await page.screenshot({
        path: `artifacts/nextgen/screenshots/${name}-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.screenshot({
        path: `artifacts/nextgen/screenshots/${name}-${width}-${theme}-viewport.png`,
      });
    }
    results.push({ name, width, theme, overflow, violations, sourceHead, browser: browser.version(), capturedAt: new Date().toISOString(), viewport: page.viewportSize(), zoom: "100% (no browser zoom applied)", fixture: "healthy / local synthetic", actualTheme: await page.locator("html").getAttribute("data-theme") });
  }
  for (const width of finalPass
    ? [390, 820, 1440]
    : [320, 390, 640, 820, 1024, 1440, 1920]) {
    await page.setViewportSize({
      width,
      height: ({320:800,390:844,640:960,820:1180,1024:768,1440:900,1920:1080})[width],
    });
    for (const route of routes.filter(
      (r) => !selectedRoutes || selectedRoutes.includes(r),
    )) {
      await go(route);
      await capture(route.toLowerCase(), width, {
        screens:
          [390, 1440].includes(width) || (width === 820 && theme === "light"),
      });
      if (route === "Backups" && width === 390) {
        const retry = await page.getByRole("button", {name:"Review upload retry",exact:true}).boundingBox();
        const result = {name:"backup-retry-first-viewport",width,theme,bottom:retry.y+retry.height,sourceHead};
        results.push(result);
        expect(result.bottom).toBeLessThanOrEqual(844);
      }
      if (route === "Console" && width === 1440) {
        const composer = await page.locator(".command-composer").boundingBox();
        const rows = await page
          .locator(".terminal-scroll")
          .evaluate(
            (el) =>
              el.clientHeight /
              el.querySelector(".terminal-ruler").getBoundingClientRect()
                .height,
          );
        results.push({
          name: "console-first-viewport",
          width,
          theme,
          composerBottom: composer.y + composer.height,
          visibleRows: rows,
          passed: composer.y + composer.height <= 900 && rows >= 12,
        });
      }
      if (route === "Overview" && width === 1440) {
        const readings = await page.locator(".stat-cell").count(),
          plot = await page.locator(".usage-panel .time-series").boundingBox(),
          sixth = await page.locator(".preview-line").nth(5).boundingBox();
        results.push({
          name: "overview-first-viewport",
          width,
          theme,
          readings,
          plotBottom: plot.y + plot.height,
          sixthLineBottom: sixth.y + sixth.height,
          passed:
            plot.y + plot.height <= 900 &&
            sixth.y + sixth.height <= 900 &&
            readings === 4,
        });
      }
    }
  }
  for (const width of finalPass ? [320] : [320, 390, 820]) {
    await page.setViewportSize({ width, height: width === 820 ? 1180 : 844 });
    for (const route of routes.filter(
      (r) => !selectedRoutes || selectedRoutes.includes(r),
    )) {
      await go(route, {
        density: theme === "dark" ? "compact" : "spacious",
        textSize: theme === "dark" && width !== 320 ? "small" : "large",
      });
      await capture(`${route.toLowerCase()}-preferences`, width, {
        screens: false,
      });
    }
  }
  if (process.argv.includes("--layout-only")) {
    await context.close();
    continue;
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await go("Players");
    await page.locator(".player-row").first().click();
    for (const tab of ["Interact", "Moderate", "Commands"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await capture(`profile-${tab.toLowerCase()}`, width);
    }
    await page.getByRole("button", { name: "Moderate", exact: true }).click();
    await page.getByRole("button", { name: "Ban", exact: true }).click();
    await capture("review-typed", width);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await go("Console");
    for (const tab of ["Live chat", "Plugin inventory"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await capture(tab === "Live chat" ? "chat" : "plugins", width);
    }
    await go("Access");
    for (const tab of ["Paired devices", "Your authority"]) {
      await page.getByRole("button", { name: new RegExp(tab) }).click();
      await capture(tab === "Paired devices" ? "devices" : "authority", width);
    }
    await go("Settings");
    for (const section of ["connection", "privacy", "diagnostics"]) {
      await page
        .getByRole("link", {
          name:
            section === "connection"
              ? "Connections"
              : section === "privacy"
                ? "Privacy & skins"
                : "Diagnostics",
          exact: true,
        })
        .click();
      await capture(`settings-${section}`, width);
    }
    await go("Overview");
    await page.getByRole("button", { name: "Restart", exact: true }).click();
    await capture("review-ordinary", width);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Find workspace or server", exact: true })
      .click();
    await page.getByLabel("Search commands").fill("no-matching-workspace");
    await capture("palette-no-results", width);
    await page.keyboard.press("Escape");
    if (width === 390) {
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
      await capture("navigation", width);
      await page.keyboard.press("Escape");
    }
  }
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Connect a server", exact: true })
    .waitFor();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await capture("pairing", width);
  }
  await context.close();
}
await browser.close();
await writeFile(
  finalPass
    ? "artifacts/nextgen/matrix-final.json"
    : "artifacts/nextgen/matrix.json",
  JSON.stringify({ results, errors }, null, 2),
);
const failures = results.filter(
  (r) => r.overflow || r.violations?.length || r.passed === false,
);
console.log(
  JSON.stringify({ cases: results.length, failures, errors }, null, 2),
);
if (failures.length || errors.length) process.exitCode = 1;
