import { DatabaseSync } from "node:sqlite";

export interface StoredRoom {
  protocolVersion: 3;
  identity?: StoredAgentIdentity;
  hostIdentity?: StoredAgentIdentity;
  paired: boolean;
  generation: number;
  revision: number;
  devices: StoredDevice[];
  currentPairing?: PairingRegistration;
}

export interface StoredAgentIdentity {
  publicKey: string;
  fingerprint: string;
  pluginVersion: string;
  paperVersion: string;
  minecraftVersion: string;
  javaVersion: string;
  operatingSystem: string;
  capabilities: Record<string, boolean>;
  hostPublicKey: string;
}

export interface StoredDevice {
  deviceId: string;
  name: string;
  role: string;
  scopes: string[];
  issuedAt: number;
  expiresAt: number;
  lastSeen: number;
}

export interface PairingRegistration {
  lookupId: string;
  serverId: string;
  requestId: string;
  challengeId: string;
  fingerprint: string;
  expiresAt: number;
}

interface CountRow {
  count: number;
}
interface TextRow {
  value: string;
}
interface RateRow {
  window_started_at: number;
  attempts: number;
}
interface PairingRow {
  lookup_id: string;
  server_id: string;
  request_id: string;
  challenge_id: string;
  fingerprint: string;
  expires_at: number;
}

const SCHEMA_VERSION = 1;

