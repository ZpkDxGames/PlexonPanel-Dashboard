// Administrator-only staging tool. Standard output contains the short-lived private code.
import { randomInt, randomUUID } from "node:crypto";
import { ENROLLMENT_WINDOW_MS } from "../dist/standalone/bedrock-config.js";
import { pairingLookupId } from "../dist/security.js";

if (process.argv.length !== 2 || !process.env.PAIRING_CODE_PEPPER || process.env.PAIRING_CODE_PEPPER.length < 32) {
  console.error("Set PAIRING_CODE_PEPPER privately and run without arguments.");
  process.exitCode = 1;
} else {
  const code = String(randomInt(1_000_000)).padStart(6, "0");
  const issuedAt = Date.now();
  const lookupId = await pairingLookupId(code, process.env.PAIRING_CODE_PEPPER);
  process.stdout.write(`${JSON.stringify({ code, enrollment: {
    id: randomUUID(), lookupId, issuedAt, expiresAt: issuedAt + ENROLLMENT_WINDOW_MS,
  } }, null, 2)}\n`);
}
