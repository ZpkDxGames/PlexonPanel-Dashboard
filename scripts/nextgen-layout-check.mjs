import { firefox, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4173",
  b = await firefox.launch(),
  c = await b.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
await c.route("**/*", (r) =>
  new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
);
await c.addInitScript(() =>
  localStorage.setItem(
    "plexon:preferences",
    JSON.stringify({ motion: "off", skinProvider: "disabled" }),
  ),
);
const p = await c.newPage(),
  results = [];
await p.goto(`${base}/?fixture=healthy#Overview`);
await p.locator(".overview-grid").waitFor();
await p.evaluate(() => document.fonts.ready);
let r = await p.locator(".usage-panel .time-series").boundingBox();
results.push({ name: "overview-plot", bottom: r.y + r.height });
await p.evaluate(() => (location.hash = "Console"));
await p.locator(".command-composer").waitFor();
r = await p.locator(".command-composer").boundingBox();
results.push({ name: "console-composer", bottom: r.y + r.height });
await p.setViewportSize({ width: 320, height: 844 });
await p.evaluate(async () => {
  const { preferences } = await import("/src/store/preferences.ts");
  preferences.update({
    theme: "light",
    density: "spacious",
    textSize: "large",
  });
  location.hash = "Performance";
});
await p.locator(".analysis-focus").waitFor();
await p.waitForTimeout(150);
const overflow = await p.evaluate(
  () => document.documentElement.scrollWidth > innerWidth,
);
results.push({ name: "performance-320-large", overflow });
const details = await p.evaluate(() =>
  [...document.querySelectorAll("*")]
    .map((el) => ({
      tag: el.tagName,
      cls: el.className?.baseVal ?? el.className,
      right: el.getBoundingClientRect().right,
      width: el.getBoundingClientRect().width,
      text: el.textContent?.slice(0, 80),
    }))
    .filter((x) => x.right > innerWidth + 0.5)
    .slice(-30),
);
results.push({ details });
await p.screenshot({
  path: "artifacts/nextgen/performance-320-debug.png",
  fullPage: true,
});
await p.setViewportSize({ width: 390, height: 844 });
await p.evaluate(() => (location.hash = "Console"));
await p.locator(".console-filters").waitFor();
await expect(p.locator(".console-filters")).not.toHaveAttribute("open");
await p.locator(".console-filters summary").click();
await expect(p.getByLabel("Level filter")).toBeVisible();
results.push({ name: "console-mobile-disclosure", passed: true });
const failures = results.filter(
  (r) => (r.bottom !== undefined && r.bottom > 900) || r.overflow,
);
expect(failures).toEqual([]);
await b.close();
await mkdir("artifacts/nextgen", { recursive: true });
await writeFile(
  "artifacts/nextgen/layout.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
