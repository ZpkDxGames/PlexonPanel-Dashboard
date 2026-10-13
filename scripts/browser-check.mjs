import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://127.0.0.1:4173";
await mkdir("artifacts/browser", { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
for (const viewport of [{ name:"desktop", width:1440, height:1000 }, { name:"phone", width:390, height:844 }]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.route(/https:\/\/(crafatar|mc-heads|minotar)/, (route) => route.fulfill({
    contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><path fill="#b88753" d="M0 0h64v64H0z"/></svg>'
  }));
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of ["Overview","Performance","Players","Console","Backups","Access","Settings"]) {
    await page.goto(`${base}/?fixture=healthy#${route}`, { waitUntil:"networkidle" });
    await page.locator("h1").waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const axe = await new AxeBuilder({ page }).analyze();
    await page.screenshot({ path:`artifacts/browser/${viewport.name}-${route.toLowerCase()}.png`, fullPage:true });
    results.push({ viewport:viewport.name, route, overflow, violations:axe.violations.map((v)=>({id:v.id,impact:v.impact,nodes:v.nodes.length})) });
  }
  results.push({ viewport:viewport.name, consoleErrors:errors });
  await context.close();
}
await browser.close();
await writeFile("artifacts/browser-results.json", JSON.stringify({base,createdAt:new Date().toISOString(),results},null,2));
const failures = results.filter((result) => result.overflow || result.violations?.length || result.consoleErrors?.length);
if (failures.length) { console.error(JSON.stringify(failures,null,2)); process.exitCode=1; }
else console.log("Browser checks passed: 14 route/viewport cases, zero axe violations, no document overflow or console errors.");
