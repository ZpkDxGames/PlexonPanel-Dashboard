import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { harness } from "./v5-harness.mjs";
import { makeFixture } from "../src/development/fixtures.ts";
import { ACTION_CONTRACT_ID } from "../src/adapter/scopes.ts";
const fixture = makeFixture(),
  remote = "https://tonimserver.ddns.net",
  serverId = fixture.serverId,
  device = fixture.ready.device,
  expiresAt = new Date(Date.now() + 600000).toISOString();
await harness(
  async ({ browser, origin, output }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1") return route.continue();
      if (u.origin === remote && u.pathname === "/v1/pairings/claim")
        return route.fulfill({
          json: {
            ok: true,
            protocolVersion: 3,
            serverId,
            deviceId: device.deviceId,
            name: device.name,
            role: device.role,
            scopes: device.scopes,
            accessToken: "synthetic-intercept-only",
            websocketUrl: "wss://tonimserver.ddns.net/v1/dashboard",
            expiresAt,
            fingerprint: "synthetic",
          },
        });
      if (u.origin === remote && u.pathname === "/v1/dashboard/session")
        return route.fulfill({
          json: {
            ok: true,
            protocolVersion: 3,
            actionContract: ACTION_CONTRACT_ID,
            serverId,
            deviceId: device.deviceId,
            role: device.role,
            scopes: device.scopes,
            expiresAt,
          },
        });
      return route.abort();
    });
    await context.routeWebSocket(
      "wss://tonimserver.ddns.net/v1/dashboard",
      (ws) => {
        ws.send(JSON.stringify({ ...fixture.ready, type: "dashboard.ready" }));
        ws.onMessage((raw) => {
          const m = JSON.parse(raw);
          if (m.type === "dashboard.action")
            ws.send(
              JSON.stringify({
                type: "server.event",
                serverId,
                agentKind: m.agentKind,
                agentSession:
                  m.agentKind === "HOST" ? "fixture-host" : "fixture-paper",
                eventType: "action.result",
                body: {
                  requestId: m.requestId,
                  action: m.action,
                  status: "SUCCESS",
                  code: "OK",
                  message: "Intercepted contract read",
                  data: {
                    bootEpochId: "a".repeat(32),
                    lines: [],
                    messages: [],
                    events: [],
                    hasMore: false,
                  },
                },
              }),
            );
        });
      },
    );
    // Test-installed transport wrapper, never a production application hook.
    await context.addInitScript(() => {
      localStorage.setItem(
        "plexon:preferences",
        JSON.stringify({ skinProvider: "disabled", motion: "reduced" }),
      );
      const Native = window.WebSocket;
      window.WebSocket = class extends Native {
        constructor(...args) {
          super(...args);
          window.__CONTRACT_SOCKET__ = this;
        }
      };
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${origin}/performance`);
    await page
      .getByLabel("Device name", { exact: true })
      .fill("Production benchmark");
    await page
      .getByLabel("Pairing code", { exact: true })
      .fill("synthetic-code");
    await page
      .getByRole("button", { name: "Connect server", exact: true })
      .click();
    await page.locator("#workspace").waitFor();
    await page.waitForFunction(
      () =>
        window.__CONTRACT_SOCKET__?.readyState === 1 &&
        document.querySelector("#workspace"),
    );
    await page.evaluate(
      ({ fixture }) => {
        const socket = window.__CONTRACT_SOCKET__,
          send = (eventType, body, agentKind) =>
            socket.dispatchEvent(
              new MessageEvent("message", {
                data: JSON.stringify({
                  type: "server.event",
                  serverId: fixture.serverId,
                  agentKind,
                  agentSession:
                    agentKind === "HOST" ? "fixture-host" : "fixture-paper",
                  eventType,
                  body,
                }),
              }),
            );
        const now = Date.now(),
          epoch = {
            bootEpochId: "a".repeat(32),
            bootStartedAt: new Date(now - 3 * 3600000).toISOString(),
          };
        const emit = (at, i) => {
          const capturedAt = new Date(at).toISOString();
          send(
            "telemetry.server",
            {
              ...fixture.server,
              capturedAt,
              sourceIntervalMillis: 250,
              averageTickMillis: 30 + Math.sin(i / 20) * 5,
              msptP95: 40 + Math.sin(i / 20) * 6,
              msptP99: 46 + Math.sin(i / 20) * 7,
            },
            "PAPER",
          );
          send(
            "telemetry.system",
            { ...fixture.hostSystem, capturedAt, sourceIntervalMillis: 250 },
            "HOST",
          );
          if (i % 4 === 0) {
            send(
              "telemetry.system",
              { ...fixture.system, capturedAt, sourceIntervalMillis: 1000 },
              "PAPER",
            );
            send(
              "service.status",
              {
                ...fixture.service,
                ...epoch,
                sourceIntervalMillis: 1000,
                resources: { ...fixture.service.resources, capturedAt },
              },
              "HOST",
            );
          }
        };
        send(
          "service.status",
          {
            ...fixture.service,
            ...epoch,
            resources: {
              ...fixture.service.resources,
              capturedAt: new Date(now - 35 * 60000).toISOString(),
            },
          },
          "HOST",
        );
        for (let i = 0; i < 8192; i++) emit(now - (8191 - i) * 250, i);
        for (let offset = 0; offset < 2500; offset += 100)
          send(
            "console.lines",
            {
              lines: Array.from({ length: 100 }, (_, i) => ({
                capturedAt: new Date(
                  now - (2500 - offset - i) * 50,
                ).toISOString(),
                level: "INFO",
                content: `Production workload line ${offset + i}`,
                source: "HOST_JOURNAL",
                invocationId: epoch.bootEpochId,
                journalCursor: `contract:${offset + i}`,
                streamSession: "production-load",
                sourceSequence: offset + i,
              })),
            },
            "HOST",
          );
        let i = 0;
        window.__CONTRACT_TICK__ = setInterval(
          () => emit(Date.now(), i++),
          250,
        );
      },
      { fixture },
    );
    await page.getByLabel("Performance time range").selectOption("35");
    await page.waitForTimeout(1800);
    assert.equal(
      await page.locator("[data-testid=telemetry-chart]").count(),
      8,
    );
    await page.evaluate(() => {
      window.__MEASURE__ = { frames: [], long: [] };
      let previous = performance.now();
      const frame = (now) => {
        window.__MEASURE__.frames.push(now - previous);
        previous = now;
        window.__MEASURE__.raf = requestAnimationFrame(frame);
      };
      window.__MEASURE__.raf = requestAnimationFrame(frame);
      window.__MEASURE__.observer = new PerformanceObserver((list) =>
        window.__MEASURE__.long.push(
          ...list.getEntries().map((e) => e.duration),
        ),
      );
      window.__MEASURE__.observer.observe({
        type: "longtask",
        buffered: false,
      });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    if (process.env.PLEXON_PROFILE) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
      await cdp.send("Profiler.start");
    }
    const task = async () => {
      const { metrics } = await cdp.send("Performance.getMetrics");
      return metrics.find((m) => m.name === "TaskDuration").value * 1000;
    };
    let previous = await task();
    const samples = [];
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 125));
      const now = await task();
      samples.push(now - previous);
      previous = now;
    }
    // Measure actual display-frame work separately from the aggregate 125 ms utilization windows.
    const frameWork = [];
    let priorFrameTask = await task();
    for (let i = 0; i < 240; i++) {
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const currentTask = await task();
      frameWork.push(currentTask - priorFrameTask);
      priorFrameTask = currentTask;
    }
    if (process.env.PLEXON_PROFILE) {
      const profile = await cdp.send("Profiler.stop");
      writeFileSync(`${output}/cpu-profile.json`, JSON.stringify(profile));
    }
    const measures = await page.evaluate(() => {
      cancelAnimationFrame(window.__MEASURE__.raf);
      window.__MEASURE__.observer.disconnect();
      return {
        frames: window.__MEASURE__.frames,
        long: window.__MEASURE__.long,
      };
    });
    const p95 = (values) =>
      [...values].sort((a, b) => a - b)[
        Math.max(0, Math.ceil(values.length * 0.95) - 1)
      ];
    const result = {
      scope:
        "Next production build, all relay traffic intercepted. 8192 populated 250 ms captures, 35-minute horizon, 8 Recharts SVG tracks; 4 Hz Paper/Host and 1 Hz service/JVM. No live relay access.",
      profiling: Boolean(process.env.PLEXON_PROFILE),
      taskWindows: samples.length,
      windowMs: 125,
      mainThreadWorkP95Ms: p95(samples),
      mainThreadWorkMaxMs: Math.max(...samples),
      animationFrameP95Ms: p95(measures.frames),
      longTasksOver50ms: measures.long,
      pageErrors: errors,
      displayFramesMeasured: frameWork.length,
      mainThreadWorkPerFrameP95Ms: p95(frameWork),
      mainThreadWorkPerFrameMaxMs: Math.max(...frameWork),
      mainThreadBudgetUnder16ms: p95(frameWork) < 16,
    };
    await page.screenshot({
      path: `${output}/performance-desktop.png`,
      fullPage: true,
    });
    await page.locator('aside[aria-label=Sidebar] a[href="/console"]').click();
    await page.locator("[data-testid=virtual-console]").waitFor();
    await page.waitForTimeout(500);
    result.virtualConsoleDomRows = await page.locator("[data-log-row]").count();
    writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    assert(
      result.virtualConsoleDomRows > 0 && result.virtualConsoleDomRows < 100,
    );
    assert.deepEqual(errors, []);
    assert(result.mainThreadBudgetUnder16ms);
    assert(result.animationFrameP95Ms <= 20);
    assert.deepEqual(result.longTasksOver50ms, []);
    await context.close();
  },
  {
    tag: "v5-production-performance",
    port: 4312,
    production: true,
    env: { NEXT_PUBLIC_PLEXON_RELAY_URL: remote },
  },
);
