import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const out = process.env.EVIDENCE_DIR ?? "artifacts/v5";
await fs.mkdir(`${out}/states`, { recursive: true });
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "4180"],
  { stdio: "ignore" },
);
let browser;
try {
  for (let i = 0; i < 200; i++) {
    try {
      await fetch("http://127.0.0.1:4180");
      break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? chromium.executablePath(),
    args: ["--no-sandbox"],
  });
  const c = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    }),
    p = await c.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const response = await p.goto(
    "http://127.0.0.1:4180/overview?fixture=healthy",
  );
  await p
    .getByRole("heading", { name: "Connect your server", exact: true })
    .waitFor();
  assert.equal(await p.locator('[data-slot="viz"]').count(), 0);
  const headers = response.headers(),
    csp = headers["content-security-policy"];
  assert.match(csp, /'nonce-[^']+'/);
  assert.ok(!csp.includes("unsafe-eval"));
  assert.match(
    csp,
    /connect-src 'self' https:\/\/tonimserver\.ddns\.net wss:\/\/tonimserver\.ddns\.net;/,
  );
  assert.doesNotMatch(csp, /connect-src[^;]*\*/);
  assert.match(headers["cache-control"], /no-store/);
  assert.ok(
    !(await p.locator("body").innerText()).includes("DEVELOPMENT FIXTURE"),
  );
  const violations = (
    await new AxeBuilder({ page: p }).analyze()
  ).violations.filter((v) => ["serious", "critical"].includes(v.impact));
  assert.deepEqual(
    violations.map((v) => v.id),
    [],
  );
  assert.equal(
    (
      await p.request.get("http://127.0.0.1:4180/api/skins/not-a-uuid")
    ).status(),
    400,
  );
  assert.deepEqual(errors, []);
  await p.screenshot({
    path: `${out}/states/production-pairing.png`,
    fullPage: true,
  });
  const receipt = {
    productionHydrates: true,
    fixtureQueryIgnored: true,
    nonceCsp: true,
    verifiedRelayOriginsOnly: true,
    unsafeEvalAbsent: true,
    noStore: true,
    invalidAvatarUuid: 400,
    seriousCriticalAxe: violations.length,
    errors,
  };
  await fs.writeFile(
    `${out}/production-receipt.json`,
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify(receipt));
} finally {
  await browser?.close();
  server.kill();
}
