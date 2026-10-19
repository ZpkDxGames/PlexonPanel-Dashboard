import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const out = process.env.EVIDENCE_DIR ?? "artifacts/v5",
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "-H",
      "127.0.0.1",
      "-p",
      "4178",
    ],
    { stdio: "ignore" },
  );
let browser;
const receipts = [];
const baseZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const cases = [
  {
    name: "mobile-dark",
    width: 390,
    height: 844,
    theme: "dark",
    zone: baseZone,
    pref: "browser",
  },
  {
    name: "desktop-light",
    width: 1440,
    height: 900,
    theme: "light",
    zone: baseZone,
    pref: "browser",
  },
  {
    name: "laptop-dark",
    width: 1280,
    height: 800,
    theme: "dark",
    zone: baseZone,
    pref: "browser",
  },
  {
    name: "desktop-dark",
    width: 1440,
    height: 900,
    theme: "dark",
    zone: baseZone,
    pref: "browser",
  },
  {
    name: "timezone-browser-utc",
    width: 1440,
    height: 900,
    theme: "dark",
    zone: "UTC",
    pref: "browser",
  },
  {
    name: "timezone-utc-override",
    width: 1440,
    height: 900,
    theme: "dark",
    zone: "America/Sao_Paulo",
    pref: "UTC",
  },
];
try {
  for (let i = 0; i < 200; i++) {
    try {
      await fetch("http://127.0.0.1:4178");
      break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? chromium.executablePath(),
    args: ["--no-sandbox"],
  });
  for (const x of cases) {
    const c = await browser.newContext({
      viewport: { width: x.width, height: x.height },
      timezoneId: x.zone,
    });
    await c.addInitScript(
      (x) =>
        localStorage.setItem(
          "plexon:preferences",
          JSON.stringify({
            theme: x.theme,
            timezone: x.pref,
            skinProvider: "disabled",
          }),
        ),
      x,
    );
    const p = await c.newPage();
    await p.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:4178/console?fixture=healthy");
    const time = p.locator("time[datetime]").first();
    await time.waitFor();
    const raw = await time.getAttribute("datetime"),
      expected = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: x.pref === "UTC" ? "UTC" : x.zone,
      }).format(new Date(raw));
    assert.equal(await time.innerText(), expected);
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    const axe = (await new AxeBuilder({ page: p }).analyze()).violations
      .filter((v) => ["serious", "critical"].includes(v.impact))
      .map((v) => v.id);
    assert.deepEqual(axe, []);
    assert.deepEqual(errors, []);
    await p.screenshot({
      path: x.name.startsWith("timezone")
        ? `${out}/states/${x.name}.png`
        : `${out}/after/${x.name}-console.png`,
      fullPage: true,
      animations: "disabled",
      timeout: 60000,
    });
    receipts.push({
      ...x,
      expected,
      actual: await time.innerText(),
      axe,
      errors,
    });
    console.log(JSON.stringify(receipts.at(-1)));
    await c.close();
  }
  await fs.writeFile(
    `${out}/timezone-receipts.json`,
    JSON.stringify(receipts, null, 2),
  );
  console.log("PASS: six console/chat timezone and viewport cases");
} finally {
  await browser?.close();
  server.kill();
}
