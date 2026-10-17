import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { harness } from "./v5-harness.mjs";
await harness(async ({ browser, origin, output }) => {
  const results = [];
  const routes = process.env.PLEXON_QA_ROUTES?.split(",") ?? [
    "fleet",
    "overview",
    "performance",
    "players",
    "console",
    "backups",
    "access",
    "settings",
  ];
  for (const [viewport, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 390, 844],
  ])
    for (const theme of ["dark", "light"]) {
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        ({ theme }) =>
          localStorage.setItem(
            "plexon:preferences",
            JSON.stringify({
              theme,
              motion: "reduced",
              skinProvider: "disabled",
            }),
          ),
        { theme },
      );
      await context.route("**/*", (route) =>
        new URL(route.request().url()).hostname === "127.0.0.1"
          ? route.continue()
          : route.abort(),
      );
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (
          m.type() === "error" &&
          !m.text().includes("Failed to load resource")
        )
          errors.push(m.text());
      });
      for (const route of routes) {
        await page.goto(`${origin}/${route}?fixture=healthy`, {
          waitUntil: "networkidle",
        });
        await page.locator("#workspace").waitFor();
        await page.waitForTimeout(500);
        const overflow = await page.evaluate(() => ({
            width: innerWidth,
            document: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
          })),
          axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
        await page.screenshot({
          path: `${output}/${route}-${viewport}-${theme}.png`,
          fullPage: true,
        });
        const result = {
          route,
          viewport,
          theme,
          overflow,
          pageErrors: [...errors],
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
          canvas: await page.locator("canvas").count(),
        };
        results.push(result);
        errors.length = 0;
        writeFileSync(
          `${output}/${process.env.PLEXON_QA_REPORT ?? "results.json"}`,
          JSON.stringify(results, null, 2),
        );
        console.log(
          JSON.stringify({
            route,
            viewport,
            theme,
            errors: result.pageErrors.length,
            violations: result.violations.length,
            overflow: overflow.document > width,
          }),
        );
      }
      await context.close();
    }
  assert(
    results.every(
      (r) =>
        !r.pageErrors.length &&
        !r.violations.length &&
        r.overflow.document <= r.overflow.width &&
        (r.route !== "overview" || r.overflow.height < 6500),
    ),
    "Browser matrix failed; inspect results JSON",
  );
});
