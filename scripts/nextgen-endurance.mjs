import { firefox, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
const option = (n, d) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const seconds = Number(option("seconds", "600")),
  steady = Number(option("steady", "60")),
  baseline = resolve(option("baseline", "../baseline")),
  candidate = resolve(option("candidate", "."));
const sourceHeads = Object.fromEntries([["baseline", baseline], ["candidate", candidate]].map(([name, cwd]) => [name, execFileSync("git", ["rev-parse", "HEAD"], {cwd, encoding:"utf8"}).trim()]));
const output = option("output", "artifacts/nextgen/endurance.json");
const browser = await firefox.launch(),
  reports = [];
await mkdir("artifacts/nextgen", { recursive: true });
for (const [label, cwd, port] of [
  ["baseline", baseline, 4182],
  ["candidate", candidate, 4183],
]) {
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    { cwd, stdio: "ignore" },
  );
  try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
      try {
        await fetch(`http://127.0.0.1:${port}`);
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!ready) throw Error("No local server");
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await context.route("**/*", (r) =>
      new URL(r.request().url()).origin === `http://127.0.0.1:${port}`
        ? r.continue()
        : r.abort(),
    );
    await context.addInitScript(() =>
      localStorage.setItem(
        "plexon:preferences",
        JSON.stringify({ motion: "off", skinProvider: "disabled" }),
      ),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.text().startsWith("ENDURANCE "))
        console.log(label + " " + m.text());
    });
    await page.goto(`http://127.0.0.1:${port}/?fixture=healthy#Performance`);
    await page.locator(".analysis-focus").waitFor();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === "visible");
    const result = await page.evaluate(
      async ({ seconds, steady }) => {
        const { session } = await import("/src/adapter/session.ts"),
          { makeFixture, fixtureAction } = await import(
            "/src/development/fixtures.ts"
          );
        const start = Date.now(),
          state = makeFixture("healthy", start);
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
          serviceCpu: 150,
          serviceMemory: 4e9,
          sources: {
            paperHealth: start - (8191 - i) * 250,
            paperSystem: start - (8191 - i) * 250,
            hostSystem: start - (8191 - i) * 250,
            service: start - (8191 - i) * 250,
          },
        }));
        state.console = Array.from({ length: 2500 }, (_, i) => ({
          id: `seed-${i}`,
          capturedAt: new Date(start).toISOString(),
          level: "INFO",
          source: "HOST",
          content: `Bounded seed ${i}`,
        }));
        session.installFixture("endurance", state, fixtureAction);
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const frames = [],
          boundChecks = [],
          targetSwitches = [],
          begin = performance.now();
        let last = begin,
          running = true,
          events = 0;
        function frame(at) {
          if (at - begin < steady * 1000) frames.push(at - last);
          last = at;
          if (running) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        let cls = null;
        if (PerformanceObserver.supportedEntryTypes?.includes("layout-shift")) {
          cls = 0;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries())
              if (!e.hadRecentInput) cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
        }
        const until = begin + seconds * 1000;
        while (performance.now() < until) {
          const at = Date.now(),
            capturedAt = new Date(at).toISOString(),
            s = session.getSnapshot().state;
          const send = (kind, eventType, body) =>
            session.receiveFixture({
              type: "server.event",
              serverId: s.serverId,
              agentKind: kind,
              agentSession: kind === "PAPER" ? "fixture-paper" : "fixture-host",
              eventType,
              body,
            });
          send("PAPER", "telemetry.server", {
            capturedAt,
            tps: [events % 499 === 0 ? 8 : 19.9, 20, 20],
            averageTickMillis: events % 499 === 0 ? 90 : 30,
            onlinePlayers: 24,
          });
          if (events % 4 === 0) {
            send("PAPER", "telemetry.system", {
              capturedAt,
              processCpuPercent: 40,
              jvmHeapUsedBytes: 3e9,
              gcCollectionTimeMillis: events,
            });
            send("HOST", "telemetry.system", {
              capturedAt,
              hostCpuPercent: 25,
              physicalMemoryUsedBytes: 8e9,
            });
            send("HOST", "console.lines", {
              lines: [
                {
                  streamSession: "endurance-journal",
                  sourceSequence: events,
                  capturedAt,
                  content: `Bounded event ${events}`,
                  level: "INFO",
                },
              ],
            });
          }
          events++;
          if (events % 480 === 0)
            console.log(
              "ENDURANCE " +
                JSON.stringify({
                  events,
                  elapsedMs: performance.now() - begin,
                  history: session.getSnapshot().state.history.length,
                  console: session.getSnapshot().state.console.length,
                }),
            );
          if (events % 960 === 0) {
            const start = Date.now(),
              next = makeFixture("healthy", start);
            next.serverId = `00000000-0000-4000-8000-${String(events).padStart(12, "0")}`;
            next.ready.serverId = next.serverId;
            next.ready.server.serverName = `Endurance target ${events}`;
            next.history = Array.from({ length: 8192 }, (_, i) => ({
              at: start - (8191 - i) * 250,
              tps: i % 499 === 0 ? 8 : 19.9,
              mspt: i % 499 === 0 ? 90 : 30,
              hostCpu: 25,
              processCpu: 40,
              heap: 3e9,
              memory: 8e9,
              players: 24,
              gc: i,
              serviceCpu: 150,
              serviceMemory: 4e9,
              sources: {
                paperHealth: start - (8191 - i) * 250,
                paperSystem: start - (8191 - i) * 250,
                hostSystem: start - (8191 - i) * 250,
                service: start - (8191 - i) * 250,
              },
            }));
            next.console = Array.from({ length: 2500 }, (_, i) => ({
              id: `seed-${i}`,
              capturedAt: new Date(start).toISOString(),
              level: "INFO",
              source: "HOST",
              content: `Bounded seed ${i}`,
            }));
            session.installFixture("endurance-switch", next, fixtureAction);
            targetSwitches.push({serverId:next.serverId,elapsedMs:performance.now()-begin});
          }
          if (performance.now() - begin >= steady * 1000 && events % 240 === 0) {
            location.hash = events % 480 === 0 ? "Performance" : "Console";
            await new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            );
            const current = session.getSnapshot().state;
            boundChecks.push({
              elapsedMs: performance.now() - begin,
              history: current.history.length,
              console: current.console.length,
              players: current.players.length,
              worlds: current.worlds.length,
              domNodes: document.querySelectorAll("*").length,
              rows: document.querySelectorAll(".terminal-line").length,
              viewportHeight: document.querySelector(".terminal-scroll")?.clientHeight ?? 0,
              measuredRowHeight: document.querySelector(".terminal-ruler")?.getBoundingClientRect().height ?? 0,
            });
          }
          await new Promise((r) => setTimeout(r, 125));
        }
        running = false;
        frames.sort((a, b) => a - b);
        const s = session.getSnapshot().state,
          final = {
            history: s.history.length,
            console: s.console.length,
            players: s.players.length,
            worlds: s.worlds.length,
          };
        location.hash = "Settings";
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const afterTeardown = {
          charts: document.querySelectorAll(".time-series").length,
          terminal: document.querySelectorAll(".terminal-scroll").length,
          domNodes: document.querySelectorAll("*").length,
        };
        session.close();
        return {
          elapsedMs: performance.now() - begin,
          steadySeconds: steady,
          targetSwitches,
          visibleAtEnd: document.visibilityState,
          events,
          frameMedianMs: frames[Math.floor(frames.length * 0.5)],
          frameP95Ms: frames[Math.floor(frames.length * 0.95)],
          boundChecks,
          final,
          afterTeardown,
          cls,
          heap: "Firefox performance.memory unsupported; no heap-growth claim",
        };
      },
      { seconds, steady },
    );
    expect(result.elapsedMs).toBeGreaterThanOrEqual(seconds * 1000);
    for (const row of [...result.boundChecks, result.final]) {
      expect(row.history).toBeLessThanOrEqual(8192);
      expect(row.console).toBeLessThanOrEqual(2500);
      expect(row.players).toBeLessThanOrEqual(512);
      expect(row.worlds).toBeLessThanOrEqual(64);
    }
    for (const row of result.boundChecks) {
      if (row.rows) expect(row.rows).toBeLessThanOrEqual(Math.ceil(row.viewportHeight / row.measuredRowHeight) + 16);
    }
    expect(result.visibleAtEnd).toBe("visible");
    expect(result.targetSwitches.length).toBeGreaterThanOrEqual(Math.floor(result.events / 960));
    expect(result.afterTeardown.charts).toBe(0);
    expect(result.afterTeardown.terminal).toBe(0);
    expect(errors).toEqual([]);
    reports.push({ label, cwd, port, ...result, errors });
    await writeFile(
      output,
      JSON.stringify(
        {
          browser: browser.version(),
          sourceHeads,
          workload:
            "2500 console / 8192 raw points, continuous 125ms Paper frames; Host/system/console every fourth frame; route switches after first 60 seconds; sequential same-machine runs",
          reports,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        label,
        elapsedMs: result.elapsedMs,
        final: result.final,
        p95: result.frameP95Ms,
      }),
    );
    await context.close();
  } finally {
    server.kill("SIGTERM");
  }
}
await browser.close();
