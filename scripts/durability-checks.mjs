import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const ROUTES = [
    "fleet",
    "overview",
    "performance",
    "players",
    "console",
    "backups",
    "access",
    "settings",
  ],
  NATIVE =
    'select,input[type="checkbox"],input[type="number"],input[type="time"]';
export async function durabilityChecks(browser, base, out) {
  const invariants = {
      backupsNoNativeControls: 0,
      backupsNoHero: 0,
      readoutBarNoClip: 0,
      headerHeight56WithCountdown: 0,
      gateReasonInlineZero: 0,
    },
    readouts = [],
    headers = [],
    screens = [],
    recoveryViews = [],
    scheduleViews = [],
    errors = [];
  const mark = (name) => invariants[name]++;
  await fs.mkdir(out + "/states", { recursive: true });
  for (const theme of ["dark", "light"]) {
    const c = await browser.newContext({
      viewport: { width: 1545, height: 911 },
    });
    await c.addInitScript(
      (theme) =>
        localStorage.setItem(
          "plexon:preferences",
          JSON.stringify({ theme, skinProvider: "disabled" }),
        ),
      theme,
    );
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    const go = async (route, fixture) => {
      await p.goto(`${base}/${route}?fixture=${fixture}`);
      try {
        await p.locator(".pp-shell").waitFor();
      } catch (error) {
        await fs.writeFile(
          out + "/v60-page-failure.json",
          JSON.stringify(
            { url: p.url(), body: await p.locator("body").innerText(), errors },
            null,
            2,
          ),
        );
        throw error;
      }
    };
    const calls = () => p.evaluate(() => window.__ppHostCalls ?? []);
    const select = async (name, value) => {
      await p.getByRole("combobox", { name, exact: true }).click();
      await p.getByRole("option", { name: value, exact: true }).click();
    };
    await go("backups", "backups-recovery-required");
    await expect(p.getByTestId("recovery-band")).toBeVisible();
    await expect(
      p.getByTestId("preflight-ribbon").locator("[data-gate]"),
    ).toHaveCount(4);
    await expect(p.getByTestId("backup-rail").locator("li")).toHaveCount(14);
    await expect(p.locator('[data-gate="recovery"]')).toHaveAttribute(
      "data-code",
      "RECOVERY_REQUIRED",
    );
    await expect(
      p.getByRole("button", { name: "Create full backup", exact: true }),
    ).toBeDisabled();
    for (const [width, height] of [
      [1545, 911],
      [1280, 800],
      [1920, 1080],
      [390, 844],
    ]) {
      await p.setViewportSize({ width, height });
      assert.equal(await p.locator(NATIVE).count(), 0);
      assert.equal(await p.locator("p.gate-reason").count(), 0);
      assert.deepEqual(
        (await new AxeBuilder({ page: p }).analyze()).violations,
        [],
        `${theme} ${width} recovery axe`,
      );
      recoveryViews.push({
        theme,
        width,
        height,
        violations: 0,
        nativeControls: 0,
      });
    }
    await p.setViewportSize({ width: 1545, height: 911 });
    await p.screenshot({
      path: `${out}/states/v60-recovery-${theme}.png`,
      fullPage: true,
    });
    await p
      .getByRole("button", {
        name: "Verify Running & Clear Recovery Gate",
        exact: true,
      })
      .click();
    await expect(p.getByTestId("recovery-band")).toHaveCount(0);
    await expect(
      p.getByRole("button", { name: "Create full backup", exact: true }),
    ).toBeEnabled();
    assert.ok(
      (await calls()).some(
        (x) =>
          x.action === "maintenance.recovery.resolve" &&
          !x.params.acknowledgeRestore,
      ),
    );
    await go("backups", "backups-restore-recovery");
    await expect(p.getByTestId("recovery-band")).toBeVisible();
    await p
      .getByRole("button", {
        name: "Verify Running & Clear Recovery Gate",
        exact: true,
      })
      .click();
    await expect(p.getByRole("dialog")).toContainText(
      "Confirm you reviewed the world",
    );
    assert.ok(
      !(await calls()).some((x) => x.action === "maintenance.recovery.resolve"),
    );
    await p
      .getByRole("button", {
        name: "I reviewed the world · Clear recovery",
        exact: true,
      })
      .click();
    await expect(p.getByTestId("recovery-band")).toHaveCount(0);
    assert.ok(
      (await calls()).some(
        (x) =>
          x.action === "maintenance.recovery.resolve" &&
          x.params.acknowledgeRestore === true,
      ),
    );
    await go("backups", "backups-provider-not-configured");
    await expect(p.locator('[data-gate="provider"]')).toContainText(
      "Local only",
    );
    await p.getByRole("radio", { name: "Local VPS only", exact: true }).click();
    await expect(
      p.getByRole("button", { name: "Create full backup", exact: true }),
    ).toBeEnabled();
    await p.screenshot({
      path: `${out}/states/v60-local-${theme}.png`,
      fullPage: true,
    });
    await p
      .getByRole("button", { name: "Create full backup", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await calls()).find((x) => x.action === "backup.create")?.params,
      )
      .toMatchObject({ destinationMode: "LOCAL_ONLY", countdownSeconds: 300 });
    await expect(p.getByTestId("countdown-pill")).toBeVisible();
    await go("backups", "backups-legacy-host");
    await expect(
      p.getByRole("radio", { name: "Local VPS only", exact: true }),
    ).toBeDisabled();
    await expect(p.locator('[data-gate="provider"]')).toContainText(
      "Host update required for local backups",
    );
    await go("backups", "backups-healthy");
    await expect(
      p.getByRole("button", { name: "Create full backup", exact: true }),
    ).toBeEnabled();
    const btn = await p
        .getByRole("button", { name: "Create full backup", exact: true })
        .boundingBox(),
      cell = await p
        .locator(".pp-deck--exec .pp-deck__cell")
        .first()
        .boundingBox(),
      ledger = await p.getByTestId("restore-ledger").boundingBox();
    assert.ok(
      btn.y + btn.height <= cell.y + cell.height + 0.5 &&
        btn.y + btn.height <= ledger.y,
    );
    assert.equal(await p.locator(NATIVE).count(), 0);
    mark("backupsNoNativeControls");
    assert.equal(
      await p.getByText("Restore with evidence.", { exact: true }).count(),
      0,
    );
    assert.equal(
      await p.getByText("R06 / DURABILITY", { exact: true }).count(),
      0,
    );
    mark("backupsNoHero");
    await p
      .getByRole("button", { name: "Configure schedule", exact: true })
      .click();
    await expect(p.getByRole("dialog")).toBeVisible();
    assert.equal(await p.getByRole("dialog").locator(NATIVE).count(), 0);
    mark("backupsNoNativeControls");
    await expect(
      p.getByRole("combobox", { name: "Schedule time", exact: true }),
    ).toContainText("04:07");
    await select("Cadence", "WEEKLY");
    await expect(
      p.getByRole("group", { name: "Weekdays", exact: true }),
    ).toBeVisible();
    assert.equal(await p.getByRole("dialog").locator(NATIVE).count(), 0);
    mark("backupsNoNativeControls");
    let violations = (await new AxeBuilder({ page: p }).analyze()).violations;
    assert.deepEqual(violations, [], `${theme} schedule axe`);
    scheduleViews.push({
      theme,
      width: 1545,
      height: 911,
      violations: 0,
      nativeControls: 0,
    });
    for (const [width, height] of [
      [1280, 800],
      [1920, 1080],
      [390, 844],
    ]) {
      await p.setViewportSize({ width, height });
      assert.equal(await p.locator(NATIVE).count(), 0);
      mark("backupsNoNativeControls");
      assert.deepEqual(
        (await new AxeBuilder({ page: p }).analyze()).violations,
        [],
        `${theme} ${width} schedule axe`,
      );
      scheduleViews.push({
        theme,
        width,
        height,
        violations: 0,
        nativeControls: 0,
      });
    }
    await p.setViewportSize({ width: 1545, height: 911 });
    await p.screenshot({
      path: `${out}/states/v60-schedule-${theme}.png`,
      fullPage: true,
    });
    await p.getByRole("button", { name: "Cancel", exact: true }).click();
    await p.getByRole("button", { name: "Local", exact: true }).click();
    await expect(
      p.getByTestId("restore-ledger").locator("tbody tr"),
    ).toHaveCount(1);
    await expect(p.getByTestId("restore-ledger")).toContainText(
      "Local VPS (Verified)",
    );
    await p.getByRole("button", { name: "All", exact: true }).click();
    for (const [width, height] of [
      [1280, 800],
      [1366, 768],
      [1545, 911],
      [1920, 1080],
    ]) {
      await p.setViewportSize({ width, height });
      await go("performance", "performance-live");
      await expect(p.getByTestId("readout-bar")).toContainText(/Chunks\s*\d+/);
      await expect(p.getByTestId("readout-bar")).toContainText(
        /Entities\s*\d+/,
      );
      const r = await p.getByTestId("readout-bar").evaluate((el) => {
        const b = el.getBoundingClientRect();
        return {
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          worst: Math.max(
            ...[...el.children].map(
              (c) => c.getBoundingClientRect().right - b.right,
            ),
          ),
          barHeight: b.height,
          pageScrollHeight: document.scrollingElement.scrollHeight,
          canvasScrollHeight: document.querySelector(".pp-canvas").scrollHeight,
        };
      });
      assert.ok(
        r.scrollWidth <= r.clientWidth && r.worst <= 0.5,
        JSON.stringify({ theme, width, ...r }),
      );
      // The baseline already scrolls internally. The page itself remains exactly viewport-sized.
      assert.ok(r.pageScrollHeight <= height);
      readouts.push({ theme, width, height, ...r });
      mark("readoutBarNoClip");
      await p.screenshot({
        path: `${out}/states/v60-readout-${theme}-${width}.png`,
        fullPage: true,
      });
    }
    for (const [width, height] of [
      [1024, 800],
      [1280, 800],
      [1545, 911],
      [1920, 1080],
      [390, 844],
    ]) {
      await p.setViewportSize({ width, height });
      for (const route of ROUTES) {
        await go(route, "countdown-backup-active");
        await expect(p.getByTestId("countdown-pill")).toBeVisible();
        const r = await p.locator('header[role="banner"]').evaluate((el) => ({
          height: el.getBoundingClientRect().height,
          overflow: document.documentElement.scrollWidth > innerWidth,
          controlsFit: [
            ...el.querySelectorAll(".pp-power-group,.pp-countdown-pill"),
          ].every((child) => {
            const a = el.getBoundingClientRect(),
              b = child.getBoundingClientRect();
            return (
              b.right <= a.right + 0.5 &&
              b.bottom <= a.bottom + 0.5 &&
              b.top >= a.top - 0.5
            );
          }),
        }));
        assert.equal(r.height, 56);
        assert.ok(r.controlsFit, `${route} countdown controls fit at ${width}`);
        assert.ok(!r.overflow, `${route} countdown overflow at ${width}`);
        headers.push({ theme, width, route, ...r });
        mark("headerHeight56WithCountdown");
        assert.equal(await p.locator("p.gate-reason").count(), 0);
        mark("gateReasonInlineZero");
      }
      console.log(
        `PASS v6 ${theme} ${width}: countdown geometry on all 8 routes`,
      );
    }
    await p.setViewportSize({ width: 1545, height: 911 });
    await go("overview", "backups-recovery-required");
    const qb = p.getByRole("button", { name: "Quick Backup", exact: true });
    await expect(qb).toHaveAttribute("aria-disabled", "true");
    await qb.focus();
    await expect(p.getByRole("tooltip")).toContainText(
      "Host recovery gate is active — resolve on Backups page.",
    );
    await qb.press("Enter");
    await expect(p).toHaveURL(/\/backups$/);
    await go("overview", "backups-healthy");
    await expect(
      p.getByRole("button", { name: "Quick Backup", exact: true }),
    ).not.toHaveAttribute("aria-disabled", "true");
    await p.getByRole("button", { name: "Quick Backup", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await calls()).find((x) => x.action === "backup.create")?.params,
      )
      .toMatchObject({ destinationMode: "AUTO", countdownSeconds: 300 });
    await go("overview", "overview-one-player");
    await p
      .getByRole("button", { name: "Inspect NEGUINCOMCEROL", exact: true })
      .first()
      .click();
    await expect(p).toHaveURL(/\/players$/);
    await expect(p.getByTestId("player-inspector")).toContainText(
      "NEGUINCOMCEROL",
    );
    // Reload via a fixture-bearing document; production-style URLs intentionally do not seed fixtures.
    await go("players", "overview-one-player");
    await expect(p.getByTestId("player-inspector")).toContainText(
      "NEGUINCOMCEROL",
    );
    await go("overview", "overview-one-player");
    await p.getByRole("tab", { name: "Player events", exact: true }).click();
    await p
      .getByTestId("player-events")
      .getByRole("button", { name: /Inspect neguincomcerol/i })
      .first()
      .press("Enter");
    await expect(p).toHaveURL(/\/players$/);
    await expect(p.getByTestId("player-inspector")).toContainText(
      "NEGUINCOMCEROL",
    );
    violations = (await new AxeBuilder({ page: p }).analyze()).violations;
    assert.deepEqual(violations, [], `${theme} player events axe`);
    await p.evaluate(() =>
      localStorage.setItem(
        "plexon:view-sync",
        JSON.stringify({
          ...JSON.parse(localStorage.getItem("plexon:view-sync") ?? "{}"),
          selectedPlayerUuid: "name:nobody",
        }),
      ),
    );
    await go("players", "overview-one-player");
    // Next includes an empty assertive route-announcer at baseline; it is not an application error.
    assert.equal(
      await p.locator('[role="alert"]:not(#__next-route-announcer__)').count(),
      0,
    );
    console.log(
      `PASS v6 ${theme}: gates, schedule, readouts, 40 countdown headers, and player navigation`,
    );
    await c.close();
  }
  assert.deepEqual(errors, []);
  const receipt = {
    result: "PASS",
    invariants,
    readouts,
    headers,
    screens,
    stateAccessibility: { recovery: recoveryViews, schedule: scheduleViews },
    errors,
    compatibility: {
      legacyHost: true,
      restoreAcknowledgement: true,
      localOnly: true,
      quickBackup: true,
      clickToInspect: true,
    },
  };
  await fs.writeFile(
    out + "/durability-v60-receipt.json",
    JSON.stringify(receipt, null, 2),
  );
  return receipt;
}
