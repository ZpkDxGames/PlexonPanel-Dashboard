import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
const s = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4191"],
  { stdio: "ignore" },
);
const checks = [];
function check(name, pass, detail) {
  checks.push({ name, pass, detail });
  if (!pass) throw new Error(name + ": " + detail);
}
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4191")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  const b = await chromium.launch({
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
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  let requests = [];
  p.on("request", (r) => {
    if (/tonimserver|v1\/pairings|v1\/dashboard/.test(r.url()))
      requests.push(r.url());
  });
  await p.addInitScript(() =>
    localStorage.setItem(
      "plexon:preferences",
      JSON.stringify({ theme: "light", skinProvider: "disabled" }),
    ),
  );
  await p.goto("http://127.0.0.1:4191/?demo=1#Console");
  await p.locator(".workspace").waitFor();
  await p.getByRole("button", { name: "Open command palette" }).click();
  await p.getByRole("textbox", { name: "Search commands" }).fill("Worlds");
  await p.getByRole("textbox", { name: "Search commands" }).press("Enter");
  await p.getByRole("heading", { name: "Worlds", exact: true }).waitFor();
  check("Palette filters and Enter navigates", true, "Worlds route rendered");
  await p.evaluate(() => (location.hash = "Console"));
  await p.getByRole("textbox", { name: "Server command" }).waitFor();
  await p.getByRole("textbox", { name: "Search output" }).fill("WorldGuard");
  check(
    "Console search filters",
    (await p.locator(".virtual-log .log-row").count()) === 1,
    "One WorldGuard entry",
  );
  await p.getByRole("button", { name: "Show 3 more lines" }).click();
  check(
    "Trace expands",
    await p.locator(".trace").isVisible(),
    "Grouped trace visible",
  );
  await p.getByRole("textbox", { name: "Search output" }).fill("");
  const input = p.getByRole("textbox", { name: "Server command" });
  await input.fill("save");
  await input.press("Tab");
  check(
    "Autocomplete fills command",
    (await input.inputValue()).startsWith("save-all"),
    "Tab completion",
  );
  await input.fill("stop");
  await input.press("Enter");
  await p.locator("dialog[open]").waitFor();
  check(
    "Danger command requires typed confirmation",
    (await p.locator("dialog[open] input").count()) === 1,
    "Typed target confirmation present",
  );
  check(
    "Cancel receives initial dialog focus",
    await p.evaluate(() => document.activeElement?.textContent === "Cancel"),
    "Destructive action is not focused",
  );
  await p.getByRole("button", { name: "Cancel", exact: true }).click();
  await p.evaluate(() => (location.hash = "Files"));
  await p.locator(".code-editor").waitFor();
  await p.locator(".code-editor").fill("view-distance: 10\n");
  let guard = false;
  p.once("dialog", async (d) => {
    guard = true;
    await d.dismiss();
  });
  await p
    .getByRole("button", { name: "Overview", exact: true })
    .first()
    .click();
  check(
    "Unsaved navigation guard retains draft",
    guard && (await p.locator(".code-editor").inputValue()).includes("10"),
    "Canceled navigation preserved text",
  );
  await p.getByRole("button", { name: "Reset draft" }).click();
  const security = await p.evaluate(async () => {
    const { session } = await import("/src/adapter/session.ts");
    const { makeFixture, fixtureAction } =
      await import("/src/development/fixtures.ts");
    const state = makeFixture("healthy");
    const attack = "<img src=x onerror=window.__xss=1>";
    state.server.motd = attack;
    state.players[0].name = attack;
    state.plugins[0].name = attack;
    state.console = [{ id: "attack", level: "INFO", content: attack }];
    session.installFixture("security", state, fixtureAction);
    return attack;
  });
  for (const route of ["Overview", "Console", "Players", "Plugins"]) {
    await p.evaluate((r) => (location.hash = r), route);
    await p.waitForTimeout(400);
    check(
      "Untrusted " + route + " is inert",
      await p.evaluate(
        () => !window.__xss && document.querySelector("img[src=x]") === null,
      ),
      security,
    );
  }
  await p.evaluate(() => (location.hash = "Console"));
  await p.waitForTimeout(400);
  const burst = await p.evaluate(async () => {
    const { session } = await import("/src/adapter/session.ts");
    const start = performance.now();
    for (let round = 0; round < 1000; round++) {
      const snap = session.getSnapshot();
      session.receiveFixture({
        type: "server.event",
        serverId: snap.state.serverId,
        agentKind: "PAPER",
        agentSession: "fixture-paper",
        eventType: "console.lines",
        body: {
          lines: Array.from({ length: 100 }, (_, i) => ({
            id: `burst-${round}-${i}`,
            level: "INFO",
            content: "[Paper] Saved " + i,
          })),
        },
      });
    }
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    return {
      retained: session.getSnapshot().state.console.length,
      domRows: document.querySelectorAll(".virtual-log .log-row").length,
      elapsed: performance.now() - start,
    };
  });
  check(
    "100k log burst stays bounded",
    burst.retained === 2500 && burst.domRows < 100,
    JSON.stringify(burst),
  );
  await p.evaluate(() => (location.hash = "Overview"));
  await p.waitForTimeout(800);
  const beforeThumb = await p
    .locator(".segmented")
    .first()
    .locator(".thumb")
    .evaluate((el) => getComputedStyle(el).transform);
  await p.getByRole("button", { name: "MSPT", exact: true }).click();
  await p.waitForTimeout(120);
  const movingThumb = await p
    .locator(".segmented")
    .first()
    .locator(".thumb")
    .evaluate((el) => getComputedStyle(el).transform);
  check(
    "Segmented thumb slides between metrics",
    beforeThumb !== movingThumb,
    "Transform changes during transition",
  );
  await p.getByRole("button", { name: "TPS", exact: true }).click();
  await p.mouse.move(0, 0);
  await p.evaluate(async () => {
    const { session } = await import("/src/adapter/session.ts");
    const snap = session.getSnapshot();
    session.receiveFixture({
      type: "server.event",
      serverId: snap.state.serverId,
      agentKind: "PAPER",
      agentSession: "fixture-paper",
      eventType: "telemetry.server",
      body: {
        ...snap.state.server,
        capturedAt: new Date().toISOString(),
        tps: [19.5, 19.5, 19.5],
      },
    });
  });
  await p.waitForTimeout(1100);
  const countUp = await p.evaluate(async () => {
    const { session } = await import("/src/adapter/session.ts");
    const snap = session.getSnapshot();
    session.receiveFixture({
      type: "server.event",
      serverId: snap.state.serverId,
      agentKind: "PAPER",
      agentSession: "fixture-paper",
      eventType: "telemetry.server",
      body: {
        ...snap.state.server,
        capturedAt: new Date().toISOString(),
        tps: [18.7, 19, 19],
      },
    });
    await new Promise((r) => setTimeout(r, 580));
    const intermediate = document.querySelectorAll(".kpi-value")[1].textContent;
    const flow = document
      .querySelector(".time-series g[clip-path] g")
      ?.getAnimations()
      .some((a) => a.playState === "running");
    for (
      let i = 0;
      i < 30 &&
      document.querySelectorAll(".kpi-value")[1].textContent !== "18.70";
      i++
    )
      await new Promise((r) => setTimeout(r, 100));
    return {
      intermediate,
      final: document.querySelectorAll(".kpi-value")[1].textContent,
      flow,
    };
  });
  check(
    "KPI values tween to real measurements",
    countUp.intermediate !== countUp.final && countUp.final === "18.70",
    JSON.stringify(countUp),
  );
  check(
    "Live chart flows between samples",
    countUp.flow,
    "Live SVG wrapper animation observed",
  );
  await p.evaluate(async () => {
    const { session } = await import("/src/adapter/session.ts");
    const { makeFixture, fixtureAction } =
      await import("/src/development/fixtures.ts");
    const state = makeFixture("healthy");
    state.system.capturedAt = new Date(Date.now() - 60000).toISOString();
    state.receipts.paperSystem = Date.now() - 60000;
    session.installFixture("stale-system", state, fixtureAction);
  });
  await p.waitForTimeout(700);
  check(
    "JVM tiles use their own source freshness",
    (await p.locator(".kpi-value").nth(2).textContent()) === "—" &&
      (await p.locator(".kpi-value").nth(3).textContent()) === "—" &&
      (await p.locator(".kpi-value").nth(1).textContent()) !== "—",
    "Fresh Paper TPS does not make stale system values fresh",
  );
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.evaluate(() => (location.hash = "Overview"));
  await p.waitForTimeout(700);
  const animations = await p.evaluate(
    () =>
      document.getAnimations().filter((a) => a.playState === "running").length,
  );
  check(
    "Reduced motion disables looping animations",
    animations === 0,
    String(animations),
  );
  await p.getByRole("button", { name: "Toggle theme" }).click();
  check(
    "Theme toggle persists",
    (await p.evaluate(
      () => JSON.parse(localStorage.getItem("plexon:preferences")).theme,
    )) === "dark",
    "Stored dark preference",
  );
  check(
    "Demo contacts no live relay",
    requests.length === 0,
    JSON.stringify(requests),
  );
  await b.close();
  console.log(JSON.stringify(checks, null, 2));
} finally {
  s.kill();
  await mkdir("docs/revamp/qa", { recursive: true });
  await writeFile(
    "docs/revamp/qa/interactions.json",
    JSON.stringify(checks, null, 2),
  );
}
