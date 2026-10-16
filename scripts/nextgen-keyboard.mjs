import { firefox, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const sourceHead = execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const base="http://127.0.0.1:4173", browser=await firefox.launch(), results=[], errors=[];
await mkdir("artifacts/nextgen/screenshots",{recursive:true});
try {
  for (const theme of ["dark","light"]) for (const width of [1440,390]) {
    const c=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:"reduce"});
    await c.route("**/*",r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
    await c.addInitScript(theme=>localStorage.setItem("plexon:preferences",JSON.stringify({theme,motion:"off",skinProvider:"disabled"})),theme);
    const p=await c.newPage();p.on("pageerror",e=>errors.push(e.message));
    await p.goto(`${base}/?fixture=healthy#Players`);
    await p.locator(".player-row").first().click();
    async function capture(name) {
      if (name === "access") await p.evaluate(()=>window.scrollTo(0,0));
      await p.evaluate(()=>document.fonts.ready);
      const violations=(await new AxeBuilder({page:p}).analyze()).violations.map(v=>v.id);
      expect(violations).toEqual([]);
      await p.screenshot({path:`artifacts/nextgen/screenshots/${name}-${width}-${theme}.png`,fullPage:true});
      await p.screenshot({path:`artifacts/nextgen/screenshots/${name}-${width}-${theme}-viewport.png`});
      return violations;
    }
    const tools=p.getByRole("group",{name:"Player tools",exact:true});
    await tools.getByRole("button",{name:"Interact",exact:true}).focus();
    for (const [key,label,name] of [["ArrowRight","Moderate","moderate"],["End","Commands","commands"],["Home","Interact","interact"],["ArrowLeft","Commands",null]]) {
      await p.keyboard.press(key);
      const selected=tools.getByRole("button",{name:label,exact:true});
      await expect(selected).toBeFocused();await expect(selected).toHaveAttribute("aria-pressed","true");
      if(name) await capture(`profile-${name}`);
    }
    results.push({name:"player-tools-arrow-home-end",width,theme,passed:true});
    await p.evaluate(()=>location.hash="Access");
    await p.getByRole("group",{name:"Access views",exact:true}).waitFor();
    await expect(p.locator(".audit-workspace tbody")).toContainText("maintenance.full-backup.create");
    await capture("access");
    const views=p.getByRole("group",{name:"Access views",exact:true});
    await views.getByRole("button",{name:/Operation trail/}).focus();
    for(const [key,label,name] of [["ArrowRight",/Paired devices/,"devices"],["End",/Your authority/,"authority"],["Home",/Operation trail/,null],["ArrowLeft",/Your authority/,null]]) {
      await p.keyboard.press(key);
      const selected=views.getByRole("button",{name:label});
      await expect(selected).toBeFocused();await expect(selected).toHaveAttribute("aria-pressed","true");
      if(name) await capture(name);
    }
    results.push({name:"access-views-arrow-home-end",width,theme,passed:true});
    await p.evaluate(()=>location.hash="Console");
    const tabs=p.getByRole("tablist",{name:"Console workspace",exact:true});await tabs.waitFor();
    await tabs.getByRole("tab",{name:"Console",exact:true}).focus();
    for(const [key,label] of [["ArrowRight","Live chat"],["End","Plugin inventory"],["Home","Console"]]) {
      await p.keyboard.press(key);const selected=tabs.getByRole("tab",{name:label,exact:true});
      await expect(selected).toBeFocused();await expect(selected).toHaveAttribute("aria-selected","true");
    }
    results.push({name:"console-tabs-arrow-home-end",width,theme,passed:true});
    await c.close();
  }
  expect(errors).toEqual([]);
} finally {
  await writeFile("artifacts/nextgen/keyboard-final.json",JSON.stringify({sourceHead,browser:browser.version(),results,errors},null,2));
  await browser.close();
}
console.log(JSON.stringify({cases:results.length,errors}));
