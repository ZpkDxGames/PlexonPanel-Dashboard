import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  listRelayCredentials,
  saveControlCache,
  loadControlCache,
} from "../src/adapter/browser-store";
import {
  applyControlMessage,
  emptyControlState,
  safeCache,
  type Sample,
} from "../src/adapter/control-state";
import { makeFixture, fixtureAction } from "../src/development/fixtures";
import { canvasData } from "../src/presentation/canvas-data";
import {
  defaultBackupSchedule,
  validateMaintenance,
} from "../src/adapter/maintenance";
const open = (version?: number) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("plexonpanel-browser-v3", version);
    r.onupgradeneeded = () => r.result.createObjectStore("workspace");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
test("IndexedDB v1 to v2 upgrade purges operational state while preserving paired identity", async () => {
  const db = await open(1),
    credential = {
      protocolVersion: 3,
      serverId: "storage-server",
      deviceId: "device",
      name: "Browser",
      role: "Observer",
      scopes: ["overview.view"],
      accessToken: "synthetic-only",
      websocketUrl: "wss://relay.invalid/v1/dashboard",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite"),
      s = tx.objectStore("workspace");
    s.put(credential, "credential:storage-server");
    s.put("storage-server", "selected");
    s.put(
      { console: ["old secret"], chat: ["old chat"] },
      "cache:storage-server",
    );
    s.put({ events: ["old event"] }, "events:storage-server");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  assert.equal((await listRelayCredentials()).length, 1);
  assert.equal(await loadControlCache("storage-server"), null);
  await saveControlCache({
    ...emptyControlState("storage-server"),
    console: [{ content: "never persist" }],
  });
  const newer = await open();
  assert.equal(newer.version, 2);
  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const r = newer
      .transaction("workspace")
      .objectStore("workspace")
      .getAllKeys();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  assert.deepEqual(keys, ["credential:storage-server", "selected"]);
  newer.close();
});
test("persistence projection never contains telemetry, logs, chat or player identities", () => {
  const state = makeFixture();
  assert.deepEqual(safeCache(state), emptyControlState(state.serverId));
});
test("Host boot reset clears prior-boot operational memory and rejects old invocation rows", () => {
  let s = makeFixture(),
    old = s.bootEpochId;
  const event = (eventType: string, body: unknown) => ({
    type: "server.event",
    serverId: s.serverId,
    agentKind: "HOST",
    agentSession: s.ready!.server.hostSession,
    eventType,
    body,
  });
  s = applyControlMessage(
    s,
    event("session.epoch_reset", {
      bootEpochId: "b".repeat(32),
      bootStartedAt: new Date().toISOString(),
    }),
  );
  assert.equal(s.console.length, 0);
  assert.equal(s.chat.length, 0);
  assert.equal(s.players.length, 0);
  assert.equal(s.history.length, 0);
  s = applyControlMessage(
    s,
    event("console.lines", {
      lines: [{ content: "previous invocation", invocationId: old }],
    }),
  );
  assert.equal(s.console.length, 0);
});
test("canvas source clocks and explicit missing values stay separate", () => {
  const sample = (at: number, clock: number, mspt: number | null): Sample => ({
    at,
    sources: {
      paperHealth: clock,
      paperSystem: null,
      hostSystem: null,
      service: null,
    },
    mspt,
    tps: 20,
    heap: null,
    gc: null,
    hostCpu: null,
    processCpu: null,
    memory: null,
    players: null,
  });
  const rows = [
    sample(1001, 1000, 10),
    sample(2001, 2000, null),
    sample(12001, 12000, 40),
  ];
  const { data } = canvasData(
    {},
    rows,
    [{ key: "mspt", label: "Mean", color: "#fff", unit: "ms" }],
    0,
  );
  assert.deepEqual(data[0], [1, 2, 7, 12]);
  assert.deepEqual(data[1], [10, null, null, 40]);
  const raw = canvasData(
    {},
    rows,
    [{ key: "mspt", label: "Mean", color: "#fff", unit: "ms" }],
    0,
    false,
  );
  assert.deepEqual(
    raw.data[0],
    [1, 2, 12],
    "raw evidence excludes inserted visual gap timestamps",
  );
  assert.deepEqual(
    raw.data[1],
    [10, null, 40],
    "actual missing observations remain visible",
  );
});
test("all periodic cadences validate and malformed schedules fail closed", async () => {
  const response = await fixtureAction("maintenance.settings.get", {}),
    settings = response.data.settings as any;
  for (const cadence of [
    "DAILY",
    "WEEKLY",
    "SELECTED_DAYS",
    "INTERVAL_HOURS",
  ]) {
    const backups = {
      ...defaultBackupSchedule(),
      cadence,
      weekdays:
        cadence === "WEEKLY" || cadence === "SELECTED_DAYS" ? ["MONDAY"] : [],
    };
    assert.equal(
      validateMaintenance({ ...settings, schedule: { backups } }),
      "",
    );
  }
  assert.match(
    validateMaintenance({
      ...settings,
      schedule: { backups: { ...defaultBackupSchedule(), intervalHours: 0 } },
    }),
    /Invalid/,
  );
});
test("inactive service packets cannot report retained resources as live consumption", () => {
  let s = makeFixture();
  s = applyControlMessage(s, {
    type: "server.event",
    serverId: s.serverId,
    agentKind: "HOST",
    agentSession: s.ready!.server.hostSession,
    eventType: "service.status",
    body: {
      state: "inactive",
      resources: {
        capturedAt: new Date().toISOString(),
        scope: "MINECRAFT_SERVICE",
        source: "SYSTEMD_CGROUP",
        cpuUnit: "PERCENT_OF_ONE_CORE",
        cpuPercent: 200,
        memoryBytes: 123,
        cpuAvailable: true,
        memoryAvailable: true,
      },
    },
  });
  assert.equal(s.history.at(-1)?.serviceCpu, null);
  assert.equal(s.history.at(-1)?.serviceMemory, null);
});

test("ready grants that remove viewing scopes erase previous privileged session payloads", () => {
  const s = makeFixture();
  const ready = {
    ...s.ready!,
    type: "dashboard.ready",
    device: { ...s.ready!.device, scopes: ["overview.view"] },
  };
  const next = applyControlMessage(s, ready);
  assert.equal(next.console.length, 0);
  assert.equal(next.chat.length, 0);
  assert.equal(next.players.length, 0);
  assert.equal(next.sessionEvents, undefined);
  const restricted = applyControlMessage(s, {
    ...ready,
    device: {
      ...ready.device,
      scopes: ["overview.view", "console.view.errors"],
    },
  });
  assert(
    restricted.console.every((row) =>
      ["WARN", "ERROR"].includes(String(row.level)),
    ),
  );
  assert(restricted.console.length > 0);
});
