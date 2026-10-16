import { firefox, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim();
const base = "http://127.0.0.1:4173", browser = await firefox.launch();
const routes = ["Fleet","Overview","Performance","Players","Console","Backups","Access","Settings"];
const sizes = [[320,800],[390,844],[640,960],[820,1180],[1024,768],[1440,900],[1920,1080]];
const results = [], errors = [];
await mkdir("artifacts/nextgen/screenshots", {recursive:true});
try {
  for (const theme of ["dark","light"]) {
    const context = await browser.newContext({viewport:{width:1440,height:900},reducedMotion:"reduce"});
    await context.route("**/*", r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
    await context.addInitScript(theme => localStorage.setItem("plexon:preferences", JSON.stringify({theme,motion:"off",skinProvider:"disabled"})),theme);
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(`${base}/?fixture=healthy#Overview`);
    await page.locator(".overview-grid").waitFor();
    await page.clock.setFixedTime(new Date("2026-10-16T18:00:00Z"));
    for (const [width,height,large] of [...sizes,[320,800,true]]) {
      await page.setViewportSize({width,height});
      for (const route of routes) {
        await page.evaluate(async ({route,theme,large}) => {
          const {session} = await import("/src/adapter/session.ts");
          const {makeFixture,fixtureAction} = await import("/src/development/fixtures.ts");
          const {preferences} = await import("/src/store/preferences.ts");
          preferences.update({theme,motion:"off",skinProvider:"disabled",density:large?"spacious":"comfortable",textSize:large?"large":"standard"});
          location.hash = route;
          session.installFixture("width-certification",makeFixture("healthy"),fixtureAction);
        },{route,theme,large:!!large});
        await page.locator(".route-skeleton").waitFor({state:"detached"});
        await expect(page.locator(".workspace-heading h1")).toHaveText(route === "Console" ? "Console & chat" : route === "Access" ? "Access & audit" : route);
        if (route === "Backups") await expect(page.locator(".job-book")).toContainText("DEGRADED");
        await page.evaluate(async () => {await document.fonts.ready;window.scrollTo(0,0);});
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        const violations = (await new AxeBuilder({page}).analyze()).violations.map(v => ({id:v.id,nodes:v.nodes.map(n=>n.target)}));
        const name = route.toLowerCase();
        if (!large && ([390,1440].includes(width) || width === 820 && theme === "light")) {
          await page.screenshot({path:`artifacts/nextgen/screenshots/${name}-${width}-${theme}.png`,fullPage:true});
          await page.screenshot({path:`artifacts/nextgen/screenshots/${name}-${width}-${theme}-viewport.png`});
        }
        const originalHash = await page.evaluate(() => location.hash);
        await page.getByRole("link",{name:"Skip to workspace",exact:true}).focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("#main-content")).toBeFocused();
        expect(await page.evaluate(() => location.hash)).toBe(originalHash);
        await page.evaluate(() => document.activeElement?.blur());
        let retryBottom = null;
        if (route === "Backups" && width === 390 && !large) {
          const rect = await page.getByRole("button",{name:"Review upload retry",exact:true}).boundingBox();
          retryBottom = rect.y + rect.height;
          expect(retryBottom).toBeLessThanOrEqual(height);
        }
        results.push({route,width,height,theme,actualTheme:await page.locator("html").getAttribute("data-theme"),density:large?"spacious":"comfortable",text:large?"large":"standard",motion:"off",zoom:"100%",fixture:"healthy synthetic localhost",sourceHead,browser:browser.version(),capturedAt:new Date().toISOString(),overflow,violations,skipFocusAndHashPreserved:true,retryBottom});
        expect(overflow).toBe(false);
        expect(violations).toEqual([]);
      }
      console.log(JSON.stringify({theme,width,height,large:!!large,cases:results.length}));
    }
    await context.close();
  }
  expect(errors).toEqual([]);
} finally {
  await writeFile("artifacts/nextgen/widths-final.json",JSON.stringify({sourceHead,browser:browser.version(),results,errors},null,2));
  await browser.close();
}
console.log(JSON.stringify({cases:results.length,errors}));
