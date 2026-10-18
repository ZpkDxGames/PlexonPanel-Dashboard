import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import assert from "node:assert/strict";
import { WebSocketServer } from "ws";
import { harness, project } from "./v5-harness.mjs";
import { SCOPES, ACTION_CONTRACT_ID } from "../src/adapter/scopes.ts";
const java = spawn(
  process.env.PLEXON_JAVA ?? "java",
  [
    "--enable-native-access=ALL-UNNAMED",
    "--class-path",
    process.env.PLEXON_HOST_JAR ??
      `${project}/../PlexonPanel-main/host-agent/build/libs/plexonpanel-host-5.0.0.jar`,
    `${project}/scripts/contracts/HostStoreDriver.java`,
    mkdtempSync(`${tmpdir()}/plexon-sqlite-contract-`),
  ],
  { stdio: ["pipe", "pipe", "inherit"] },
);
let next = 1;
const waiting = new Map();
createInterface({ input: java.stdout }).on("line", (line) => {
  try {
    const value = JSON.parse(line),
      pending = waiting.get(value.id);
    if (pending) {
      waiting.delete(value.id);
      clearTimeout(pending.timer);
      value.error
        ? pending.reject(Error(value.error))
        : pending.resolve(value.data);
    }
  } catch {}
});
const store = (action, parameters = {}) =>
  new Promise((resolve, reject) => {
    const id = next++;
    waiting.set(id, {
      resolve,
      reject,
      timer: setTimeout(
        () => reject(Error("Java SQLite driver timeout")),
        30000,
      ),
    });
    java.stdin.write(JSON.stringify({ id, action, parameters }) + "\n");
  });
const serverId = "12345678-1234-1234-1234-123456789abc",
  deviceId = "12345678-1234-1234-1234-123456789def",
  token = "synthetic-loopback-only",
  expiresAt = new Date(Date.now() + 600000).toISOString(),
  cap = Object.fromEntries(SCOPES.map((s) => [s, true]));
const ready = {
  type: "dashboard.ready",
  protocolVersion: 3,
  actionContract: ACTION_CONTRACT_ID,
  serverId,
  device: {
    deviceId,
    name: "Contract browser",
    role: "Owner",
    scopes: SCOPES,
    issuedAt: Date.now(),
    expiresAt: Date.parse(expiresAt),
    lastSeen: Date.now(),
  },
  agents: { paper: true, host: true, hostInstalled: true },
  consoleAuthority: "HOST",
  server: {
    serverName: "Local SQLite contract",
    fingerprint: "synthetic",
    pluginVersion: "5.0.0",
    hostVersion: "5.0.0",
    minecraftVersion: "26.2",
    capabilities: cap,
    paperCapabilities: cap,
    hostCapabilities: cap,
    paperSession: "contract-paper",
    hostSession: "contract-host",
    paperTargetCompatible: true,
    hostTargetCompatible: true,
  },
};
const settings = {
  schemaVersion: 1,
  timezone: "UTC",
  schedule: {
    backups: {
      enabled: false,
      cadence: "DAILY",
      weekdays: [],
      time: "04:00",
      intervalHours: 24,
      countdownMinutes: 15,
      skipIfEmptySinceLastBackup: false,
      forceAfterHours: 168,
    },
  },
  restart: {
    schedule: { enabled: false, type: "DAILY", weekdays: [], time: "04:00" },
    warningSeconds: [300],
    stopTimeoutSeconds: 180,
    startupTimeoutSeconds: 180,
  },
  fullRestorePoint: {
    retentionMode: "SINGLE_CURRENT",
    retentionCount: 1,
    restartAfter: true,
    canonicalFilename: "Server-Latest.zip",
    uploadTimeoutSeconds: 1800,
    verificationMode: "SIZE_AND_HASH_WHEN_AVAILABLE",
    maximumBytes: 1099511627776,
    excludes: [
      "logs",
      "crash-reports",
      "cache",
      ".cache",
      "plugins/PlexonPanel/audit",
      "plugins/PlexonPanel/identity",
      "plugins/spark/tmp",
    ],
    localRetentionPolicy: "REMOTE_ONLY_AFTER_VERIFY",
  },
};
let epoch = await store("boot", { epoch: "a".repeat(32) }),
  historyReads = 0,
  settingsMutations = 0;
