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
  await input.fill("list");
  await input.press("Enter");
  await p.waitForFunction(() => {
    const key = Object.keys(localStorage).find((item) =>
      item.startsWith("plexon:commands:"),
    );
    return key && JSON.parse(localStorage.getItem(key) ?? "[]")[0] === "list";
  });
  check(
    "Safe console command dispatches without a dialog",
    (await p.locator("dialog[open]").count()) === 0 &&
      (await input.inputValue()) === "",
    "Completed command was sent and input cleared",
  );
  await input.fill("draft command");
  await input.press("ArrowUp");
  const recalled = await input.inputValue();
  await input.press("ArrowDown");
  check(
    "History arrows restore the unfinished draft",
    recalled === "list" && (await input.inputValue()) === "draft command",
    JSON.stringify({ recalled, restored: await input.inputValue() }),
  );
  await p.locator(".command-history summary").click();
  check(
    "Command history exposes completed entries",
    (await p.locator(".history-recall", { hasText: "/list" }).count()) === 1,
    "Per-server history menu",
  );
  const historyAxe = await new AxeBuilder({ page: p })
    .include(".con-foot")
    .analyze();
  check(
    "Console input and history have no axe violations",
    historyAxe.violations.length === 0,
    JSON.stringify(historyAxe.violations.map((item) => item.id)),
  );
  await mkdir("docs/revamp/6.5.0", { recursive: true });
  await p.screenshot({
    path: "docs/revamp/6.5.0/console-history-fixed.png",
    fullPage: true,
  });
  await p.locator(".history-recall", { hasText: "/list" }).click();
  check(
    "History entry recalls without executing",
    (await input.inputValue()) === "list",
    await input.inputValue(),
  );
  await p.locator(".command-history summary").click();
  await p.getByRole("button", { name: "Clear all", exact: true }).click();
  check(
    "Command history can be cleared per server",
    (await p.locator(".command-history summary").textContent())?.includes(
      "History 0",
    ),
    "History count returned to zero",
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
  check(
    "Cancelled command is not written to history",
    !(await p.evaluate(() => {
      const key = Object.keys(localStorage).find((item) =>
        item.startsWith("plexon:commands:"),
      );
      return (
        key && JSON.parse(localStorage.getItem(key) ?? "[]").includes("stop")
      );
    })),
    "Only completed commands are retained",
  );
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
  for (const route of ["Overview", "Console", "Players"]) {
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
  const refreshService = () => p.evaluate(async () => {
    const { session } = await import("/src/adapter/session.ts");
    const snap = session.getSnapshot();
    session.receiveFixture({
      type: "server.event", serverId: snap.state.serverId, agentKind: "HOST",
      agentSession: "fixture-host", eventType: "service.status",
      body: { ...snap.state.service, capturedAt: new Date().toISOString(),
        resources: { ...snap.state.service.resources, capturedAt: new Date().toISOString() } }
    });
  });
  await p.evaluate(() => (location.hash = "Overview"));
  await refreshService();
  await p.getByRole("button", { name: "Stop", exact: true }).click();
  await p.locator("dialog[open]").waitFor();
  check(
    "Stop uses one review without redundant typed confirmation",
    (await p.locator("dialog[open] input").count()) === 0,
    "Lifecycle confirmation is the review dialog itself",
  );
  await p.screenshot({
    path: "docs/revamp/6.5.0/lifecycle-confirm-fixed.png",
    fullPage: true,
  });
  // Screenshot capture is not a service producer; refresh fixture evidence before dispatch.
  await refreshService();
  await p
    .getByRole("button", { name: "Confirm & dispatch", exact: true })
    .click();
  await p.locator("dialog[open] .notice").waitFor();
  check("Lifecycle result succeeds", await p.getByText("Server result received").isVisible(),
    (await p.locator("dialog[open]").innerText()) + "\n" + await p.evaluate(async () => {
      const { session } = await import("/src/adapter/session.ts");
      const s = session.getSnapshot();
      return JSON.stringify({ reason: session.reason("server.stop", "HOST"), revision: s.revision, fixture: s.fixture, service: s.state.service, receipt: s.state.receipts?.service, now: Date.now() });
    }));
  const stopAction = await p.evaluate(async () => {
    const { actionLog } = await import("/src/development/fixtures.ts");
    return actionLog.at(-1);
  });
  check(
    "Stop sends the required agent confirmation",
    stopAction?.action === "server.stop" &&
      stopAction?.parameters?.confirmed === true,
    JSON.stringify(stopAction),
  );
  await p.getByRole("button", { name: "Close", exact: true }).click();
  await p.getByRole("button", { name: "Restart", exact: true }).click();
  // Screenshot capture is not a service producer; refresh fixture evidence before dispatch.
  await refreshService();
  await p
    .getByRole("button", { name: "Confirm & dispatch", exact: true })
    .click();
  await p.locator("dialog[open] .notice").waitFor();
  check("Lifecycle result succeeds", await p.getByText("Server result received").isVisible(),
    (await p.locator("dialog[open]").innerText()) + "\n" + await p.evaluate(async () => {
      const { session } = await import("/src/adapter/session.ts");
      const s = session.getSnapshot();
      return JSON.stringify({ reason: session.reason("server.stop", "HOST"), revision: s.revision, fixture: s.fixture, service: s.state.service, receipt: s.state.receipts?.service, now: Date.now() });
    }));
  const restartAction = await p.evaluate(async () => {
    const { actionLog } = await import("/src/development/fixtures.ts");
    return actionLog.at(-1);
  });
  check(
    "Restart sends the required agent confirmation",
    restartAction?.action === "server.restart" &&
      restartAction?.parameters?.confirmed === true,
    JSON.stringify(restartAction),
  );
  await p.getByRole("button", { name: "Close", exact: true }).click();
  await p.waitForFunction(() => {
    const thumb = document.querySelector(".segmented .thumb");
    return thumb && thumb.getBoundingClientRect().width > 0;
  });
  await p.waitForTimeout(500);
  const beforeThumb = await p
    .locator(".segmented")
    .first()
    .locator(".thumb")
    .evaluate((el) => getComputedStyle(el).transform);
  await p.getByRole("button", { name: "MSPT", exact: true }).click();
  await p.waitForTimeout(450);
  const movingThumb = await p
    .locator(".segmented")
    .first()
    .locator(".thumb")
    .evaluate((el) => getComputedStyle(el).transform);
  check(
    "Segmented thumb slides between metrics",
    beforeThumb !== movingThumb,
    JSON.stringify({ beforeThumb, movingThumb }),
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
    await new Promise((r) => setTimeout(r, 150));
    const intermediate = document.querySelectorAll(".kpi-value")[1].textContent;
    const path = document.querySelector(".time-series .chart-line");
    const beforePath = path.getAttribute("d");
    await new Promise((r) => setTimeout(r, 60));
    const flow = beforePath !== path.getAttribute("d");
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
    "Live chart morphs between samples",
    countUp.flow,
    "Bounded SVG path interpolation observed",
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
  await mkdir("docs/revamp/6.5.0", { recursive: true });
  await writeFile(
    "docs/revamp/6.5.0/retained-interactions.json",
    JSON.stringify(checks, null, 2),
  );
}
