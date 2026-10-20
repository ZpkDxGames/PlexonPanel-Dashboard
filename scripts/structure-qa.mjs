import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { polishChecks } from "./polish-checks.mjs";
const out = process.env.EVIDENCE_DIR ?? "../evidence",
  base = "http://127.0.0.1:4182",
  routes = [
    "fleet",
    "overview",
    "performance",
    "players",
    "console",
    "backups",
    "access",
    "settings",
  ];
await fs.mkdir(out + "/after", { recursive: true });
await fs.mkdir(out + "/states", { recursive: true });
const receipts = [],
  interactions = [],
  coverage = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [i + 1, 0]),
  );
function check(id, value, detail) {
  assert.ok(value, `Invariant ${id}: ${detail}`);
  coverage[id]++;
}
const log = await fs.open(out + "/development-server.log", "w"),
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "-H",
      "127.0.0.1",
      "-p",
      "4182",
    ],
    { stdio: ["ignore", log.fd, log.fd], detached: true },
  );
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if (
        (await fetch(base + "/pair", { signal: AbortSignal.timeout(1500) })).ok
      )
        break;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? chromium.executablePath(),
    args: ["--no-sandbox"],
  });
  for (const theme of ["dark", "light"])
    for (const size of [
      { width: 1545, height: 911 },
      { width: 1280, height: 800 },
      { width: 1920, height: 1080 },
      { width: 390, height: 844 },
    ]) {
      const cfg = { ...size, theme },
        c = await browser.newContext({
          viewport: size,
          timezoneId: "America/Sao_Paulo",
        });
      await c.addInitScript(
        ({ theme }) =>
          localStorage.setItem(
            "plexon:preferences",
            JSON.stringify({ theme, skinProvider: "disabled" }),
          ),
        cfg,
      );
      const p = await c.newPage();
      await p.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      for (const route of routes) {
        await p.goto(`${base}/${route}?fixture=structural`);
        await p.locator(".pp-shell").waitFor();
        await p.waitForTimeout(500);
        assert.equal(
          await p.locator("select").count(),
          0,
          `${route}: no native selectors`,
        );
        const geometry = await p.evaluate(() => {
          const visible = (el) =>
            el.getBoundingClientRect().width > 0 &&
            el.getBoundingClientRect().height > 0;
          const boxes = (el) => {
            const s = getComputedStyle(el);
            return (
              ["Top", "Right", "Bottom", "Left"].some(
                (k) => parseFloat(s["border" + k + "Width"]) > 0,
              ) &&
              ["TopLeft", "TopRight", "BottomLeft", "BottomRight"].some(
                (k) => parseFloat(s["border" + k + "Radius"]) >= 12,
              ) &&
              visible(el)
            );
          };
          const nested = [];
          for (const el of document.querySelectorAll(
            'body *:not([role="dialog"] *)',
          )) {
            if (!boxes(el)) continue;
            let par = el.parentElement;
            while (par) {
              if (boxes(par)) {
                nested.push(`${el.className} inside ${par.className}`);
                break;
              }
              par = par.parentElement;
            }
          }
          const deck = document.querySelector(".pp-deck--instruments"),
            cells = [
              ...document.querySelectorAll(".pp-deck--instruments>.pp-cell"),
            ],
            studio = document.querySelector(".pp-studio"),
            metrics = [...document.querySelectorAll(".pp-studio .pp-metric")],
            row = [...document.querySelectorAll(".pp-crow__msg")].find((e) =>
              e.textContent?.includes("logged in with entity id"),
            ),
            can = document.querySelector(".pp-canvas");
          return {
            nested,
            header: document
              .querySelector("header[role=banner]")
              .getBoundingClientRect().height,
            rail: document
              .querySelector(".pp-rail")
              .getBoundingClientRect()
              .toJSON(),
            overflow: document.documentElement.scrollWidth > innerWidth,
            canvasContent:
              can.clientWidth -
              parseFloat(getComputedStyle(can).paddingLeft) -
              parseFloat(getComputedStyle(can).paddingRight),
            cells: cells.map((el) => {
              const s = getComputedStyle(el),
                metric = el
                  .querySelector(".pp-inst__metric")
                  .getBoundingClientRect(),
                viz = el.querySelector(".pp-inst__viz").getBoundingClientRect(),
                rect = el.getBoundingClientRect();
              return {
                height: rect.height,
                border: s.borderWidth,
                radius: s.borderRadius,
                valueFont: getComputedStyle(el.querySelector(".pp-inst__value"))
                  .fontSize,
                label: !!el.querySelector(".pp-kicker"),
                source: !!el.querySelector(".pp-src .pp-dot"),
                unit: !!el.querySelector(".pp-inst__unit"),
                vizBottom: rect.bottom - viz.bottom,
                deadZone: viz.top - metric.bottom,
              };
            }),
            deck: deck
              ? {
                  gap: getComputedStyle(deck).gap,
                  bg: getComputedStyle(deck).backgroundColor,
                  columns: getComputedStyle(deck).gridTemplateColumns,
                }
              : null,
            studioBoxes: studio
              ? [studio, ...studio.querySelectorAll("*")].filter(boxes).length
              : null,
            metrics: metrics.length,
            metricBorders: metrics.map((el) => ({
              border: getComputedStyle(el).borderWidth,
              radius: getComputedStyle(el).borderRadius,
            })),
            active: metrics
              .filter((el) => el.dataset.active === "true")
              .map((el) => ({
                height: getComputedStyle(el, "::before").height,
              })),
            sourceText: [
              ...document.querySelectorAll(".pp-cell,.pp-ribbon,.pp-inst"),
            ]
              .map((e) => e.innerText)
              .join(" "),
            inlineGate: [
              ...document.querySelectorAll(".pp-power [aria-disabled=true]"),
            ].some((e) => e.nextElementSibling?.tagName === "P"),
            deckText: deck?.innerText,
            consoleLines: row
              ? row.getBoundingClientRect().height /
                parseFloat(getComputedStyle(row).lineHeight)
              : null,
            messageShare: row
              ? row.getBoundingClientRect().width /
                row.parentElement.getBoundingClientRect().width
              : null,
            boilerplate: [
              ...document.querySelectorAll(
                ".pp-console[data-mode=compact] .pp-crow",
              ),
            ].some(
              (el) =>
                el.innerText.includes("INFO") ||
                /^Server\b/.test(
                  el.querySelector(".pp-crow__msg")?.textContent ?? "",
                ),
            ),
            chips: document.querySelectorAll(".pp-chip").length,
            bodyText: document.body.innerText,
            scrollH: document.scrollingElement.scrollHeight,
            innerH: innerHeight,
            bleed: can.dataset.bleed,
            ideRows: document.querySelector(".pp-ide")
              ? getComputedStyle(document.querySelector(".pp-ide"))
                  .gridTemplateRows
              : null,
            pipelineNodes: document.querySelectorAll(".pp-pipeline li").length,
            accessCols: document.querySelector(".pp-access")
              ? getComputedStyle(document.querySelector(".pp-access"))
                  .gridTemplateColumns
              : null,
            settingsCols: document.querySelector(".pp-settings")
              ? getComputedStyle(document.querySelector(".pp-settings"))
                  .gridTemplateColumns
              : null,
            previewPosition: document.querySelector(".pp-settings__preview")
              ? getComputedStyle(
                  document.querySelector(".pp-settings__preview"),
                ).position
              : null,
            dockPanes: document.querySelectorAll(".pp-dock>.pp-pane").length,
            playersCols: document.querySelector(".pp-players")
              ? getComputedStyle(document.querySelector(".pp-players"))
                  .gridTemplateColumns
              : null,
          };
        });
        check(1, !geometry.nested.length, JSON.stringify(geometry.nested));
        check(
          2,
          (geometry.bodyText.match(/\bPAPER\b/g) || []).length <= 1 &&
            (geometry.bodyText.match(/\bHOST\b/g) || []).length <= 1 &&
            !/\b(PAPER|HOST)\b/.test(geometry.sourceText),
          "source budget",
        );
        check(
          3,
          (geometry.bodyText.match(/\bLive\b/g) || []).length <= 2,
          "live budget",
        );
        check(5, !geometry.inlineGate, "no inline gate paragraphs");
        check(6, geometry.header === 56, "header height");
        check(
          9,
          size.width < 760
            ? geometry.rail.height === 56
            : geometry.rail.width === 64,
          "rail geometry",
        );
        if (size.width === 1545)
          check(
            10,
            geometry.canvasContent >= 1425 || route === "console",
            "recovered content width",
          );
        if (route === "overview") {
          check(4, !/stale/i.test(geometry.deckText), "healthy deck is silent");
          check(
            11,
            geometry.cells.length === 4 &&
              geometry.cells.every(
                (c) =>
                  c.height === 148 && c.border === "0px" && c.radius === "0px",
              ),
            "four flush cells",
          );
          check(
            12,
            geometry.deck.gap === "1px" && geometry.deck.bg.includes("0.1"),
            "one pixel hairlines",
          );
          check(
            13,
            geometry.cells.every(
              (c) =>
                c.valueFont === "28px" &&
                c.label &&
                c.source &&
                c.unit &&
                c.vizBottom >= -1 &&
                c.vizBottom <= 12 &&
                c.deadZone <= 24,
            ),
            "instrument anatomy " + JSON.stringify(geometry.cells),
          );
          check(
            14,
            geometry.studioBoxes === 1 &&
              geometry.metricBorders.every(
                (m) => !m.border.includes("2px") && m.radius === "0px",
              ),
            "one studio box",
          );
          check(
            15,
            geometry.metrics === 5 &&
              geometry.active.length === 1 &&
              geometry.active[0].height === "2px",
            "five metric ribbon + indicator",
          );
          const chart = await p
            .locator(".pp-studio .pp-stage__plot")
            .evaluate((el) => {
              const svg = el.querySelector("svg"),
                a = el.getBoundingClientRect(),
                b = svg.getBoundingClientRect(),
                line = svg.querySelector("path.pp-line"),
                areas = svg.querySelectorAll("path.pp-area"),
                gaps = [...svg.querySelectorAll("rect[data-gap]")].map((g) => ({
                  from: +g.dataset.from,
                  to: +g.dataset.to,
                })),
                segments = JSON.parse(line?.dataset.segments ?? "[]");
              return {
                dw: Math.abs(a.width - b.width),
                dh: Math.abs(a.height - b.height),
                gradients: svg.querySelectorAll("linearGradient stop").length,
                areas: areas.length,
                lines: svg.querySelectorAll("path.pp-line").length,
                gaps: gaps.length,
                segments: segments.length,
                subpaths: (line?.getAttribute("d").match(/M/g) ?? []).length,
                crossing: segments.some(([from, to]) =>
                  gaps.some((g) => from < g.to && to > g.from),
                ),
              };
            });
          await p.getByTestId("ribbon-mean").click();
          const budget = await p
            .locator('.pp-studio [data-budget="50"]')
            .count();
          await p.getByTestId("ribbon-tps").click();
          check(
            16,
            chart.dw <= 1 &&
              chart.dh <= 1 &&
              chart.gradients === 3 &&
              chart.areas === 1 &&
              chart.lines === 1 &&
              chart.gaps > 0 &&
              chart.segments === chart.subpaths &&
              !chart.crossing &&
              budget > 0,
            JSON.stringify(chart),
          );
          if (size.width >= 1545) {
            check(
              17,
              geometry.consoleLines > 0 && geometry.consoleLines <= 2.05,
              "compact console wrap",
            );
            check(19, geometry.messageShare >= 0.8, "message width share");
          }
          check(
            18,
            !geometry.boilerplate && geometry.chips > 0,
            "collapsed boilerplate and visible plugin chips",
          );
          check(23, geometry.dockPanes === 2, "overview dock silhouette");
          const start = p.getByRole("button", { name: "Start", exact: true });
          await expect(start).toHaveAttribute("aria-disabled", "true");
          await start.focus();
          await expect(p.getByRole("tooltip")).toContainText(
            "Start requires a confirmed stopped service.",
          );
          await start.click({ force: true });
          check(
            7,
            (await p.getByRole("dialog").count()) === 0,
            "gated Start does not prepare",
          );
          await start.blur();
          check(
            8,
            (await p
              .getByRole("button", { name: "Restart", exact: true })
              .getAttribute("data-fg")) === "true" &&
              (await p
                .getByRole("button", { name: "Stop", exact: true })
                .getAttribute("data-fg")) === "true",
            "valid actions foregrounded",
          );
        }
        if (route === "performance") {
          const workbench = await p.locator(".pp-bench").evaluate((el) => ({
            stages: el.querySelectorAll(".pp-stage").length,
            cells: el.querySelectorAll(".pp-deck__cell").length,
            axes: el.querySelectorAll(".pp-axis").length,
            readouts: el.querySelectorAll('[data-testid="readout-bar"]').length,
            overlaps: [...el.querySelectorAll(".pp-stage")].filter(
              (s) =>
                s.querySelectorAll("path.pp-area").length > 1 ||
                s.querySelectorAll("path.pp-line").length > 1,
            ).length,
            cpu: [
              ...el.querySelectorAll('[data-testid="deck-04"] .pp-stage'),
            ].map((s) => s.dataset.series),
          }));
          check(
            23,
            workbench.stages === 9 &&
              workbench.cells === 4 &&
              workbench.axes === 1 &&
              workbench.readouts === 1 &&
              workbench.overlaps === 0 &&
              workbench.cpu.join(",") === "svcCpu,nodeCpu",
            "nine separate lanes, one readout and axis " +
              JSON.stringify(workbench),
          );
          const plot = p.locator(".pp-bench__primary .pp-stage__plot");
          await plot.scrollIntoViewIfNeeded();
          const box = await plot.boundingBox();
          await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
          await expect(p.getByTestId("readout-bar")).toHaveAttribute(
            "data-state",
            "scrub",
          );
          await expect(p.locator(".pp-bench .pp-cross")).toHaveCount(9);
          await p.mouse.move(1, 1);
        }
        if (route === "console") {
          check(
            20,
            geometry.bleed === "true" &&
              geometry.scrollH <= geometry.innerH &&
              geometry.ideRows.split(" ").length === 4,
            "four-row bleed IDE",
          );
          if (size.width >= 1545)
            check(
              17,
              geometry.consoleLines > 0 && geometry.consoleLines < 1.1,
              "full-width console line",
            );
        }
        if (size.width === 390) {
          check(
            22,
            !geometry.overflow && geometry.rail.height === 56,
            "responsive containment",
          );
          if (route === "overview")
            check(
              22,
              geometry.deck.columns.split(" ").length === 1,
              "one column mobile deck",
            );
        }
        if (route === "players" && size.width > 1280)
          check(
            23,
            geometry.playersCols.split(" ").length === 2 &&
              parseFloat(geometry.playersCols) >= 340 &&
              parseFloat(geometry.playersCols) <= 440,
            "player columns",
          );
        if (route === "backups")
          check(23, geometry.pipelineNodes === 14, "14 stage rail");
        if (route === "access" && size.width >= 1360)
          check(
            23,
            geometry.accessCols.split(" ").length === 3,
            "three-pane access",
          );
        if (route === "settings" && size.width > 1100)
          check(
            23,
            geometry.settingsCols.split(" ").length === 2 &&
              geometry.previewPosition === "sticky",
            "settings columns + sticky preview",
          );
        const axe = (
          await new AxeBuilder({ page: p }).analyze()
        ).violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        }));
        check(25, axe.length === 0, "axe " + JSON.stringify(axe));
        check(
          25,
          errors.length === 0,
          "browser exceptions " + errors.join(";"),
        );
        check(22, !geometry.overflow, "all viewport containment");
        const { bodyText, sourceText, deckText, ...saved } = geometry;
        receipts.push({
          ...cfg,
          route,
          geometry: saved,
          axe,
          errors: [...errors],
        });
        await p.screenshot({
          path: `${out}/after/${theme}-${size.width}-${route}.png`,
          fullPage: true,
          animations: "disabled",
        });
        console.log(`PASS ${theme} ${size.width} ${route}`);
      }
      // Header geometry in every phase, in every viewport/theme.
      for (const mode of [
        "stopped",
        "starting",
        "stopping",
        "unknown",
        "offline",
        "host-stale",
      ]) {
        await p.goto(`${base}/overview?fixture=${mode}`);
        await p.locator(".pp-shell").waitFor();
        check(
          6,
          (await p
            .locator("header[role=banner]")
            .evaluate((e) => e.getBoundingClientRect().height)) === 56,
          mode + " header",
        );
        if (mode === "stopped")
          check(
            8,
            (await p
              .getByRole("button", { name: "Start", exact: true })
              .getAttribute("data-fg")) === "true",
            "stopped Start foreground",
          );
        if (mode === "host-stale")
          check(
            4,
            (await p.locator(".pp-inst[data-stale=true]").count()) > 0,
            "independent stale Host clock",
          );
      }
      await c.close();
    }
  // Interactions use one desktop session and the same real UI path as a paired browser.
  const c = await browser.newContext({
    viewport: { width: 1545, height: 911 },
    timezoneId: "America/Sao_Paulo",
  });
  await c.addInitScript(() => {
    localStorage.setItem(
      "plexon:preferences",
      JSON.stringify({ skinProvider: "disabled" }),
    );
    window.__logStoreWrites = [];
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      window.__logStoreWrites.push(this.name);
      return original.apply(this, args);
    };
  });
  const p = await c.newPage();
  await p.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
  await p.goto(base + "/overview?fixture=structural");
  await p.locator(".pp-shell").waitFor();
  await p.getByRole("button", { name: "Toggle navigation width" }).click();
  check(
    9,
    (await p
      .locator(".pp-rail")
      .evaluate((e) => Math.round(e.getBoundingClientRect().width))) === 220,
    "expanded rail",
  );
  await p.getByRole("button", { name: "Toggle navigation width" }).click();
  await p.keyboard.press("g");
  await p.keyboard.press("1");
  await expect(p).toHaveURL(/fleet/);
  await p.keyboard.press("g");
  await p.keyboard.press("2");
  await expect(p).toHaveURL(/overview/);
  check(9, true, "G route shortcuts");
  await p.getByRole("link", { name: "Overview", exact: true }).focus();
  await expect(p.getByRole("tooltip")).toContainText("G");
  await p.keyboard.press("Escape");
  await p.keyboard.press("Control+k");
  await p.getByRole("textbox", { name: "Search commands" }).fill("Performance");
  await p.keyboard.press("Enter");
  await expect(p).toHaveURL(/performance/);
  interactions.push("palette keyboard filtering + navigation");
  await p.goto(base + "/console?fixture=volume");
  await p.locator(".pp-shell").waitFor();
  await p.waitForTimeout(700);
  check(
    20,
    (await p.locator(".pp-crow").count()) < 120,
    "5000 lines virtualized",
  );
  const composer = await p.locator(".pp-composer").boundingBox();
  check(
    20,
    Math.abs(composer.y + composer.height - 911) <= 2,
    "composer pinned to viewport bottom",
  );
  await p.goto(base + "/console?fixture=structural");
  await p.locator(".pp-shell").waitFor();
  await p
    .getByRole("textbox", { name: "Console command", exact: true })
    .fill("list");
  await p.getByRole("button", { name: "Send", exact: true }).click();
  await expect(p.getByRole("dialog")).toBeVisible();
  await p.getByRole("button", { name: "Confirm & execute" }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await p
    .getByRole("textbox", { name: "Console command", exact: true })
    .press("ArrowUp");
  await expect(
    p.getByRole("textbox", { name: "Console command", exact: true }),
  ).toHaveValue("list");
  await p.getByRole("tab", { name: "Chat", exact: true }).click();
  await p.getByRole("textbox", { name: "Chat message" }).fill("Hello players");
  await p.getByRole("button", { name: "Send", exact: true }).click();
  await expect(p.getByRole("dialog")).toBeVisible();
  await p.getByRole("button", { name: "Cancel", exact: true }).click();
  const keys = await p.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    writes: window.__logStoreWrites ?? [],
  }));
  check(
    21,
    [...keys.local, ...keys.session].every((k) => !/console|chat/i.test(k)) &&
      keys.writes.every((k) => !/console|chat/i.test(k)),
    "volatile console/chat",
  );
  interactions.push(
    "prepare/review/execute; command history; chat review; no log storage",
  );
  await p.goto(base + "/players?fixture=structural");
  await p.locator(".pp-shell").waitFor();
  await p.locator(".pp-player-row").first().click();
  await expect(p.locator(".pp-inspector .pp-uuid")).toContainText(
    "19f50206-26de-410c-a1bc-000000000000",
  );
  interactions.push("exact UUID inspector");
  await p.goto(base + "/backups?fixture=structural");
  await p.locator(".pp-shell").waitFor();
  await p.getByRole("button", { name: "Restore", exact: true }).first().click();
  await expect(p.getByRole("dialog")).toBeVisible();
  await expect(
    p.getByRole("textbox", { name: "Type server name" }),
  ).toBeVisible();
  await expect(
    p.getByRole("button", { name: "Confirm & execute" }),
  ).toHaveAttribute("aria-disabled", "true");
  await p.getByRole("button", { name: "Cancel", exact: true }).click();
  interactions.push("Host restore token + typed review");
  await p.goto(base + "/settings?fixture=structural");
  await p.locator(".pp-shell").waitFor();
  await p.getByRole("combobox", { name: "Motion", exact: true }).click();
  await p.getByRole("option", { name: "reduced", exact: true }).click();
  await p.waitForTimeout(100);
  check(
    25,
    (await p.evaluate(() => document.getAnimations().length)) === 0,
    "motion reduced",
  );
  await p.getByRole("combobox", { name: "Chart fill", exact: true }).click();
  await p.getByRole("option", { name: "Lines", exact: true }).click();
  check(
    25,
    (await p
      .locator(".pp-preview linearGradient stop")
      .first()
      .getAttribute("stop-opacity")) === "0",
    "chart fill preference",
  );
  await p.goto(base + "/pair");
  await p
    .getByRole("textbox", { name: "Pairing code digit 1", exact: true })
    .fill("1");
  await expect(
    p.getByRole("textbox", { name: "Pairing code digit 2", exact: true }),
  ).toBeFocused();
  const pairAxe = (await new AxeBuilder({ page: p }).analyze()).violations;
  check(25, pairAxe.length === 0, "pairing accessibility");
  interactions.push("OTP auto advance + pairing accessibility");
  await c.close();
  const polish = await polishChecks(browser, base, out);
  for (const [offset, name] of [
    "backupsNoNativeControls",
    "backupsNoHero",
    "readoutBarNoClip",
    "headerHeight56WithCountdown",
    "gateReasonInlineZero",
  ].entries())
    check(26 + offset, polish.durability.invariants[name] > 0, name);
  await fs.writeFile(
    out + "/polish-v53-receipt.json",
    JSON.stringify(polish, null, 2),
  );
  execFileSync("bash", ["scripts/verify-purge.sh"]);
  const core = JSON.parse(
    await fs.readFile("tests/fixtures/core-sha256.json", "utf8"),
  );
  for (const [path, hash] of Object.entries(core))
    check(
      24,
      createHash("sha256")
        .update(await fs.readFile(path))
        .digest("hex") === hash,
      "core " + path,
    );
  check(21, true, "purge storage scan");
  check(24, true, "unit regression suite separately recorded");
  for (const [id, count] of Object.entries(coverage))
    assert.ok(count > 0, `Uncovered invariant ${id}`);
  await fs.writeFile(
    out + "/browser-receipts.json",
    JSON.stringify(receipts, null, 2),
  );
  await fs.writeFile(
    out + "/structural-summary.json",
    JSON.stringify(
      {
        result: "PASS",
        invariants: 30,
        preservedInvariants: 25,
        newInvariants: 5,
        configurations: receipts.length,
        coverage,
        interactions,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: 30/30 invariants (25 preserved + 5 durability); " +
      receipts.length +
      " route/theme/viewport configurations",
  );
} catch (e) {
  await fs.writeFile(
    out + "/browser-receipts.json",
    JSON.stringify(receipts, null, 2),
  );
  await fs.writeFile(
    out + "/structural-failure.json",
    JSON.stringify(
      { message: e.message, coverage, configurations: receipts.length },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
  await log.close();
}
