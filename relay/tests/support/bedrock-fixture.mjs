import assert from "node:assert/strict";
import { generateKeyPairSync, randomInt, randomUUID, sign } from "node:crypto";
import { once } from "node:events";
import { FLEET_CONTRACT_ID } from "../../dist/fleet-contract.js";
import { importAgentPublicKey, publicKeyFingerprint, signEnvelope, verifyEnvelope } from "../../dist/protocol.js";
import { parseBedrockConfig } from "../../dist/standalone/bedrock-config.js";
import { createFleetFixture, inbox } from "./fleet-fixture.mjs";

export function hostKeys() {
  const pair = generateKeyPairSync("ed25519");
  return { raw: pair.privateKey,
    privateKey: pair.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    publicKey: pair.publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  };
}

export async function createMixedFixture(options = {}) {
  const { autoHost = true, ...fleetOptions } = options;
  const keys = hostKeys();
  const code = String(randomInt(1_000_000)).padStart(6, "0");
  let registration;
  const fleet = await createFleetFixture({ ...fleetOptions, paperRooms: 3, bedrock: async ({ nodeId, pairingLookup }) => {
    const issuedAt = Date.now();
    registration = parseBedrockConfig({ serverId: randomUUID(), nodeId, instanceKey: "tonimbedrock",
      publicKey: keys.publicKey, generation: 1, enrollment: {
        id: randomUUID(), lookupId: await pairingLookup(code), issuedAt, expiresAt: issuedAt + 180_000,
      } });
    return registration;
  } });
  const sockets = new Set();
  const relayKey = await importAgentPublicKey(fleet.relayPublicKey);
  let interval;
  const base = fleet.base.replace("http:", "ws:");
  const identity = { bedrockContract: "bedrock-host-v1", nodeId: registration.nodeId,
    instanceKey: registration.instanceKey, edition: "BEDROCK", runtime: "DOCKER" };
  async function attach({ key = keys, overrides = {}, visibleKey = registration.publicKey, authenticate = true } = {}) {
    const socket = new WebSocket(`${base}/v1/agent?serverId=${registration.serverId}&agentKind=BEDROCK_HOST`, {
      headers: { "X-PlexonPanel-Protocol": "3" },
    });
    sockets.add(socket); socket.addEventListener("close", () => sockets.delete(socket));
    const next = inbox(socket, true);
    await once(socket, "open");
    const session = randomUUID();
    let sequence = 0;
    const encode = (type, body) => signEnvelope(type, registration.serverId,
      { ...identity, _session: session, _sequence: ++sequence, ...body }, key.privateKey);
    const send = async (type, body) => { const wire = await encode(type, body); socket.send(wire); return wire; };
    await send("agent.hello", { agentKind: "BEDROCK_HOST", protocolVersion: 3, serverName: "TonimBedrock",
      fleetContract: FLEET_CONTRACT_ID, publicKey: visibleKey, publicKeyFingerprint: await publicKeyFingerprint(visibleKey),
      capabilities: ["bedrock.status.view", "bedrock.logs.view"], ...overrides });
    if (authenticate) {
      const challenge = await next(m => m.envelope.type === "gateway.challenge");
      assert.equal(await verifyEnvelope(challenge.envelope, relayKey), true);
      assert.equal(challenge.body._session, session);
      assert.equal(challenge.envelope.serverId, registration.serverId);
      await send("agent.challenge_response", { nonce: challenge.body.nonce,
        proof: sign(null, Buffer.from(`challenge:${challenge.body.nonce}`), key.raw).toString("base64url") });
      const ack = await next(m => m.envelope.type === "gateway.authenticated");
      assert.equal(await verifyEnvelope(ack.envelope, relayKey), true);
      assert.equal(ack.body._session, session);
      assert.equal(ack.body.nonce, challenge.body.nonce);
    }
    return { socket, next, send, encode, session };
  }
  async function samples(host) {
    const capturedAt = new Date().toISOString();
    await host.send("bedrock.status", { capturedAt, containerState: "running", containerRestartPolicy: "unless-stopped",
      containerImage: "itzg/minecraft-bedrock-server:stable", containerStartedAt: new Date(Date.now() - 60_000).toISOString(),
      containerStatsCapturedAt: capturedAt, containerUptimeSeconds: 59, containerCpuPercent: 137.5, containerMemoryBytes: 524288000,
      containerMemoryLimitBytes: 1073741824, cpuUnit: "PERCENT_OF_ONE_CORE", source: "DOCKER_ENGINE",
      version: "1.26.66.1", versionCapturedAt: new Date(Date.now() - 58_000).toISOString() });
    await host.send("bedrock.logs", { capturedAt, source: "DOCKER_ENGINE", available: true, recentWindow: true,
      lines: [{ capturedAt, stream: "combined", content: "Bedrock fixture ready 🧱", truncated: false }] });
  }
  async function claim(supplied = code) {
    return fetch(`${fleet.base}/v1/pairings/claim`, { method: "POST",
      headers: { Origin: fleet.origin, "Content-Type": "application/json" }, body: JSON.stringify({ code: supplied, name: "Fixture browser" }) });
  }
  async function browser(credential) {
    const socket = new WebSocket(credential.websocketUrl, {
      protocols: ["plexonpanel-v3", `auth.${credential.accessToken}`], headers: { origin: fleet.origin },
    });
    sockets.add(socket); socket.addEventListener("close", () => sockets.delete(socket));
    const next = inbox(socket);
    await once(socket, "open");
    return { socket, next };
  }
  async function close() {
    clearInterval(interval);
    for (const socket of sockets) socket.close();
    await fleet.close();
  }
  try {
    const host = autoHost ? await attach() : undefined;
    if (host) {
      await samples(host);
      interval = setInterval(() => { if (host.socket.readyState === WebSocket.OPEN) void samples(host).catch(() => {}); }, 1_000);
    }
    return { ...fleet, registration, code, host, attach, samples, browser, javaBrowser: fleet.browser, claim, close };
  } catch (error) { await close(); throw error; }
}
