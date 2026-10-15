import { firefox, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4173",
  browser = await firefox.launch(),
  context = await browser.newContext();
await context.route("**/*", (route) =>
  new URL(route.request().url()).origin === base
    ? route.continue()
    : route.abort("blockedbyclient"),
);
await context.addInitScript(() =>
  localStorage.setItem(
    "plexon:preferences",
    JSON.stringify({ motion: "off", skinProvider: "disabled" }),
  ),
);
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(`${base}/?fixture=healthy#Overview`);
  await page.locator(".workspace-heading h1").waitFor();
  await page.locator(".route-skeleton").waitFor({ state: "detached" });
  await page.evaluate(async () => {
    const { session } = await import("/src/adapter/session.ts");
    const execute = session.execute;
    window.reviewCalls = [];
    session.execute = async function (prepared, confirmed) {
      window.reviewCalls.push({
        action: prepared.action,
        kind: prepared.kind,
        confirmed,
      });
      return execute.call(this, prepared, confirmed);
    };
  });
  async function route(name) {
    await page.evaluate((name) => {
      location.hash = name;
    }, name);
    await expect(page.locator(".workspace-heading h1")).toContainText(
      name === "Access" ? "Access" : name,
    );
    await page.locator(".route-skeleton").waitFor({ state: "detached" });
  }
  async function dispatch() {
    const dialog = page.locator("dialog.review-dialog");
    await dialog.getByRole("button", { name: "Dispatch operation" }).click();
    await expect(dialog).toContainText("Agent result received");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await dispatch();
  await route("Console");
  await page.getByLabel("Server command", { exact: true }).fill("list");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await dispatch();
  await route("Backups");
  await expect(
    page.getByRole("button", { name: "Review new backup", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Review new backup", exact: true })
    .click();
  await dispatch();
  await route("Access");
  await page.getByRole("button", { name: /Paired devices/ }).click();
  await page.getByRole("button", { name: "Review revoke" }).last().click();
  await dispatch();
  await route("Players");
  await page.locator(".player-row").first().click();
  await page.getByRole("button", { name: "Moderate", exact: true }).click();
  await page.getByRole("button", { name: "Ban", exact: true }).click();
  const dialog = page.locator("dialog.review-dialog");
  await expect(
    dialog.getByRole("button", { name: "Dispatch operation" }),
  ).toBeDisabled();
  const subject = await dialog.locator("label strong").textContent();
  await dialog.locator("input").fill(subject);
  await dispatch();
  const calls = await page.evaluate(() =>
    window.reviewCalls.filter((call) =>
      [
        "server.restart",
        "console.execute",
        "maintenance.full-backup.create",
        "devices.revoke",
        "player.ban",
      ].includes(call.action),
    ),
  );
  expect(calls).toHaveLength(5);
  expect(calls.every((call) => call.confirmed === true)).toBe(true);
  expect(errors).toEqual([]);
  await mkdir("artifacts/acceptance", { recursive: true });
  await writeFile(
    "artifacts/acceptance/review-confirmation.json",
    JSON.stringify(
      {
        environment:
          "Development fixtures, localhost only; spy on reviewed session.execute argument, no live wire dispatch",
        calls,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: five reviewed operations send required confirmation; typed ban safeguard retained.",
  );
} finally {
  await browser.close();
}
