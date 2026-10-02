// Local developer fixture only. It never starts Minecraft, controls systemd or uses deployed credentials.
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createFleetFixture } from "./support/fleet-fixture.mjs";
const credentialsPath = ".test-dist/fleet-browser-credentials.json";
const statsPath = ".test-dist/fleet-browser-stats.json";
let fixture, timer;
try {
  await mkdir(".test-dist", { recursive: true });
  fixture = await createFleetFixture({ port: 8788 });
  await writeFile(credentialsPath, JSON.stringify(fixture.credentials), { mode: 0o600 });
  timer = setInterval(() => { void writeFile(statsPath, JSON.stringify({ requests: fixture.requests }), { mode: 0o600 }); }, 500);
  console.log("Local simulated fleet fixture ready; Paper/Host payloads are signed; production is untouched.");
  await new Promise(resolve => { process.once("SIGTERM", resolve); process.once("SIGINT", resolve); });
} catch {
  console.error("LOCAL_FLEET_FIXTURE_FAILED"); process.exitCode = 1;
} finally {
  clearInterval(timer);
  if (fixture) await fixture.close();
  await unlink(credentialsPath).catch(() => {});
}
