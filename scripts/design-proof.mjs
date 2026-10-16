import { firefox } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await firefox.launch();
await mkdir("artifacts/design-proof", { recursive: true });
const results = [];
for (const theme of ["dark", "light"])
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      reducedMotion: "reduce",
    });
    await context.route("**/*", (r) =>
      new URL(r.request().url()).origin === "http://127.0.0.1:4173"
        ? r.continue()
        : r.abort(),
    );
    await context.addInitScript(
      (p) => localStorage.setItem("plexon:preferences", JSON.stringify(p)),
      { theme, motion: "off", skinProvider: "disabled" },
    );
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/?fixture=healthy#Overview");
    await page.locator(".overview-grid").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `artifacts/design-proof/overview-${width}-${theme}.png`,
      fullPage: true,
    });
    results.push({
      theme,
      width,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
    await context.close();
  }
await browser.close();
await writeFile(
  "artifacts/design-proof/results.json",
  JSON.stringify(results, null, 2),
);
console.log(results);
