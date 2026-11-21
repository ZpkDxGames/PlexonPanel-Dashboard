import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, open, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";
import { createMixedFixture } from "../relay/tests/support/bedrock-fixture.mjs";

const port = Number(process.env.BEDROCK_QA_DASHBOARD_PORT ?? 4189);
const web = `http://127.0.0.1:${port}`;
const evidence = process.env.EVIDENCE_DIR ?? "../bedrock-evidence";
await mkdir(evidence, { recursive: true });
const log = await open(`${evidence}/dashboard-development.log`, "w");
const fixture = await createMixedFixture({ origin: web, port: 0 });
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "-H",
    "127.0.0.1",
    "-p",
    String(port),
  ],
  {
    env: { ...process.env, NEXT_PUBLIC_PLEXON_RELAY_URL: fixture.base },
    stdio: ["ignore", log.fd, log.fd],
    detached: true,
  },
);
let browser;
const receipts = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function seedJavaCredentials(page) {
  // Fixture credentials are minted and enforced by the same relay used for the live browser claim.
  await page.evaluate(
    (credentials) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("plexonpanel-browser-v3", 2);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("workspace"))
            request.result.createObjectStore("workspace");
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("workspace", "readwrite");
          for (const credential of credentials)
            tx.objectStore("workspace").put(
              credential,
              `credential:${credential.serverId}`,
            );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    fixture.credentials,
  );
}

try {
  let response;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      response = await fetch(web + "/pair", {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) break;
    } catch {
      /* Next compiles the local entry route on its first visit. */
    }
    if (server.exitCode !== null)
      throw new Error("Dashboard dev server exited during startup");
    await pause(300);
  }
  assert.ok(response?.ok, "Dashboard pairing page started");
  const relay = new URL(fixture.base);
  assert.ok(
    response.headers
      .get("Content-Security-Policy")
      .includes(` ${relay.origin} ws://${relay.host};`),
  );

  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? chromium.executablePath(),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1545, height: 911 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (entry) => {
    if (/violates the following Content Security Policy/i.test(entry.text()))
      errors.push(entry.text());
  });
  await page.goto(web + "/pair");
  await seedJavaCredentials(page);
  await expect(
    page.getByRole("textbox", { name: "Relay HTTPS endpoint" }),
  ).toHaveValue(fixture.base);
  for (const [index, digit] of [...fixture.code].entries())
    await page
      .getByRole("textbox", {
        name: `Pairing code digit ${index + 1}`,
        exact: true,
      })
      .fill(digit);

  const claim = page.waitForResponse(
    (r) => r.url() === fixture.base + "/v1/pairings/claim",
  );
  await page.getByRole("button", { name: "Claim device" }).click();
  assert.equal((await claim).status(), 200);
  await expect(page).toHaveURL(web + "/overview", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "TonimBedrock" })).toBeVisible(
    { timeout: 30_000 },
  );
  const container = page
    .getByRole("heading", { name: "Container telemetry" })
    .locator("..")
    .locator("..");
  await expect(container.getByText("running", { exact: true })).toBeVisible();
  await expect(
    container.getByText("Unverified", { exact: true }),
  ).toBeVisible();
  await expect(container.getByText(/%$/)).toBeVisible();
  await expect(container.getByText(/GiB/)).toBeVisible();
  await expect(page.getByRole("group", { name: "Server power" })).toHaveCount(
    0,
  );
  await page.screenshot({ path: `${evidence}/bedrock-overview-desktop.png` });
  receipts.push(
    "Browser claimed a real loopback relay Bedrock grant and rendered signed container evidence",
  );

  await page.getByRole("link", { name: "Open console" }).click();
  const stream = page.getByRole("log", { name: "Bedrock Docker logs" });
  await expect(
    page.getByText("Recent Docker logs", { exact: true }),
  ).toBeVisible();
  await expect(stream.locator(".pp-bedrock-log").first()).toBeVisible();
  const line = await stream.locator(".pp-crow__msg").first().textContent();
  const filter = page.getByRole("textbox", { name: "Filter Bedrock logs" });
  await filter.fill("fixture-filter-no-match");
  await expect(stream.getByText("No matching log lines")).toBeVisible();
  await filter.fill(line);
  await expect(stream.getByText(line, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chat" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Plugins" })).toHaveCount(0);
  const consoleAxe = (await new AxeBuilder({ page }).analyze()).violations;
  assert.equal(
    consoleAxe.length,
    0,
    JSON.stringify(consoleAxe.map(({ id }) => id)),
  );
  receipts.push(
    "Authenticated Docker logs render as plain text with a functional filter and no command composer",
  );

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Fleet" })
    .click();
  const cards = page.locator(".pp-blade");
  await expect(cards).toHaveCount(4, { timeout: 30_000 });
  const bedrock = cards.filter({ hasText: "TonimBedrock" });
  await expect(bedrock.getByText(/^container ram$/i)).toBeVisible();
  await expect(bedrock.getByText("TPS", { exact: true })).toHaveCount(0);
  for (const room of fixture.rooms) {
    const paper = cards.filter({ hasText: room.name });
    await expect(paper.getByText("TPS", { exact: true })).toBeVisible();
    await expect(paper.getByText("HEAP", { exact: true })).toBeVisible();
  }
  const nodes = page.getByRole("region", { name: "Node hardware ledger" });
  await expect(
    nodes.getByText("4 instance(s)", { exact: false }),
  ).toBeVisible();
  await expect(nodes.locator(".pp-node")).toHaveCount(1);
  await page.screenshot({ path: `${evidence}/fleet-mixed-desktop.png` });
  receipts.push(
    "Four independently authenticated rooms share one node ledger and retain edition-specific fleet metrics",
  );

  await page.getByRole("combobox", { name: "Active server" }).click();
  await page.getByRole("option", { name: fixture.rooms[0].name }).click();
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Console & chat" })
    .click();
  await expect(
    page.getByRole("tab", { name: "Chat", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Plugins", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("log", { name: "Bedrock Docker logs" }),
  ).toHaveCount(0);
  await page.getByRole("combobox", { name: "Active server" }).click();
  await page.getByRole("option", { name: "TonimBedrock · Bedrock" }).click();
  await expect(stream.locator(".pp-bedrock-log").first()).toBeVisible();
  receipts.push(
    "Switching Java → Bedrock rebinds authority and restores the correct console without cross-room logs",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const preferences = JSON.parse(
      localStorage.getItem("plexon:preferences") ?? "{}",
    );
    localStorage.setItem(
      "plexon:preferences",
      JSON.stringify({ ...preferences, theme: "light" }),
    );
  });
  await page.goto(web + "/console");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(stream.locator(".pp-bedrock-log").first()).toBeVisible();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const mobileAxe = (await new AxeBuilder({ page }).analyze()).violations;
  assert.equal(
    mobileAxe.length,
    0,
    JSON.stringify(mobileAxe.map(({ id }) => id)),
  );
  await page.screenshot({ path: `${evidence}/bedrock-console-mobile.png` });
  assert.deepEqual(errors, []);
  receipts.push(
    "390px light-theme console fits the viewport and passes axe with no page errors",
  );

  await writeFile(
    `${evidence}/bedrock-browser-receipt.json`,
    JSON.stringify({ receipts }, null, 2) + "\n",
  );
  console.log(receipts.join("\n"));
} finally {
  await browser?.close();
  await fixture.close();
  if (server.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* Already exited. */
    }
  }
  await log.close();
}
