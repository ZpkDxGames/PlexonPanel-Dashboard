import { chromium, firefox } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://127.0.0.1:4173";
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
const matrices = [
  {
    name: "desktop-dark-comfortable-full",
    width: 1440,
    height: 1000,
    theme: "dark",
    density: "comfortable",
    motion: "full",
    routes,
  },
  {
    name: "tablet-light-spacious-reduced",
    width: 1024,
    height: 900,
    theme: "light",
    density: "spacious",
    motion: "reduced",
    routes,
  },
  {
    name: "phone-light-compact-off",
    width: 390,
    height: 844,
    theme: "light",
    density: "compact",
    motion: "off",
    routes,
  },
  {
    name: "narrow-360-dark",
    width: 360,
    height: 800,
    theme: "dark",
    density: "comfortable",
    motion: "full",
    routes: ["Overview"],
  },
  {
    name: "tablet-768-light",
    width: 768,
    height: 1024,
    theme: "light",
    density: "comfortable",
    motion: "full",
    routes: ["Overview"],
  },
  {
    name: "wide-1920-dark",
    width: 1920,
    height: 1200,
    theme: "dark",
    density: "comfortable",
    motion: "full",
    routes: ["Overview"],
  },
  {
    name: "dark-azure",
    width: 1440,
    height: 1000,
    theme: "dark",
    density: "comfortable",
    motion: "off",
    accent: "blue",
    routes: ["Overview"],
  },
  {
    name: "dark-violet",
    width: 1440,
    height: 1000,
    theme: "dark",
    density: "comfortable",
    motion: "off",
    accent: "violet",
    routes: ["Overview"],
  },
  {
    name: "light-azure",
    width: 1440,
    height: 1000,
    theme: "light",
    density: "comfortable",
    motion: "off",
    accent: "blue",
    routes: ["Overview"],
  },
  {
    name: "light-violet-no-fill",
    width: 1440,
    height: 1000,
    theme: "light",
    density: "comfortable",
    motion: "off",
    accent: "violet",
    chartFill: false,
    routes: ["Overview"],
  },
  {
    name: "partial-evidence",
    width: 1440,
    height: 1000,
    theme: "dark",
    density: "comfortable",
    motion: "off",
    fixture: "partial",
    routes: ["Overview"],
  },
  {
    name: "offline-operations",
    width: 390,
    height: 844,
    theme: "light",
    density: "compact",
    motion: "off",
    fixture: "offline",
    routes: ["Overview", "Console", "Backups"],
  },
  {
    name: "denied-access",
    width: 768,
    height: 1024,
    theme: "dark",
    density: "comfortable",
    motion: "reduced",
    fixture: "denied",
    routes: ["Players", "Access"],
  },
];

const launchOptions = { headless: true };
let browser;
let engine = "chromium";
try {
  browser = await chromium.launch(launchOptions);
} catch (chromiumError) {
  engine = "firefox";
  try {
    browser = await firefox.launch(launchOptions);
  } catch (firefoxError) {
    throw new AggregateError(
      [chromiumError, firefoxError],
      "No Playwright browser is installed. Run `npx playwright install chromium` or `npx playwright install firefox`.",
    );
  }
}

await mkdir("artifacts/browser", { recursive: true });
const results = [];
for (const matrix of matrices) {
  const context = await browser.newContext({
    viewport: { width: matrix.width, height: matrix.height },
    reducedMotion: matrix.motion === "full" ? "no-preference" : "reduce",
  });
  // QA is isolated from external skin providers and all live services.
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === new URL(base).origin
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  await context.addInitScript(() =>
    localStorage.setItem(
      "plexon:preferences",
      JSON.stringify({ skinProvider: "disabled" }),
    ),
  );
  const preferenceFixture = {
    theme: matrix.theme,
    density: matrix.density,
    textSize: "standard",
    accent: matrix.accent ?? "teal",
    motion: matrix.motion,
    chartFill: matrix.chartFill ?? true,
    timezone: "browser",
    skinProvider: "disabled",
  };
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const fixture = matrix.fixture ?? "healthy";
  await page.goto(`${base}/?fixture=${fixture}#${matrix.routes[0]}`, {
    waitUntil: "networkidle",
  });
  await page.locator(".workspace-heading h1").waitFor();
  await page.locator(".route-skeleton").waitFor({ state: "detached" });
  await page.evaluate(async (next) => {
    const { preferences } = await import("/src/store/preferences.ts");
    preferences.update(next);
  }, preferenceFixture);
  await page.waitForFunction((expected) => {
    const root = document.documentElement.dataset;
    return (
      root.theme === expected.theme &&
      root.density === expected.density &&
      root.motion === expected.motion
    );
  }, preferenceFixture);

  for (const [index, route] of matrix.routes.entries()) {
    if (index > 0)
      await page.goto(`${base}/?fixture=${fixture}#${route}`, {
        waitUntil: "networkidle",
      });
    await page.locator(".workspace-heading h1").waitFor();
    await page.locator(".route-skeleton").waitFor({ state: "detached" });
    await page.waitForTimeout(matrix.motion === "full" ? 700 : 180);
    await page.evaluate(() => document.fonts.ready);
    const browserState = await page.evaluate(() => ({
      overflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      theme: document.documentElement.dataset.theme,
      density: document.documentElement.dataset.density,
      motion: document.documentElement.dataset.motion,
      accent: document.documentElement.dataset.accent,
      chartFill: document.documentElement.dataset.chartFill,
    }));
    const axe = await new AxeBuilder({ page }).analyze();
    await page.screenshot({
      path: `artifacts/browser/${matrix.name}-${route.toLowerCase()}.png`,
      fullPage: true,
    });
    results.push({
      matrix: matrix.name,
      viewport: `${matrix.width}x${matrix.height}`,
      route,
      ...browserState,
      preferencesApplied:
        browserState.theme === matrix.theme &&
        browserState.density === matrix.density &&
        browserState.motion === matrix.motion &&
        browserState.accent === preferenceFixture.accent &&
        browserState.chartFill === String(preferenceFixture.chartFill),
      violations: axe.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        targets: violation.nodes.slice(0, 3).map((node) => node.target),
      })),
    });
  }

  if (matrix.name === "desktop-dark-comfortable-full") {
    await page.keyboard.press("Control+K");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await palette.waitFor();
    await page
      .getByPlaceholder("Search workspaces and paired servers")
      .fill("backups");
    await palette.getByRole("button", { name: /Backups/ }).click();
    await page.locator("h1", { hasText: "Backups" }).waitFor();
    results.push({
      matrix: matrix.name,
      interaction: "command-palette-navigation",
      passed: true,
    });
  }

  if (matrix.name === "phone-light-compact-off") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await drawer.waitFor();
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "detached" });
    results.push({
      matrix: matrix.name,
      interaction: "mobile-drawer-escape",
      passed: true,
    });
  }

  results.push({ matrix: matrix.name, consoleErrors: errors });
  await context.close();
}
await browser.close();

await writeFile(
  "artifacts/browser-results.json",
  JSON.stringify(
    { base, engine, createdAt: new Date().toISOString(), results },
    null,
    2,
  ),
);
const failures = results.filter(
  (result) =>
    result.overflow ||
    result.violations?.length ||
    result.consoleErrors?.length ||
    result.preferencesApplied === false ||
    result.passed === false,
);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
} else {
  const pageCases = results.filter((result) => result.route).length;
  console.log(
    `Browser checks passed in ${engine}: ${pageCases} route/matrix cases, zero axe violations, no document overflow or console errors.`,
  );
}
