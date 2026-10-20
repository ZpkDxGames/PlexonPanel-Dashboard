import { durabilityChecks } from "./durability-checks.mjs";
import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
export async function polishChecks(browser, base, out) {
  const c = await browser.newContext({
    viewport: { width: 1545, height: 911 },
  });
  // Preferences are seeded once, so real view state survives subsequent document loads.
  await c.addInitScript(() => {
    if (!localStorage.getItem("plexon:preferences"))
      localStorage.setItem(
        "plexon:preferences",
        JSON.stringify({ theme: "dark", skinProvider: "disabled" }),
      );
  });
  const p = await c.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const go = async (route, fixture = "structural") => {
    await p.goto(`${base}/${route}?fixture=${fixture}`);
    await p.locator(".pp-shell").waitFor();
  };
  const select = async (label, value) => {
    await p.getByRole("combobox", { name: label, exact: true }).click();
    await p.getByRole("option", { name: value, exact: true }).click();
  };
  await go("overview");
  await p
    .getByRole("group", { name: "Time horizon" })
    .getByRole("button", { name: "1m", exact: true })
    .click();
  await p.getByRole("tab", { name: "Memory tiers", exact: true }).click();
  await p.getByRole("tab", { name: /^Committed/ }).click();
  await p.getByRole("tab", { name: "Player events", exact: true }).click();
  await p.getByRole("button", { name: "Deaths", exact: true }).click();
  await p.getByRole("button", { name: "Split", exact: true }).click();
  await p.reload();
  await expect(
    p.getByRole("tab", { name: "Memory tiers", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(p.getByRole("tab", { name: /^Committed/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    p.getByRole("tab", { name: "Player events", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    p
      .getByRole("group", { name: "Time horizon" })
      .getByRole("button", { name: "1m", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    p.getByRole("button", { name: "Deaths", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    p.getByRole("button", { name: "Split", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await p.getByRole("button", { name: "All", exact: true }).click();
  await expect(p.getByTestId("player-events")).toContainText("ZpkDxGames");
  await expect(p.getByTestId("player-events")).toContainText("is online");
  await expect(p.getByTestId("player-events")).toContainText("Stone Age");
  await expect(p.getByTestId("player-events")).toContainText(
    "fell from a high place",
  );
  await expect(p.getByTestId("player-events")).not.toContainText(
    "168.194.144.215",
  );
  await p.screenshot({
    path: `${out}/states/player-events-v53.png`,
    fullPage: true,
  });
  const retainedEvents = await p
    .getByTestId("player-events")
    .locator("li")
    .count();
  await p.getByRole("link", { name: "Performance", exact: true }).click();
  await expect(p.locator(".pp-bench")).toBeVisible();
  await p.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(p.getByTestId("player-events").locator("li")).toHaveCount(
    retainedEvents,
  );
  await expect(p.getByTestId("player-events")).toContainText("Stone Age");
  await go("performance");
  await expect(
    p
      .getByRole("group", { name: "Time horizon" })
      .getByRole("button", { name: "1m", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await p
    .getByRole("group", { name: "Time horizon" })
    .getByRole("button", { name: "2h", exact: true })
    .click();
  await go("overview");
  await expect(
    p
      .getByRole("group", { name: "Time horizon" })
      .getByRole("button", { name: "35m", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await p.getByRole("tab", { name: "Tick & MSPT", exact: true }).click();
  await p.getByRole("button", { name: "Focus", exact: true }).click();
  const geometry = [];
  for (const key of ["tps", "mean", "p95", "p99", "gc"]) {
    await p.getByTestId(`ribbon-${key}`).click();
    await expect(p.getByTestId(`ribbon-${key}`)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(p.locator(".pp-studio .pp-stage")).toHaveCount(1);
    await expect(p.locator(".pp-studio .pp-stage")).toHaveAttribute(
      "data-series",
      key,
    );
    const stage = await p.locator(".pp-studio .pp-stage").evaluate((el) => ({
      series: el.dataset.series,
      areas: el.querySelectorAll("path.pp-area").length,
      lines: el.querySelectorAll("path.pp-line").length,
      bars: el.querySelectorAll("rect.pp-bar").length,
      height: el.querySelector(".pp-stage__plot").getBoundingClientRect()
        .height,
    }));
    assert.ok(stage.areas <= 1 && stage.lines <= 1);
    assert.ok(Math.abs(stage.height - 300) < 0.1);
    geometry.push(stage);
    if (key === "mean")
      await expect(p.locator(".pp-studio line.pp-budget")).toHaveCount(1);
  }
  await p.getByTestId("ribbon-tps").focus();
  await p.keyboard.press("ArrowRight");
  await expect(p.getByTestId("ribbon-mean")).toBeFocused();
  await p.keyboard.press("End");
  await expect(p.getByTestId("ribbon-gc")).toBeFocused();
  await p.keyboard.press("Home");
  await expect(p.getByTestId("ribbon-tps")).toBeFocused();
  await p.screenshot({
    path: `${out}/states/focus-tps-v53.png`,
    fullPage: true,
  });
  await p.getByRole("button", { name: "Split", exact: true }).click();
  await expect(p.locator(".pp-studio .pp-stage")).toHaveCount(5);
  const split = await p.locator(".pp-studio .pp-stage").evaluateAll((els) =>
    els.map((el) => ({
      areas: el.querySelectorAll("path.pp-area").length,
      height: el.querySelector(".pp-stage__plot").getBoundingClientRect()
        .height,
    })),
  );
  assert.ok(split.every((s) => s.areas <= 1 && Math.abs(s.height - 110) < 0.1));
  await p.locator('.pp-studio .pp-stage[data-series="p99"] button').click();
  await expect(p.getByTestId("ribbon-p99")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await p.screenshot({
    path: `${out}/states/split-tick-v53.png`,
    fullPage: true,
  });
  await p.getByRole("tab", { name: "Memory tiers", exact: true }).click();
  await expect(p.locator(".pp-studio .pp-stage")).toHaveCount(3);
  const scales = await p
    .locator(".pp-studio .pp-stage__svg")
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label").split("scale ")[1]),
    );
  assert.equal(new Set(scales).size, 1);
  await p.getByRole("tab", { name: "CPU & chunks", exact: true }).click();
  await expect(p.locator(".pp-studio .pp-stage")).toHaveCount(4);
  await go("performance");
  await expect(p.getByTestId("readout-bar")).toHaveCount(1);
  await expect(p.locator(".pp-axis")).toHaveCount(1);
  await expect(p.locator(".pp-bench .pp-deck__cell")).toHaveCount(4);
  await expect(p.locator(".pp-bench .pp-stage")).toHaveCount(9);
  await p.getByRole("tab", { name: "Tick & MSPT", exact: true }).click();
  const plot = p.locator(".pp-bench__primary .pp-stage__plot");
  await plot.scrollIntoViewIfNeeded();
  const box = await plot.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(p.getByTestId("readout-bar")).toHaveAttribute(
    "data-state",
    "scrub",
  );
  await expect(p.locator(".pp-bench .pp-cross")).toHaveCount(9);
  const overlaps = await p
    .locator(".pp-bench .pp-stage")
    .evaluateAll(
      (els) =>
        els.filter(
          (el) =>
            el.querySelectorAll("path.pp-area").length > 1 ||
            el.querySelectorAll("path.pp-line").length > 1,
        ).length,
    );
  assert.equal(overlaps, 0);
  await p.screenshot({
    path: `${out}/states/workbench-scrub-v53.png`,
    fullPage: true,
  });
  await p.mouse.move(1, 1);
  await p.getByRole("button", { name: "Pause analyzer", exact: true }).click();
  const before = await p.locator(".pp-bench .pp-axis").textContent();
  await p.waitForTimeout(1100);
  assert.equal(await p.locator(".pp-bench .pp-axis").textContent(), before);
  await p.getByRole("button", { name: "Resume analyzer", exact: true }).click();
  await p
    .getByRole("button", { name: "Open raw samples", exact: true })
    .click();
  await expect(p.getByRole("dialog")).toContainText("Export CSV");
  await p
    .getByRole("button", { name: "Close raw samples", exact: true })
    .click();
  for (const size of [
    { width: 1555, height: 916 },
    { width: 1280, height: 800 },
  ]) {
    await p.setViewportSize(size);
    await p.screenshot({
      path: `${out}/states/workbench-${size.width}-v53.png`,
      fullPage: true,
    });
    await go("overview");
    await p.getByRole("button", { name: "Focus", exact: true }).click();
    await p.screenshot({
      path: `${out}/states/studio-${size.width}-v53.png`,
      fullPage: true,
    });
    await go("performance");
  }
  await p.setViewportSize({ width: 1545, height: 911 });
  await go("overview", "normal-load");
  await p.getByRole("tab", { name: "Tick & MSPT", exact: true }).click();
  await p.getByTestId("ribbon-mean").click();
  await expect(p.locator(".pp-studio .pp-stage__chip")).toContainText(
    "50 ms budget · off scale",
  );
  await expect(p.locator(".pp-studio line.pp-budget")).toHaveCount(0);
  await p
    .locator(".pp-studio")
    .screenshot({ path: `${out}/states/normal-load-budget-v53.png` });
  await go("overview", "roster-events");
  await p.getByRole("tab", { name: "Player events", exact: true }).click();
  await expect(p.getByTestId("player-events")).toContainText("ZpkDxGames");
  await expect(p.getByTestId("player-events")).toContainText("is online");
  await expect(
    p.getByRole("button", { name: "Load earlier player events" }),
  ).toHaveCount(0);
  await p
    .getByTestId("player-events")
    .screenshot({ path: `${out}/states/roster-without-history-scope-v53.png` });
  await go("console");
  await p.getByRole("tab", { name: "Chat", exact: true }).click();
  await p
    .getByRole("group", { name: "Console severity" })
    .getByRole("button", { name: "Error", exact: true })
    .click();
  await p.getByRole("button", { name: "Wrap", exact: true }).click();
  await p.getByRole("button", { name: ".*", exact: true }).click();
  await select("Filter plugin", "LuckPerms");
  await p.reload();
  await expect(
    p.getByRole("tab", { name: "Chat", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    p.getByRole("button", { name: "Wrap", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    p.getByRole("button", { name: ".*", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    p.getByRole("combobox", { name: "Filter plugin" }),
  ).toContainText("LuckPerms");
  await expect(
    p
      .getByRole("group", { name: "Console severity" })
      .getByRole("button", { name: "Error", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // Functional hotkey updates must read the latest store, even after reload.
  await p.keyboard.press("Alt+z");
  await p.keyboard.press("Alt+r");
  await expect(
    p.getByRole("button", { name: "Wrap", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    p.getByRole("button", { name: ".*", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await go("players");
  await p
    .locator(".pp-roster-list")
    .locator("..")
    .getByRole("button", { name: "All", exact: true })
    .first()
    .click();
  await p.reload();
  await expect(
    p
      .locator(".pp-roster-list")
      .locator("..")
      .getByRole("button", { name: "All", exact: true })
      .first(),
  ).toHaveAttribute("aria-pressed", "true");
  await go("backups");
  await select("Player warning countdown", "15 min warning");
  await p.reload();
  await expect(
    p.getByRole("combobox", { name: "Player warning countdown" }),
  ).toContainText("15 min warning");
  const second = await c.newPage();
  await second.goto(`${base}/backups?fixture=structural`);
  await second.locator(".pp-shell").waitFor();
  await select("Player warning countdown", "30 min warning");
  await expect(
    second.getByRole("combobox", { name: "Player warning countdown" }),
  ).toContainText("30 min warning");
  await second.close();
  await go("settings");
  for (const theme of ["dark", "light"]) {
    await select("Theme", theme);
    const trigger = p.getByRole("combobox", { name: "Motion", exact: true });
    await trigger.focus();
    await trigger.press("ArrowDown");
    await expect(
      p.getByRole("listbox", { name: "Motion", exact: true }),
    ).toBeVisible();
    await p.keyboard.press("End");
    await expect(
      p.getByRole("option", { name: "off", exact: true }),
    ).toBeFocused();
    await p.keyboard.press("Home");
    await expect(
      p.getByRole("option", { name: "full", exact: true }),
    ).toBeFocused();
    await p.keyboard.press("ArrowDown");
    await p.keyboard.press("Enter");
    await expect(trigger).toContainText("reduced");
    await expect(trigger).toBeFocused();
    await trigger.click();
    const violations = (await new AxeBuilder({ page: p }).analyze()).violations;
    assert.deepEqual(violations, [], `${theme} select accessibility`);
    await p.screenshot({ path: `${out}/states/select-${theme}-v53.png` });
    await p.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
  const stored = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("plexon:view-sync")),
  );
  assert.equal(stored.horizon, "2h");
  assert.equal(stored.idePane, "chat");
  assert.equal(stored.rosterScope, "all");
  assert.equal(stored.backupCountdownMinutes, 30);
  assert.ok(!JSON.stringify(stored).includes("Hello players"));
  assert.deepEqual(errors, []);
  await c.close();
  const durability = await durabilityChecks(browser, base, out);
  return {
    durability,
    viewReloads: true,
    crossRouteHorizon: true,
    crossTabStorage: true,
    keyboardListbox: true,
    selectAxeThemes: 2,
    stageGeometry: geometry,
    playerEvents: true,
    sharedWorkbenchCrosshair: 9,
    storageKeys: 15,
    pageErrors: errors,
  };
}

if (
  process.argv[1] &&
  (await import("node:path")).resolve(process.argv[1]) ===
    (await import("node:url")).fileURLToPath(import.meta.url)
) {
  const { runPolish } = await import("./polish-runner.mjs");
  await runPolish(polishChecks);
}
