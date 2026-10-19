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
  const go = async (route) => {
    await p.goto(`${base}/${route}?fixture=structural`);
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
  await p
    .getByRole("group", { name: "Severity", exact: true })
    .getByRole("button", { name: "Warn", exact: true })
    .click();
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
    p
      .getByRole("group", { name: "Severity", exact: true })
      .getByRole("button", { name: "Warn", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
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
  assert.equal(await p.locator(".pp-studio [data-stage]").count(), 3);
  const geometry = await p.locator(".pp-studio").evaluate((el) => {
    const stages = [...el.querySelectorAll("[data-stage]")].map((g) => ({
      top: Number(g.getAttribute("data-stage-top")),
      bottom: Number(g.getAttribute("data-stage-bottom")),
      paths: [...g.querySelectorAll("[data-area]")].map((p) => ({
        key: p.getAttribute("data-area"),
        y: p.getBBox().y,
        bottom: p.getBBox().y + p.getBBox().height,
      })),
    }));
    return stages;
  });
  for (const stage of geometry)
    for (const path of stage.paths)
      assert.ok(
        path.y >= stage.top - 1 && path.bottom <= stage.bottom + 1,
        `${path.key} stays in stage`,
      );
  await p.screenshot({ path: `${out}/states/staged-tick-v52.png` });
  await p.getByRole("tab", { name: "CPU & chunks", exact: true }).click();
  assert.equal(await p.locator(".pp-studio [data-stage]").count(), 2);
  await p.screenshot({ path: `${out}/states/staged-cpu-v52.png` });
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
  await p.getByRole("button", { name: "All", exact: true }).click();
  await p.reload();
  await expect(
    p.getByRole("button", { name: "All", exact: true }),
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
    await p.screenshot({ path: `${out}/states/select-${theme}-v52.png` });
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
  return {
    viewReloads: true,
    crossRouteHorizon: true,
    crossTabStorage: true,
    keyboardListbox: true,
    selectAxeThemes: 2,
    stageGeometry: geometry,
    storageKeys: 12,
    pageErrors: errors,
  };
}
