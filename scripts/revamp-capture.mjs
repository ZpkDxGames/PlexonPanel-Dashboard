import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
const args = process.argv.slice(2),
  baseline = args.includes("--baseline"),
  axe = args.includes("--axe");
const routeArg = args.find((a) => a.startsWith("--routes="));
const routes = routeArg
  ? routeArg.slice(9).split(",")
  : [
      "Overview",
      "Console",
      "Players",
      "Performance",
      "Files",
      "Backups",
      "Settings",
      "Plugins",
      "Worlds",
      "Schedules",
      "Logs",
      "Fleet",
      "Access",
    ];
const out = baseline ? "docs/revamp/before" : "docs/revamp/after";
const port = baseline ? 4180 : 4173;
const cwd = baseline ? process.env.PLEXON_BASELINE_DIR : process.cwd();
const server = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
  cwd,
  stdio: "ignore",
});
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  await mkdir(out, { recursive: true });
  const browserArgs = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-zygote",
    "--disable-setuid-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ];
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLEXON_CHROMIUM
      ? { executablePath: process.env.PLEXON_CHROMIUM, args: browserArgs }
      : {}),
  });
  const context = await browser.newContext();
  let page = await context.newPage();
  const results = [];
  let errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/https:\/\/(crafatar|mc-heads|minotar)/, (r) =>
    r.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path fill="#8a5a38" d="M0 0h8v8H0z"/><path fill="#333" d="M0 0h8v3H0z"/><path fill="#efc09c" d="M1 4h6v3H1z"/><path fill="#333" d="M2 4h1v1H2zM5 4h1v1H5z"/></svg>',
    }),
  );
  await page.addInitScript(() => {
    const q = new URL(location.href).searchParams;
    localStorage.setItem(
      "plexon:preferences",
      JSON.stringify({
        theme: q.get("theme") ?? "light",
        skinProvider: "disabled",
      }),
    );
  });
  const states =
    args
      .find((a) => a.startsWith("--states="))
      ?.slice(9)
      .split(",") ?? (baseline ? ["healthy"] : ["healthy", "idle", "offline"]);
  const widths =
    args
      .find((a) => a.startsWith("--widths="))
      ?.slice(9)
      .split(",")
      .map(Number) ??
    (args.includes("--responsive")
      ? [360, 768, 1280, 1920, 2560]
      : [1440, 390]);
  for (const theme of ["light", "dark"])
    for (const mode of states)
      for (const width of widths) {
        await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
        await page.goto(
          `http://127.0.0.1:${port}/?fixture=${mode}&theme=${theme}#${routes[0]}`,
        );
        await page.locator(".workspace").waitFor();
        await page.evaluate(() => document.fonts.ready);
        for (const route of routes) {
          await page.close();
          page=await context.newPage();
          await page.setViewportSize({width,height:width<500?844:900});
          page.on("pageerror",e=>errors.push(e.message));
          await page.addInitScript(()=>{localStorage.setItem("plexon:preferences",JSON.stringify({theme:new URL(location.href).searchParams.get("theme"),skinProvider:"disabled"}));});
          await page.goto(`http://127.0.0.1:${port}/?fixture=${mode}&theme=${theme}#${route}`);
          await page.locator(".workspace").waitFor();
          errors = [];
          await page.evaluate((r) => (location.hash = r), route);
          if (route === "Styleguide")
            await page.locator(".style-colors").waitFor();
          else await page.locator(".workspace h1").first().waitFor();
          await page.waitForTimeout(800);
          const file = `${out}/${route}-${theme}-${width}${baseline ? "" : "-" + mode}.png`;
          await page.screenshot({ path: file, fullPage: true, animations: "disabled", timeout:15000 });
          const overflow = await page.evaluate(() => ({
            page: document.documentElement.scrollWidth > innerWidth,
            overs: Array.from(document.querySelectorAll("*"))
              .filter(
                (el) =>
                  el.getBoundingClientRect().right > innerWidth + 2 &&
                  getComputedStyle(el).position !== "absolute",
              )
              .slice(0, 8)
              .map((el) => el.className),
          }));
          const violations = axe
            ? (await new AxeBuilder({ page }).analyze()).violations.map(
                (v) => ({
                  id: v.id,
                  impact: v.impact,
                  nodes: v.nodes.map((n) => ({
                    target: n.target,
                    summary: n.failureSummary,
                  })),
                }),
              )
            : [];
          results.push({
            route,
            theme,
            mode,
            width,
            file,
            overflow: overflow.page,
            overs: overflow.overs,
            errors: [...errors],
            violations,
          });
          await writeFile(
            `${out}/progress.json`,
            JSON.stringify(results, null, 2),
          );
          console.log(
            `${route} ${theme} ${mode} ${width}: overflow=${overflow.page}, errors=${errors.length}, axe=${violations.length}`,
          );
        }
      }
  await browser.close();
  await writeFile(
    `${out}/results${routeArg ? "-" + routes.join("-") : ""}${axe ? "-axe" : ""}${args.includes("--responsive") ? "-responsive" : ""}.json`,
    JSON.stringify(results, null, 2),
  );
  if (results.some((r) => r.overflow || r.errors.length || r.violations.length))
    process.exitCode = 1;
} finally {
  server.kill();
}
