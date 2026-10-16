import { firefox, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4173",
  browser = await firefox.launch(),
  reports = [];
for (const width of [1440, 390]) {
  const c = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
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
  const p = await c.newPage();
  await p.goto(`${base}/?fixture=healthy#Players`);
  await p.locator(".player-row").first().waitFor();
  await p.evaluate(() => {
    window.lastSearchInputAt = null;
    document.querySelector('input[aria-label="Search players"]').addEventListener("input", () => { window.lastSearchInputAt = performance.now(); }, {capture:true});
  });
  const inputObservations = [];
  for (let i = 0; i < 24; i++) {
    const text = i % 2 ? "" : "LumaCraft";
    await p.getByLabel("Search players", {exact:true}).fill(text);
    const sample = await p.evaluate(async text => {
      const {session} = await import("/src/adapter/session.ts");
      const expected = session.getSnapshot().state.players.filter(player => String(player.name).toLowerCase().includes(text.toLowerCase()) || String(player.uuid).includes(text)).length;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const rows = [...document.querySelectorAll(".player-row")];
      const valid = rows.length === expected && rows.every(row => !text || row.textContent.includes(text));
      if (!valid || window.lastSearchInputAt === null) throw Error("Actual input did not produce the expected visible roster result: " + JSON.stringify({text,rows:rows.length}));
      return performance.now() - window.lastSearchInputAt;
    }, text);
    inputObservations.push(sample);
  }
  const result = await p.evaluate(async (input) => {
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const routes = [
        "Overview",
        "Performance",
        "Players",
        "Console",
        "Backups",
        "Access",
        "Settings",
        "Fleet",
      ],
      transitions = [];
    for (const name of routes) {
      location.hash = name;
      await new Promise((r) => setTimeout(r, 200));
    }
    for (let i = 0; i < 24; i++) {
      const start = performance.now();
      location.hash = routes[i % routes.length];
      while (
        document.querySelector(".route-skeleton") ||
        document.querySelector(".workspace-heading h1")?.textContent !==
          (routes[i % routes.length] === "Console"
            ? "Console & chat"
            : routes[i % routes.length] === "Access"
              ? "Access & audit"
              : routes[i % routes.length])
      )
        await frame();
      await frame();
      transitions.push(performance.now() - start);
    }
    const stats = (values) => {
      values.sort((a, b) => a - b);
      return {
        p50: values[Math.floor(values.length * 0.5)],
        p95: values[Math.floor(values.length * 0.95)],
        min: values[0],
        max: values.at(-1),
        observations: values,
      };
    };
    return {
      input: stats(input),
      warmRoute: stats(transitions),
      scope:
        "Actual Playwright fill input event capture → verified visible roster state and two requestAnimationFrame callbacks (includes automation overhead); warmed route chunks; network completion excluded",
    };
  }, inputObservations);
  reports.push({ width, ...result });
  expect(result.input.p95).toBeLessThanOrEqual(width === 1440 ? 100 : 200);
  expect(result.warmRoute.p95).toBeLessThanOrEqual(200);
  await c.close();
}
await browser.close();
await mkdir("artifacts/nextgen", { recursive: true });
await writeFile(
  "artifacts/nextgen/input.json",
  JSON.stringify(
    {
      reports,
      limits:
        "Firefox does not expose CDP CPU throttling or layout-shift entries. Mobile figures are unthrottled; throttled-mobile/CLS certification remain BLOCKED.",
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(reports, null, 2));
