// Loopback developer fixture. No Minecraft, systemd, RCON or deployed credentials are used.
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { createFleetFixture } from "./support/fleet-fixture.mjs";
const credentialsPath = ".test-dist/fleet-browser-credentials.json";
const statsPath = ".test-dist/fleet-browser-stats.json";
let fixture, timer, controls;
try {
  await mkdir(".test-dist", { recursive: true });
  fixture = await createFleetFixture({ port: 8788, names: ["PlexonCraft", "TonimSMP"], instanceKeys: ["plexoncraft", "tonimsmp"] });
  await writeFile(credentialsPath, JSON.stringify(fixture.credentials), { mode: 0o600 });
  timer = setInterval(() => { void writeFile(statsPath, JSON.stringify({ requests: fixture.requests }), { mode: 0o600 }); }, 500);
  // Scenario controls exist only in this explicit test process, never in the relay or Dashboard.
  controls = createServer(async (request, response) => {
    try {
      if (request.method !== "POST" || request.url !== "/scenario") { response.writeHead(404).end(); return; }
      const chunks = []; let length = 0;
      for await (const chunk of request) { length += chunk.length; if (length > 1024) throw new Error("LIMIT"); chunks.push(chunk); }
      const { index = 0, scenario } = JSON.parse(Buffer.concat(chunks).toString());
      const room = fixture.rooms[index]; if (!room) throw new Error("ROOM");
      if (scenario === "stopped" || scenario === "paper-disconnected") {
        room.serviceState = scenario === "stopped" ? "inactive" : "active";
        if (room.paper.socket.readyState < 2) { const closed = once(room.paper.socket, "close"); room.paper.socket.close(); await closed; }
      } else if (scenario === "host-disconnected") {
        if (room.host.socket.readyState < 2) { const closed = once(room.host.socket, "close"); room.host.socket.close(); await closed; }
      } else if (scenario === "online") {
        room.serviceState = "active";
        if (room.paper.socket.readyState !== 1) { await fixture.attach(room, "PAPER"); await fixture.sync(room); }
        if (room.host.socket.readyState !== 1) await fixture.attach(room, "HOST");
      } else if (scenario === "revoked") {
        await fixture.sync(room, []);
      } else if (scenario === "relay-unavailable") {
        await fixture.close();
      } else throw new Error("SCENARIO");
      if (scenario !== "relay-unavailable") await fixture.telemetry();
      response.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');
    } catch { response.writeHead(400).end('{"ok":false}'); }
  });
  controls.listen(8789, "127.0.0.1"); await once(controls, "listening");
  console.log("Local signed simulated fleet ready (relay 8788, scenario controls 8789); production is untouched.");
  await new Promise(resolve => { process.once("SIGTERM", resolve); process.once("SIGINT", resolve); });
} catch {
  console.error("LOCAL_FLEET_FIXTURE_FAILED"); process.exitCode = 1;
} finally {
  clearInterval(timer);
  controls?.close();
  if (fixture) await fixture.close();
  await unlink(credentialsPath).catch(() => {});
  await unlink(statsPath).catch(() => {});
}