await store("console", { content: "SQLite history survives browser reload" });
await store("presence", {
  eventId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  uuid: crypto.randomUUID(),
  name: "ContractPlayer",
  state: "JOINED",
  observedAt: new Date().toISOString(),
  sessionStartedAt: new Date().toISOString(),
  termination: "OPEN",
});
let relayOrigin = "";
const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/v1/pairings/claim") {
    req.resume();
    res.end(
      JSON.stringify({
        ok: true,
        protocolVersion: 3,
        serverId,
        deviceId,
        name: "Contract browser",
        role: "Owner",
        scopes: SCOPES,
        accessToken: token,
        websocketUrl: relayOrigin.replace(/^http/, "ws") + "/v1/dashboard",
        expiresAt,
        fingerprint: "synthetic",
      }),
    );
  } else if (req.url === "/v1/dashboard/session")
    res.end(
      JSON.stringify({
        ok: true,
        protocolVersion: 3,
        actionContract: ACTION_CONTRACT_ID,
        serverId,
        deviceId,
        role: "Owner",
        scopes: SCOPES,
        expiresAt,
      }),
    );
  else {
    res.writeHead(404).end("{}");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
relayOrigin = `http://127.0.0.1:${server.address().port}`;
const ws = new WebSocketServer({ server, path: "/v1/dashboard" });
const event = (socket, eventType, body, kind = "HOST") =>
  socket.send(
    JSON.stringify({
      type: "server.event",
      serverId,
      agentKind: kind,
      agentSession: kind === "HOST" ? "contract-host" : "contract-paper",
      eventType,
      body,
    }),
  );
const service = (socket) =>
  event(socket, "service.status", {
    ...epoch,
    state: "active",
    minecraftReady: true,
    resources: {
      capturedAt: new Date().toISOString(),
      scope: "MINECRAFT_SERVICE",
      source: "SYSTEMD_CGROUP",
      cpuUnit: "PERCENT_OF_ONE_CORE",
      cpuPercent: 10,
      memoryBytes: 1073741824,
      cpuAvailable: true,
      memoryAvailable: true,
    },
  });
ws.on("connection", (socket) => {
  socket.send(JSON.stringify(ready));
  service(socket);
  socket.on("message", async (raw) => {
    const m = JSON.parse(raw);
    if (m.type !== "dashboard.action") return;
    let data = {};
    try {
      const p = m.parameters ?? {};
      if (
        m.action === "console.history" ||
        m.action === "console.history.errors"
      ) {
        historyReads++;
        data = await store("history", p);
      } else if (m.action === "events.session.list")
        data = await store("session");
      else if (m.action === "chat.history") data = await store("chat");
      else if (m.action === "server.status")
        data = {
          ...epoch,
          state: "active",
          ...(p.includeSession ? { session: await store("session") } : {}),
          ...(p.includeChat ? { chat: await store("chat") } : {}),
        };
      else if (m.action === "maintenance.settings.get") data = { settings };
      else if (m.action === "maintenance.settings.update") {
        assert.equal(p.confirmed, true);
        assert.equal(p.settings.schedule.backups.enabled, true);
        settingsMutations++;
        Object.assign(settings, p.settings);
        data = { settings };
      } else if (m.action === "backup.full.list") data = { backups: [] };
      else if (m.action === "maintenance.status")
        data = { currentOperation: { phase: "IDLE" } };
      event(
        socket,
        "action.result",
        {
          requestId: m.requestId,
          action: m.action,
          status: "SUCCESS",
          code: "OK",
          message: "Loopback contract result",
          data,
        },
        m.agentKind,
      );
    } catch (e) {
      event(
        socket,
        "action.result",
        {
          requestId: m.requestId,
          action: m.action,
          status: "FAILED",
          code: "CONTRACT_FAILED",
          message: String(e),
          data: {},
        },
        m.agentKind,
      );
    }
  });
});
try {
  await harness(
    async ({ browser, origin, output }) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      await context.route("**/*", (route) =>
        ["127.0.0.1", "localhost"].includes(
          new URL(route.request().url()).hostname,
        )
          ? route.continue()
          : route.abort(),
      );
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${origin}/console`);
      await page
        .getByLabel("Device name", { exact: true })
        .fill("Contract browser");
      await page
        .getByLabel("Pairing code", { exact: true })
        .fill("synthetic-code");
      await page
        .getByRole("button", { name: "Connect server", exact: true })
        .click();
      await page.locator("#workspace").waitFor();
      await page
        .getByText("SQLite history survives browser reload", { exact: true })
        .waitFor();
      assert(historyReads > 0);
      const before = historyReads;
      await page.reload();
      await page
        .getByText("SQLite history survives browser reload", { exact: true })
        .waitFor();
      assert(historyReads > before);
      const keys = await page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open("plexonpanel-browser-v3");
            r.onsuccess = () => {
              const db = r.result,
                q = db
                  .transaction("workspace")
                  .objectStore("workspace")
                  .getAllKeys();
              q.onsuccess = () => {
                resolve(q.result);
                db.close();
              };
              q.onerror = () => reject(q.error);
            };
            r.onerror = () => reject(r.error);
          }),
      );
      assert(
        keys.every(
          (key) =>
            key === "selected" ||
            key === "relay-origin" ||
            key.startsWith("credential:") ||
            key.startsWith("label:"),
        ),
      );
      for (const socket of ws.clients)
        socket.send(
          JSON.stringify({
            ...ready,
            device: {
              ...ready.device,
              scopes: ["overview.view", "console.view.errors"],
            },
          }),
        );
      await page.waitForTimeout(700);
      assert.equal(
        await page
          .getByText("SQLite history survives browser reload", { exact: true })
          .count(),
        0,
      );
      // A changed reported grant intentionally closes the immutable signed session.
      // Reconnect through normal page startup to negotiate the original grant again.
      await page.reload();
      await page
        .getByText("SQLite history survives browser reload", { exact: true })
        .waitFor();
      await page
        .locator('aside[aria-label=Sidebar] a[href="/players"]')
        .click();
      await page.getByText("ContractPlayer", { exact: true }).waitFor();
      await store("stop");
      epoch = await store("boot", {
        epoch: "b".repeat(32),
        startedAt: new Date().toISOString(),
      });
      for (const socket of ws.clients) {
        event(socket, "session.epoch_reset", epoch);
        service(socket);
      }
      await page.waitForTimeout(700);
      assert.equal(
        await page.getByText("ContractPlayer", { exact: true }).count(),
        0,
      );
      await page
        .locator('aside[aria-label=Sidebar] a[href="/backups"]')
        .click();
      const toggle = page.getByLabel("Enable scheduled backups", {
        exact: true,
      });
      await toggle.click();
      await page
        .getByRole("button", { name: "Review schedule", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      const typed = page.getByRole("dialog").locator("input");
      if (await typed.count()) await typed.fill("Local SQLite contract");
      await page
        .getByRole("button", { name: "Dispatch operation", exact: true })
        .click();
      await page.waitForTimeout(600);
      assert.equal(settingsMutations, 1);
      assert.deepEqual(errors, []);
      const result = {
        story:
          "Browser pairing → synthetic loopback relay → real Java HostSessionStore SQLite/JSON → UI. No systemd, RCON, Drive or deployed relay was invoked.",
        pairing: "PASS",
        sqliteHistory: "PASS",
        reloadRequeries: "PASS",
        noOperationalIndexedDb: "PASS",
        scopeDowngradeHidesFullHistory: "PASS",
        bootEpochClearsPresence: "PASS",
        reviewedSettingsMutations: settingsMutations,
        historyReads,
        pageErrors: errors,
      };
      writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result));
      await context.close();
    },
    { tag: "v5-flow", env: { NEXT_PUBLIC_PLEXON_RELAY_URL: relayOrigin } },
  );
} finally {
  for (const socket of ws.clients) socket.terminate();
  ws.close();
  server.close();
  java.stdin.end();
  java.kill("SIGTERM");
}
