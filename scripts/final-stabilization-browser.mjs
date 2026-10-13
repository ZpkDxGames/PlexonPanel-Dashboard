import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const base = "http://127.0.0.1:4227",
  out = "artifacts/stabilization";
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4227"],
  { stdio: "ignore" },
);
let browser;
const results = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  await mkdir(out, { recursive: true });
  browser = await chromium.launch({
    executablePath: process.env.PLEXON_CHROMIUM,
  });
  for (const reducedMotion of ["reduce", "no-preference"]) {
    const ctx = await browser.newContext({ reducedMotion });
    await ctx.route(/https:\/\/(crafatar|mc-heads|minotar)/, (route) =>
      route.abort(),
    );
    const p = await ctx.newPage();
    await p.clock.install();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    for (const [width, height] of [
      [320, 700],
      [375, 812],
      [768, 1024],
      [1366, 768],
      [1577, 929],
      [1920, 1080],
    ]) {
      await p.setViewportSize({ width, height });
      for (const route of [
        "Overview",
        "Console",
        "Performance",
        "Backups",
        "Players",
        "Access",
        "Settings",
        "Fleet",
      ]) {
        await p.goto(`${base}/?fixture=healthy#${route}`);
        await p.locator("h1").waitFor();
        await p.evaluate(() => document.fonts.ready);
        await p.waitForTimeout(150);
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${route} ${width}: overflow`,
        );
        if (route === "Overview")
          assert.match(
            await p.locator('[aria-label="Uptime"]').innerText(),
            /3/,
          );
        if (route === "Console") {
          assert.equal(
            await p
              .getByRole("button", { name: "Plugins", exact: true })
              .count(),
            0,
          );
          await p.getByRole("button", { name: "Chat", exact: true }).click();
          assert.equal(
            await p.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
            "Chat overflow",
          );
        }
        if (route === "Performance") {
          const panel = p.locator(".resource-panel").first();
          await panel
            .getByRole("button", { name: "Compare", exact: true })
            .click();
          for (const label of ["30s", "1min", "5min", "10min"])
            await p
              .getByRole("button", { name: label, exact: true })
              .first()
              .click();
          assert.ok(
            (await p.locator(".resource-plot path").count()) > 0,
            "real source geometry present",
          );
          const plot = panel.locator("svg");
          assert.equal(await plot.evaluate((svg) => svg.getBoundingClientRect().height), 235,
            "resource chart must not inherit icon height");
          await plot.evaluate((svg) => svg.scrollIntoView({ block: "center", behavior: "instant" }));
          // Complete layout/scroll before freezing the presentation clock.
          await plot.hover({ position: { x: 100, y: 50 } });
          // Hover may not touch paths or scale.
          await p.clock.pauseAt(new Date(await p.evaluate(() => Date.now()) + 100));
          await p.clock.runFor(32);
          const counters = await p.evaluate(() => [
            window.__resourceProjections,
            window.__resourceGeometry,
          ]);
          const before = await panel
            .locator("svg")
            .evaluate((svg) => ({
              paths: [...svg.querySelectorAll("path")].map((n) =>
                n.getAttribute("d"),
              ),
              labels: [...svg.querySelectorAll("text")].map(
                (n) => n.textContent,
              ),
            }));
          await plot.hover({ position: { x: 130, y: 80 } });
          const after = await panel
            .locator("svg")
            .evaluate((svg) => ({
              paths: [...svg.querySelectorAll("path")].map((n) =>
                n.getAttribute("d"),
              ),
              labels: [...svg.querySelectorAll("text")].map(
                (n) => n.textContent,
              ),
            }));
          assert.deepEqual(
            after,
            before,
            "hover must not change domain or geometry",
          );
          assert.deepEqual(
            await p.evaluate(() => [
              window.__resourceProjections,
              window.__resourceGeometry,
            ]),
            counters,
            "hover must not reproject history",
          );
          await p.clock.resume();
        }
        await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
        results.push({ route, width, height, reducedMotion, pass: true });
        if (
          reducedMotion === "reduce" &&
          [375, 1577].includes(width) &&
          ["Overview", "Performance", "Backups", "Console"].includes(route)
        )
          await p.screenshot({
            path: `${out}/${width}-${route}.png`,
            fullPage: true,
          });
      }
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log(
    `Stabilization browser passed: ${results.length} route/viewport/motion cases, Chat, uptime, source graphs and hover.`,
  );
} finally {
  await browser?.close();
  server.kill();
  await mkdir(out, { recursive: true });
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
}
