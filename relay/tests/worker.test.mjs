import assert from "node:assert/strict";
import { test } from "node:test";

import relayWorker from "../dist/index.js";
import { verifyDashboardAccess } from "../dist/security.js";

const env = {
  DASHBOARD_ORIGINS: "https://dashboard.example",
  PAIRING_CODE_PEPPER: "pairing-test-secret-with-enough-entropy",
  ACCESS_TOKEN_SECRET: "access-test-secret-with-enough-entropy",
  GATEWAY_ED25519_PRIVATE_KEY: "unused",
  GATEWAY_ED25519_PUBLIC_KEY: "public-test-key",
};

test("health describes coordination-only storage", async () => {
  const response = await relayWorker.fetch(
    new Request("https://relay.example/healthz"),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "plexonpanel-relay",
    version: "3.0.2",
    protocolVersion: 3,
    storage: "coordination-only",
    gatewayPublicKey: "public-test-key",
  });
});

test("pairing rejects a non-allowlisted browser before lookup", async () => {
  const response = await relayWorker.fetch(
    new Request("https://relay.example/v1/pairings/claim", {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "123456" }),
    }),
    env,
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("pairing returns a bounded error for invalid JSON", async () => {
  const response = await relayWorker.fetch(
    new Request("https://relay.example/v1/pairings/claim", {
      method: "POST",
      headers: {
        Origin: "https://dashboard.example",
        "Content-Type": "application/json",
      },
      body: "not-json",
    }),
    env,
  );
  assert.equal(response.status, 400);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "https://dashboard.example",
  );
  assert.match((await response.json()).error, /valid JSON/);
});

test("dashboard session validation requires a credential", async () => {
  const response = await relayWorker.fetch(
    new Request("https://relay.example/v1/dashboard/session", {
      headers: { Origin: "https://dashboard.example" },
    }),
    env,
  );
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /credential is required/);
});

test("pairing issues a scoped credential only after the room consumes its challenge", async () => {
  const serverId = "a7d87ad5-1a72-4a0e-9722-7499d92d829e";
  let claimed = false;
  const registration = {
    lookupId: "lookup",
    serverId,
    requestId: "46e77257-7439-47fa-a1a8-af4eb0f3dc48",
    challengeId: "63301a8b-b4e1-4ef7-886b-a87f2b96b22e",
    fingerprint: "AA:BB:CC",
    expiresAt: Date.now() + 60_000,
  };
  const pairingDirectory = {
    idFromName: (name) => name,
    get: () => ({
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (path === "/resolve") return Response.json(registration);
        if (path === "/delete") return Response.json({ ok: true });
        return Response.json({ ok: false }, { status: 404 });
      },
    }),
  };
  const serverRooms = {
    idFromName: (name) => name,
    get: () => ({
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (path === "/validate") {
          const validation = await request.json();
          return validation.access?.generation === 7
            ? Response.json({ ok: true })
            : Response.json({ ok: false }, { status: 403 });
        }
        if (path !== "/claim" || claimed) {
          return Response.json({ ok: false }, { status: 403 });
        }
        claimed = true;
        const claim = await request.json();
        const now = Math.floor(Date.now() / 1000);
        return Response.json({
          generation: 7,
          fingerprint: registration.fingerprint,
          device: {
            deviceId: claim.deviceId,
            name: claim.name,
            role: "Observer",
            scopes: ["telemetry.view"],
            issuedAt: now,
            expiresAt: now + 3600,
            lastSeen: now,
          },
        });
      },
    }),
  };
  const pairedEnv = {
    ...env,
    PAIRING_DIRECTORY: pairingDirectory,
    SERVER_ROOMS: serverRooms,
  };
  const response = await relayWorker.fetch(
    new Request("https://relay.example/v1/pairings/claim", {
      method: "POST",
      headers: {
        Origin: "https://dashboard.example",
        "CF-Connecting-IP": "203.0.113.10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "123456" }),
    }),
    pairedEnv,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.serverId, serverId);
  assert.equal(body.fingerprint, registration.fingerprint);
  assert.match(body.websocketUrl, /^wss:\/\/relay\.example\/v1\/dashboard$/);
  const access = await verifyDashboardAccess(
    body.accessToken,
    pairedEnv.ACCESS_TOKEN_SECRET,
  );
  assert.equal(access.serverId, serverId);
  assert.equal(access.generation, 7);

  const session = await relayWorker.fetch(
    new Request("https://relay.example/v1/dashboard/session", {
      headers: {
        Origin: "https://dashboard.example",
        Authorization: `Bearer ${body.accessToken}`,
      },
    }),
    pairedEnv,
  );
  assert.equal(session.status, 200);
  assert.equal((await session.json()).serverId, serverId);

  const replay = await relayWorker.fetch(
    new Request("https://relay.example/v1/pairings/claim", {
      method: "POST",
      headers: {
        Origin: "https://dashboard.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "123456" }),
    }),
    pairedEnv,
  );
  assert.equal(replay.status, 403);
});

test("pairing does not accept client-selected roles or scopes", async () => {
  for (const extra of [
    { role: "Owner" },
    { scopes: ["files.write"] },
    { generation: 99 },
  ]) {
    const response = await relayWorker.fetch(
      new Request("https://relay.example/v1/pairings/claim", {
        method: "POST",
        headers: { Origin: "https://dashboard.example" },
        body: JSON.stringify({ code: "123456", ...extra }),
      }),
      env,
    );
    assert.equal(response.status, 400);
  }
});
test("chunked pairing payloads are bounded without Content-Length", async () => {
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode("x".repeat(5000)));
      c.close();
    },
  });
  const response = await relayWorker.fetch(
    new Request("https://relay.example/v1/pairings/claim", {
      method: "POST",
      headers: { Origin: "https://dashboard.example" },
      body,
      duplex: "half",
    }),
    env,
  );
  assert.equal(response.status, 400);
});
