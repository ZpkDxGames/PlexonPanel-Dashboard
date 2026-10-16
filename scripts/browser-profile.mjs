import { firefox } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await firefox.launch();
const reports = [];
const cases = [
  ["baseline-overview", "../baseline", 4180, false, "Overview"],
  ["control-room-overview", ".", 4181, false, "Overview"],
  ["baseline-focus", "../baseline", 4182, false, "Performance"],
  ["control-room-focus", ".", 4183, false, "Performance"],
  ["baseline-compare", "../baseline", 4184, true, "Performance"],
  ["control-room-compare", ".", 4185, true, "Performance"],
];
const selectedCases =
  process.argv[2] === "compare"
    ? [1, 2, 3].flatMap((run) =>
        cases
          .filter((row) => row[3])
          .map((row) => [`${row[0]}-run${run}`, ...row.slice(1)]),
      )
    : cases;
for (const [name, cwd, port, compare, route] of selectedCases) {
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd, stdio: "ignore" },
  );
  try {
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(`http://127.0.0.1:${port}`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem(
        "plexon:preferences",
        JSON.stringify({ motion: "off", skinProvider: "disabled" }),
      ),
    );
    await context.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue()
        : route.abort("blockedbyclient"),
    );
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/?fixture=healthy#${route}`);
    await page.locator(".workspace-heading h1").waitFor();
    await page.locator(".route-skeleton").waitFor({ state: "detached" });
    await page.evaluate(async () => {
      const { preferences } = await import("/src/store/preferences.ts");
      preferences.update({
        theme: "dark",
        motion: "off",
        skinProvider: "disabled",
        textSize: "standard",
        density: "comfortable",
      });
    });
    const metrics = await page.evaluate(async (compare) => {
      const { session } = await import("/src/adapter/session.ts"),
        { makeFixture, fixtureAction } =
          await import("/src/development/fixtures.ts");
      const end = Date.now(),
        start = end - 3000,
        state = makeFixture("healthy", start);
      state.console = Array.from({ length: 2500 }, (_, i) => ({
        id: `soak-${i}`,
        capturedAt: new Date(start).toISOString(),
        content: `Synthetic line ${i}`,
        level: "INFO",
        source: "HOST",
      }));
      state.history = Array.from({ length: 8192 }, (_, i) => ({
        at: start - (8191 - i) * 250,
        tps: i % 499 === 0 ? 8 : 19.9,
        mspt: i % 499 === 0 ? 90 : 30,
        hostCpu: 25,
        processCpu: 40,
        heap: 3e9,
        memory: 8e9,
        players: 24,
        gc: i,
        sources: {
          paperHealth: start - (8191 - i) * 250,
          paperSystem: start - (8191 - i) * 250,
          hostSystem: start - (8191 - i) * 250,
          service: start - (8191 - i) * 250,
        },
        serviceCpu: 150,
        serviceMemory: 4e9,
      }));
      session.installFixture("profile", state, fixtureAction);
      // Wait for fixture ownership to settle, then measure the actual chosen view.
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      if (compare) {
        [...document.querySelectorAll("button")]
          .find((button) => button.textContent === "Compare all signals")
          ?.click();
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      }
      const plotCount = document.querySelectorAll(".time-series").length;
      const frames = [],
        begin = performance.now();
      let previous = begin,
        running = true;
      function frame(at) {
        frames.push(at - previous);
        previous = at;
        if (running) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      let ingested = 0;
      for (let i = 1; i <= 24; i++) {
        const capturedAt = new Date(start + i * 125).toISOString();
        session.receiveFixture({
          type: "server.event",
          serverId: state.serverId,
          agentKind: "PAPER",
          agentSession: "fixture-paper",
          eventType: "telemetry.server",
          body: {
            capturedAt,
            tps: [19.9, 20, 20],
            averageTickMillis: i % 5 ? 30 : 90,
            onlinePlayers: 24,
          },
        });
        ingested++;
        await new Promise((r) => setTimeout(r, 125));
      }
      running = false;
      frames.sort((a, b) => a - b);
      return {
        durationMs: performance.now() - begin,
        events: ingested,
        plotCount,
        retainedSamples: session.getSnapshot().state.history.length,
        domNodes: document.querySelectorAll("*").length,
        svgPathCharacters: [...document.querySelectorAll("svg path")].reduce(
          (n, p) => n + (p.getAttribute("d")?.length ?? 0),
          0,
        ),
        frames: frames.length,
        frameMedianMs: frames[Math.floor(frames.length * 0.5)],
        frameP95Ms: frames[Math.floor(frames.length * 0.95)],
        framesOver50ms: frames.filter((x) => x > 50).length,
      };
    }, compare);
    await page.goto(`http://127.0.0.1:${port}/?fixture=healthy#Console`);
    await page.locator(".terminal-scroll").waitFor();
    await page.evaluate(async () => {
      const { session } = await import("/src/adapter/session.ts"),
        { makeFixture, fixtureAction } =
          await import("/src/development/fixtures.ts");
      const state = makeFixture();
      state.console = Array.from({ length: 2500 }, (_, i) => ({
        id: `log-${i}`,
        capturedAt: new Date().toISOString(),
        level: "INFO",
        source: "HOST",
        content: `synthetic ${i}`,
      }));
      session.installFixture("console-profile", state, fixtureAction);
    });
    await page.waitForTimeout(300);
    metrics.consoleRenderedRows = await page.locator(".terminal-line").count();
    await page.getByRole("button", { name: "Wrap", exact: true }).click();
    metrics.consoleWrappedRows = await page.locator(".terminal-line").count();
    metrics.heapMeasurement =
      "Not available through Firefox performance.memory; no heap growth claim";
    reports.push({ name, ...metrics });
    await context.close();
  } finally {
    server.kill("SIGTERM");
  }
}
await browser.close();
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/browser-profile.json",
  JSON.stringify(
    {
      environment:
        "Headless Firefox, same container and sequential identical 8192-point / 24-event replay at 1440x900, development Vite builds; not hardware certification or live VPS soak",
      reports,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(reports, null, 2));
