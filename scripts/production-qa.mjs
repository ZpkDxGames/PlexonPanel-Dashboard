import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const out = process.env.EVIDENCE_DIR ?? "../evidence",
  base = "http://127.0.0.1:4180";
await fs.mkdir(out + "/states", { recursive: true });
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "4180"],
  { stdio: "ignore" },
);
let b;
try {
  for (let i = 0; i < 80; i++) {
    try {
      await fetch(base + "/pair", { signal: AbortSignal.timeout(1000) });
      break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  b = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? chromium.executablePath(),
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({ viewport: { width: 1545, height: 911 } }),
    p = await c.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const response = await p.goto(base + "/overview?fixture=structural");
  await expect(
    p.getByRole("heading", { name: "Pair this browser." }),
  ).toBeVisible();
  assert.equal(await p.locator(".pp-shell").count(), 0);
  const csp = response.headers()["content-security-policy"];
  assert.match(csp, /'nonce-[^']+'/);
  assert.ok(!csp.includes("unsafe-eval"));
  assert.doesNotMatch(csp, /connect-src[^;]*\*/);
  assert.match(response.headers()["cache-control"], /no-store/);
  assert.equal(
    (await p.request.get(base + "/api/skins/not-a-uuid")).status(),
    400,
  );
  assert.deepEqual(
    (await new AxeBuilder({ page: p }).analyze()).violations,
    [],
  );
  assert.deepEqual(errors, []);
  await p.screenshot({ path: out + "/states/production-pairing.png" });
  const receipt = {
    productionHydrates: true,
    unpairedRedirect: "/pair",
    fixtureQueryIgnored: true,
    nonceCsp: true,
    unsafeEvalAbsent: true,
    connectOriginsRestricted: true,
    noStore: true,
    invalidAvatarUuid: 400,
    axe: [],
    errors,
  };
  await fs.writeFile(
    out + "/production-receipt.json",
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify(receipt));
} finally {
  await b?.close();
  server.kill();
}
