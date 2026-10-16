import { firefox } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const browser = await firefox.launch();
let reports = [];
await mkdir("artifacts",{recursive:true});
const option = (name, fallback) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? fallback;
const baseline = option("baseline", "../baseline"),
  candidate = option("candidate", "."),
  trials = Number(option("trials", "3"));
const output = option("output", "artifacts/browser-profile.json");
const progress = output.replace(/\.json$/, "-progress.json");
const sourceHeads = Object.fromEntries([["baseline", baseline], ["candidate", candidate]].map(([name, cwd]) => [name, execFileSync("git", ["rev-parse", "HEAD"], {cwd, encoding:"utf8"}).trim()]));
if (option("resume", "false") === "true") {
  const saved = JSON.parse(await readFile(progress, "utf8"));
  if (saved.browser !== browser.version() || JSON.stringify(saved.sourceHeads) !== JSON.stringify(sourceHeads)) throw Error("Resume source/browser identity differs");
  reports = saved.reports;
}
const mixed = option("mixed", "false") === "true", instrument = option("react-profile", "false") === "true", eventCount = Number(option("events", "24"));
const cases = [
  ["overview", false, "Overview"],
  ["focus", false, "Performance"],
  ["compare", true, "Performance"],
];
const activeCases = cases.filter(
  (row) => option("mode", "all") === "all" || row[0] === option("mode", "all"),
);
const selectedCases = Array.from({ length: trials }, (_, i) =>
  activeCases.flatMap(([name, compare, route]) => [
    [`baseline-${name}-run${i + 1}`, baseline, 4180, compare, route],
    [`candidate-${name}-run${i + 1}`, candidate, 4181, compare, route],
  ]),
).flat();
for (const [name, cwd, port, compare, route] of selectedCases) {
  if (reports.some(report => report.name === name)) continue;
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
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1") return route.abort("blockedbyclient");
      const ids = {"/src/App.tsx":"App", "/src/routes/Performance.tsx":"Performance", "/src/components/charts/TimeSeries.tsx":"TimeSeries"};
      if (instrument && ids[url.pathname] && !url.searchParams.has("render-original")) {
        const response = await route.fetch(), original = await response.text();
        const react = original.match(/["']([^"']*\/react\.js[^"']*)["']/)?.[1];
        if (!react) throw Error("Profiler could not resolve the actual React module URL");
        const source = url.pathname + "?render-original=1", id = ids[url.pathname];
        const importSource = id === "TimeSeries" ? `import {TimeSeries as Original} from ${JSON.stringify(source)}; export {CrosshairGroup} from ${JSON.stringify(source)};` : `import Original from ${JSON.stringify(source)};`;
        const declaration = id === "TimeSeries" ? "export function TimeSeries" : "export default function Profiled";
        const body = `import React from ${JSON.stringify(react)}; ${importSource} const record=(id,phase,actual,base,start,commit)=>{if(window.__collectRender) (window.__renderProfiles??=[]).push({id,phase,actual,base,start,commit});}; ${declaration}(props){return React.createElement(React.Profiler,{id:${JSON.stringify(id)},onRender:record},React.createElement(Original,props));}`;
        return route.fulfill({response,body,contentType:"application/javascript"});
      }
      return route.continue();
    });
    const page = await context.newPage();
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    try {
      await page.goto(`http://127.0.0.1:${port}/?fixture=healthy#${route}`, {
        waitUntil: "domcontentloaded",
      });
    } catch (error) {
      if (!String(error).includes("interrupted by another navigation"))
        throw error;
    }
    await page.waitForLoadState("networkidle");
    try{await page.locator(".workspace-heading h1").waitFor();}catch(error){
      await page.screenshot({path:"artifacts/profile-navigation-failure.png",fullPage:true});
      await writeFile("artifacts/profile-navigation-failure.json",JSON.stringify({name,cwd,url:page.url(),errors,body:await page.locator("body").innerText()},null,2));throw error;
    }
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
    await page.bringToFront();
    await page.waitForFunction(()=>document.visibilityState === "visible");
    const metrics = await page.evaluate(async ({compare, mixed, eventCount, instrument}) => {
      const { session } = await import("/src/adapter/session.ts"),
        { makeFixture, fixtureAction } = await import(
          "/src/development/fixtures.ts"
        );
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
      const visibilityAtStart={visibility:document.visibilityState,focused:document.hasFocus()};
      let hiddenFrames=0;
      const frames = [],
        begin = performance.now();
      let previous = begin,
        running = true;
      function frame(at) {
        if(document.hidden)hiddenFrames++;
        frames.push(at - previous);
        previous = at;
        if (running) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      window.__renderProfiles = []; window.__collectRender = instrument;
      let ingested = 0;
      for (let i = 1; i <= eventCount; i++) {
        const capturedAt = new Date(mixed ? Date.now() : start + i * 125).toISOString();
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
        if (mixed && i % 4 === 0) {
          for (const [kind,eventType,body] of [
            ["PAPER","telemetry.system",{capturedAt,processCpuPercent:40,jvmHeapUsedBytes:3e9,gcCollectionTimeMillis:i}],
            ["HOST","telemetry.system",{capturedAt,hostCpuPercent:25,physicalMemoryUsedBytes:8e9}],
            ["HOST","console.lines",{lines:[{streamSession:"render-profile",sourceSequence:i,capturedAt,content:`Diagnostic ${i}`,level:"INFO"}]}]
          ]) session.receiveFixture({type:"server.event",serverId:state.serverId,agentKind:kind,agentSession:kind==="PAPER"?"fixture-paper":"fixture-host",eventType,body});
        }
        ingested++;
        await new Promise((r) => setTimeout(r, 125));
      }
      running = false; window.__collectRender = false;
      const renderProfiles = window.__renderProfiles;
      frames.sort((a, b) => a - b);
      return {
        durationMs: performance.now() - begin,
        visibilityAtStart,hiddenFrames,visibilityAtEnd:document.visibilityState,
        events: ingested,
        renderProfiles,
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
    }, {compare, mixed, eventCount, instrument});
    await page.goto(`http://127.0.0.1:${port}/?fixture=healthy#Console`);
    await page.locator(".terminal-scroll").waitFor();
    await page.evaluate(async () => {
      const { session } = await import("/src/adapter/session.ts"),
        { makeFixture, fixtureAction } = await import(
          "/src/development/fixtures.ts"
        );
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
    if (metrics.plotCount !== (compare ? 8 : route === "Overview" ? 2 : 1))
      throw Error("Unexpected mounted plot count");
    reports.push({ name, ...metrics });
    console.log(
      JSON.stringify({
        name,
        p95: metrics.frameP95Ms,
        plots: metrics.plotCount,
      }),
    );
    await writeFile(
      progress,
      JSON.stringify({ browser: browser.version(), sourceHeads, reports }, null, 2),
    );
    await context.close();
  } finally {
    server.kill("SIGTERM");
  }
}
await browser.close();
await mkdir("artifacts", { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    {
      browser: browser.version(),
      sourceHeads,
      diagnostics: {mixed, instrumentedReactProfiler:instrument, eventCount},
      environment:
        "Headless Firefox, same container and sequential identical 8192-point / 24-event replay at 1440x900, development Vite builds; not hardware certification or live VPS soak",
      reports,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(reports, null, 2));