export class CoordinationStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA synchronous=NORMAL");
    this.db.exec("PRAGMA foreign_keys=ON");
    this.db.exec("PRAGMA busy_timeout=5000");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relay_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS server_rooms (
        server_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pairing_registrations (
        lookup_id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        challenge_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pairing_expiry
        ON pairing_registrations(expires_at);
      CREATE TABLE IF NOT EXISTS pairing_rate_limits (
        client_key TEXT PRIMARY KEY,
        window_started_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rate_window
        ON pairing_rate_limits(window_started_at);
    `);
    const row = this.db.prepare("SELECT value FROM relay_meta WHERE key='schema_version'").get() as
      | TextRow
      | undefined;
    if (!row) {
      this.db
        .prepare("INSERT INTO relay_meta(key, value) VALUES('schema_version', ?)")
        .run(String(SCHEMA_VERSION));
      this.db
        .prepare("INSERT INTO relay_meta(key, value) VALUES('created_at', ?)")
        .run(new Date().toISOString());
      return;
    }
    if (Number(row.value) !== SCHEMA_VERSION)
      throw new Error(
        `Unsupported relay database schema ${row.value}; expected ${SCHEMA_VERSION}`,
      );
  }

  loadRoom(serverId: string): StoredRoom {
    const row = this.db
      .prepare("SELECT state_json AS value FROM server_rooms WHERE server_id=?")
      .get(serverId) as TextRow | undefined;
    if (!row) return emptyRoom();
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      throw new Error(`Stored coordination state for ${serverId} is corrupt`);
    }
    if (!validStoredRoom(parsed))
      throw new Error(`Stored coordination state for ${serverId} is incompatible`);
    return parsed;
  }

  saveRoom(serverId: string, room: StoredRoom): void {
    if (!validStoredRoom(room)) throw new Error("Refused to persist invalid room state");
    this.db
      .prepare(
        `INSERT INTO server_rooms(server_id, state_json, updated_at)
         VALUES(?, ?, ?)
         ON CONFLICT(server_id) DO UPDATE SET
           state_json=excluded.state_json,
           updated_at=excluded.updated_at`,
      )
      .run(serverId, JSON.stringify(room), Date.now());
  }

  registerPairing(registration: PairingRegistration): "ok" | "collision" {
    return this.transaction(() => {
      const existing = this.resolvePairingByLookup(registration.lookupId);
      if (
        existing &&
        existing.expiresAt > Date.now() &&
        existing.serverId !== registration.serverId
      )
        return "collision";
      this.db
        .prepare(
          `INSERT INTO pairing_registrations(
            lookup_id, server_id, request_id, challenge_id, fingerprint, expires_at
          ) VALUES(?, ?, ?, ?, ?, ?)
          ON CONFLICT(lookup_id) DO UPDATE SET
            server_id=excluded.server_id,
            request_id=excluded.request_id,
            challenge_id=excluded.challenge_id,
            fingerprint=excluded.fingerprint,
            expires_at=excluded.expires_at`,
        )
        .run(
          registration.lookupId,
          registration.serverId,
          registration.requestId,
          registration.challengeId,
          registration.fingerprint,
          registration.expiresAt,
        );
      return "ok";
    });
  }

  resolvePairingByLookup(lookupId: string): PairingRegistration | null {
    const row = this.db
      .prepare(
        `SELECT lookup_id, server_id, request_id, challenge_id, fingerprint, expires_at
         FROM pairing_registrations WHERE lookup_id=?`,
      )
      .get(lookupId) as PairingRow | undefined;
    if (!row) return null;
    if (row.expires_at <= Date.now()) {
      this.deletePairing(lookupId);
      return null;
    }
    return fromPairingRow(row);
  }

  deletePairing(lookupId: string): void {
    this.db.prepare("DELETE FROM pairing_registrations WHERE lookup_id=?").run(lookupId);
  }

  consumePairingRateLimit(clientKey: string, now = Date.now()): boolean {
    return this.transaction(() => {
      const row = this.db
        .prepare(
          "SELECT window_started_at, attempts FROM pairing_rate_limits WHERE client_key=?",
        )
        .get(clientKey) as RateRow | undefined;
      const windowStartedAt =
        !row || now - row.window_started_at >= 15 * 60_000 ? now : row.window_started_at;
      const attempts = windowStartedAt === now ? 0 : row?.attempts ?? 0;
      if (attempts >= 10) return false;
      this.db
        .prepare(
          `INSERT INTO pairing_rate_limits(client_key, window_started_at, attempts)
           VALUES(?, ?, ?)
           ON CONFLICT(client_key) DO UPDATE SET
             window_started_at=excluded.window_started_at,
             attempts=excluded.attempts`,
        )
        .run(clientKey, windowStartedAt, attempts + 1);
      return true;
    });
  }

  prune(now = Date.now(), limit = 128): { pairings: number; rateLimits: number } {
    const pairingIds = this.db
      .prepare(
        "SELECT lookup_id AS value FROM pairing_registrations WHERE expires_at<=? LIMIT ?",
      )
      .all(now, limit) as TextRow[];
    const staleRateIds = this.db
      .prepare(
        "SELECT client_key AS value FROM pairing_rate_limits WHERE window_started_at<=? LIMIT ?",
      )
      .all(now - 15 * 60_000, limit) as TextRow[];
    this.transaction(() => {
      const deletePairing = this.db.prepare(
        "DELETE FROM pairing_registrations WHERE lookup_id=?",
      );
      for (const row of pairingIds) deletePairing.run(row.value);
      const deleteRate = this.db.prepare(
        "DELETE FROM pairing_rate_limits WHERE client_key=?",
      );
      for (const row of staleRateIds) deleteRate.run(row.value);
    });
    return { pairings: pairingIds.length, rateLimits: staleRateIds.length };
  }

  counts(): { rooms: number; pairings: number; rateLimits: number } {
    const count = (table: string): number =>
      Number(
        (this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as CountRow).count,
      );
    return {
      rooms: count("server_rooms"),
      pairings: count("pairing_registrations"),
      rateLimits: count("pairing_rate_limits"),
    };
  }

  close(): void {
    this.db.close();
  }

  private transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {}
      throw error;
    }
  }
}

export function emptyRoom(): StoredRoom {
  return {
    protocolVersion: 3,
    paired: false,
    generation: 1,
    revision: 0,
    devices: [],
  };
}

function fromPairingRow(row: PairingRow): PairingRegistration {
  return {
    lookupId: row.lookup_id,
    serverId: row.server_id,
    requestId: row.request_id,
    challengeId: row.challenge_id,
    fingerprint: row.fingerprint,
    expiresAt: row.expires_at,
  };
}

function validStoredRoom(value: unknown): value is StoredRoom {
  if (!record(value)) return false;
  return (
    value.protocolVersion === 3 &&
    typeof value.paired === "boolean" &&
    Number.isSafeInteger(value.generation) &&
    Number(value.generation) >= 1 &&
    Number.isSafeInteger(value.revision) &&
    Number(value.revision) >= 0 &&
    Array.isArray(value.devices) &&
    value.devices.length <= 64 &&
    value.devices.every(validDevice) &&
    (value.identity === undefined || validIdentity(value.identity)) &&
    (value.hostIdentity === undefined || validIdentity(value.hostIdentity)) &&
    (value.currentPairing === undefined || validPairing(value.currentPairing))
  );
}

function validIdentity(value: unknown): value is StoredAgentIdentity {
  if (!record(value)) return false;
  return (
    typeof value.publicKey === "string" &&
    value.publicKey.length <= 512 &&
    typeof value.fingerprint === "string" &&
    value.fingerprint.length <= 64 &&
    typeof value.pluginVersion === "string" &&
    typeof value.paperVersion === "string" &&
    typeof value.minecraftVersion === "string" &&
    typeof value.javaVersion === "string" &&
    typeof value.operatingSystem === "string" &&
    record(value.capabilities) &&
    Object.keys(value.capabilities).length <= 256 &&
    Object.values(value.capabilities).every((entry) => typeof entry === "boolean") &&
    typeof value.hostPublicKey === "string" &&
    value.hostPublicKey.length <= 512
  );
}

function validDevice(value: unknown): value is StoredDevice {
  if (!record(value)) return false;
  return (
    typeof value.deviceId === "string" &&
    typeof value.name === "string" &&
    value.name.length <= 64 &&
    typeof value.role === "string" &&
    Array.isArray(value.scopes) &&
    value.scopes.every((scope) => typeof scope === "string") &&
    Number.isSafeInteger(value.issuedAt) &&
    Number.isSafeInteger(value.expiresAt) &&
    Number(value.expiresAt) > Number(value.issuedAt) &&
    Number.isFinite(value.lastSeen)
  );
}

function validPairing(value: unknown): value is PairingRegistration {
  if (!record(value)) return false;
  return (
    typeof value.lookupId === "string" &&
    typeof value.serverId === "string" &&
    typeof value.requestId === "string" &&
    typeof value.challengeId === "string" &&
    typeof value.fingerprint === "string" &&
    Number.isFinite(value.expiresAt)
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
