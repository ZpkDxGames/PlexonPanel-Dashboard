import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const port = 4216;
const base = `http://127.0.0.1:${port}`;
const out = "docs/revamp/6.5.0";
const routes = [
  "Overview",
  "Console",
  "Players",
  "Performance",
  "Worlds",
  "Backups",
  "Schedules",
  "Logs",
  "Fleet",
  "Access",
  "Settings",
];
const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 800 },
  { width: 1024, height: 720 },
  { width: 1280, height: 800 },
  { width: 1577, height: 929 },
  { width: 1920, height: 1080 },
];
const landmarks = {
  Overview: ".overview-kpis",
  Console: ".console.full",
  Players: ".players-layout",
  Performance: ".performance-grid",
  Worlds: ".worlds-grid",
  Backups: ".backup-create",
  Schedules: ".schedule-hero",
  Logs: ".event-list",
  Fleet: ".fleet-layout",
  Access: ".access-grid",
  Settings: ".settings-grid",
};

const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { stdio: "ignore" },
);

try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.PLEXON_CHROMIUM,
    args: [
      "--no-sandbox",
      "--no-zygote",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: viewports[0],
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "plexon:preferences",
      JSON.stringify({
        theme: "light",
        reduceMotion: true,
        skinProvider: "disabled",
      }),
    ),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await page.route(/https:\/\/(crafatar|mc-heads|minotar)/, (route) =>
    route.abort(),
  );
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  const results = [];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(`${base}/?demo=1#${route}`);
      await page
        .locator(landmarks[route])
        .first()
        .waitFor({ state: "attached" });
      await page.waitForFunction(
        () => !document.querySelector(".route-skeleton"),
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(80);

      const layout = await page.evaluate(
        ({ route, width, height }) => {
          const html = document.documentElement;
          const topbar = document
            .querySelector(".topbar")
            ?.getBoundingClientRect();
          const heading = document
            .querySelector(".workspace-heading")
            ?.getBoundingClientRect();
          const cutControls = [
            ...document.querySelectorAll("button,input,select,textarea"),
          ]
            .filter((node) => {
              const el = /** @type {HTMLElement} */ (node);
              const rect = el.getBoundingClientRect();
              if (
                rect.width < 1 ||
                rect.height < 1 ||
                rect.bottom <= 0 ||
                rect.top >= height
              )
                return false;
              if (
                el.closest(
                  ".overview-kpis,.table-region,.fleet-table,.primary-nav,.filters",
                )
              )
                return false;
              return rect.left < -1 || rect.right > width + 1;
            })
            .map((node) => ({
              tag: node.tagName,
              className: String(node.className).slice(0, 80),
            }));
          const clippedText = [
            ...document.querySelectorAll(
              "h1,h2,h3,.button,.status,.server-context strong,.panel-header .sub",
            ),
          ]
            .filter((node) => {
              const el = /** @type {HTMLElement} */ (node);
              const style = getComputedStyle(el);
              return (
                el.clientWidth > 0 &&
                el.scrollWidth > el.clientWidth + 2 &&
                style.textOverflow !== "ellipsis" &&
                style.overflowX !== "auto"
              );
            })
            .map((node) => ({
              text: node.textContent?.trim().slice(0, 80),
              className: String(node.className).slice(0, 80),
            }));
          return {
            route,
            viewport: `${width}x${height}`,
            documentOverflow:
              Math.max(html.scrollWidth, document.body.scrollWidth) > width,
            titleOverlap: Boolean(
              route !== "Overview" &&
              topbar &&
              heading &&
              heading.top < topbar.bottom - 1,
            ),
            cutControls,
            clippedText,
          };
        },
        { route, ...viewport },
      );

      const charts = page.locator(".time-series");
      const chartCount = await charts.count();
      const chartHover = [];
      for (let i = 0; i < chartCount; i++) {
        const chart = charts.nth(i);
        const box = await chart.boundingBox();
        if (!box) continue;
        await chart.hover({
          position: { x: box.width * 0.56, y: box.height * 0.45 },
        });
        const parent = chart.locator("xpath=..");
        const tooltip = parent.locator(".chart-tooltip");
        const tipBox = (await tooltip.count())
          ? await tooltip.boundingBox()
          : null;
        chartHover.push({
          index: i,
          crosshair: (await chart.locator(".crosshair").count()) === 1,
          tooltipInside: Boolean(
            tipBox &&
            tipBox.x >= box.x - 1 &&
            tipBox.x + tipBox.width <= box.x + box.width + 1,
          ),
        });
      }
      results.push({ ...layout, chartHover });

      if (route === "Console" && viewport.width === 1577) {
        const commandEnabled = await page.locator(".prompt input").isEnabled();
        const headingBox = await page
          .locator(".workspace-heading")
          .boundingBox();
        const topbarBox = await page.locator(".topbar").boundingBox();
        results.at(-1).ownerCommandEnabled = commandEnabled;
        results.at(-1).headingGap =
          headingBox && topbarBox
            ? Math.round(headingBox.y - (topbarBox.y + topbarBox.height))
            : null;
        await page.screenshot({
          path: `${out}/console-fixed-1577x929.png`,
          fullPage: true,
        });
      }
      if (route === "Access" && viewport.width === 1577) {
        results.at(-1).ownerFullControl =
          (await page.locator(".scope-view").textContent())?.includes(
            "Full control · 54 permissions",
          ) ?? false;
      }
    }
  }

  const failures = results.filter(
    (result) =>
      result.documentOverflow ||
      result.titleOverlap ||
      result.cutControls.length ||
      result.clippedText.length ||
      result.chartHover.some(
        (chart) => !chart.crosshair || !chart.tooltipInside,
      ) ||
      result.ownerCommandEnabled === false ||
      result.ownerFullControl === false,
  );
  const report = {
    generatedAt: new Date().toISOString(),
    cases: results.length,
    runtimeErrors,
    failures,
    results,
  };
  await writeFile(
    `${out}/responsive-results.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        cases: results.length,
        failures: failures.length,
        runtimeErrors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  if (failures.length || runtimeErrors.length) process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
}
