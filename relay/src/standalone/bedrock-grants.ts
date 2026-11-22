import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, openSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { DashboardAccess } from "../security.js";
import type { BedrockConfig } from "./bedrock-config.js";

const READ_SCOPES = ["overview.view", "telemetry.view", "server.status", "console.view.full"] as const;
const MAX_ENROLLMENT_ATTEMPTS = 30;
const DEVICE_LIMIT = 16;
const DEVICE_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

interface Grant {
  deviceId: string;
  name: string;
  issuedAt: number;
  expiresAt: number;
}

export class BedrockGrants {
  private readonly db: DatabaseSync;

  constructor(databasePath: string, private readonly registration: BedrockConfig) {
    const ledgerPath = databasePath === ":memory:" ? databasePath : `${databasePath}.bedrock`;
    if (ledgerPath !== ":memory:") {
      const fd = openSync(ledgerPath, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
      try {
        const stat = fstatSync(fd);
        if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.geteuid?.() || (stat.mode & 0o077) !== 0)
          throw new Error("Bedrock grant ledger must be private to the relay account");
      } finally {
        closeSync(fd);
      }
    }
    this.db = new DatabaseSync(ledgerPath);
    try {
      this.db.exec(`
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=FULL;
        PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS bedrock_authority (id INTEGER PRIMARY KEY CHECK(id=1), identity TEXT NOT NULL, generation INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS bedrock_grants (device_id TEXT PRIMARY KEY, name TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS bedrock_enrollments (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL, used INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS bedrock_revocations (device_id TEXT PRIMARY KEY, revoked_at INTEGER NOT NULL);
      `);
      this.initialize();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  matchesEnrollment(lookupId: string, now = Date.now()): boolean {
    const enrollment = this.registration.enrollment;
    if (!enrollment || now < enrollment.issuedAt || now >= enrollment.expiresAt || enrollment.lookupId !== lookupId) return false;
    const row = this.db.prepare("SELECT attempts, used FROM bedrock_enrollments WHERE id=?").get(enrollment.id);
    return !row || (row.used === 0 && Number(row.attempts) < MAX_ENROLLMENT_ATTEMPTS);
  }

  claim(lookupId: string, name: string, now = Date.now()): { access: DashboardAccess; name: string } | null {
    const enrollment = this.registration.enrollment;
    if (!enrollment || now < enrollment.issuedAt || now >= enrollment.expiresAt) return null;
    return this.transaction(() => {
      const row = this.db.prepare("SELECT attempts, used FROM bedrock_enrollments WHERE id=?").get(enrollment.id);
      if (row && (row.used !== 0 || Number(row.attempts) >= MAX_ENROLLMENT_ATTEMPTS)) return null;
      this.db.prepare(`
        INSERT INTO bedrock_enrollments(id, expires_at, attempts, used) VALUES(?,?,1,0)
        ON CONFLICT(id) DO UPDATE SET attempts=attempts+1
      `).run(enrollment.id, enrollment.expiresAt);
      if (enrollment.lookupId !== lookupId) return null;
      const issuedAt = Math.floor(now / 1000);
      this.db.prepare("DELETE FROM bedrock_grants WHERE expires_at <= ?").run(issuedAt);
      const count = this.db.prepare("SELECT count(*) AS count FROM bedrock_grants").get()?.count;
      if (Number(count) >= DEVICE_LIMIT) return null;
      const deviceId = randomUUID();
      const expiresAt = issuedAt + DEVICE_LIFETIME_SECONDS;
      this.db.prepare("INSERT INTO bedrock_grants(device_id, name, issued_at, expires_at) VALUES(?,?,?,?)")
        .run(deviceId, name, issuedAt, expiresAt);
      this.db.prepare("UPDATE bedrock_enrollments SET used=1 WHERE id=?").run(enrollment.id);
      audit("BEDROCK_DEVICE_ENROLLED", this.registration.serverId, deviceId);
      return { name, access: {
        version: 3, protocolVersion: 3, audience: "plexonpanel-relay",
        serverId: this.registration.serverId, deviceId, role: "Owner", scopes: [...READ_SCOPES],
        generation: this.registration.generation, issuedAt, expiresAt,
      } };
    });
  }

  device(access: DashboardAccess, now = Date.now()): Grant | null {
    if (access.serverId !== this.registration.serverId || access.generation !== this.registration.generation ||
        access.expiresAt * 1000 <= now || access.role !== "Owner" || access.scopes.length !== READ_SCOPES.length ||
        !READ_SCOPES.every((scope) => access.scopes.includes(scope))) return null;
    const row = this.db.prepare("SELECT name, issued_at, expires_at FROM bedrock_grants WHERE device_id=?").get(access.deviceId);
    if (!row || row.issued_at !== access.issuedAt || row.expires_at !== access.expiresAt || typeof row.name !== "string") return null;
    return { deviceId: access.deviceId, name: row.name, issuedAt: access.issuedAt, expiresAt: access.expiresAt };
  }

  close(): void { this.db.close(); }

  private initialize(): void {
    const { serverId, nodeId, instanceKey, publicKey, generation, revokedDevices } = this.registration;
    const identity = createHash("sha256").update(JSON.stringify([serverId, nodeId, instanceKey, publicKey])).digest("hex");
    this.transaction(() => {
      const prior = this.db.prepare("SELECT identity,generation FROM bedrock_authority WHERE id=1").get();
      if (prior && (prior.identity !== identity || Number(prior.generation) > generation))
        throw new Error("Bedrock registration conflicts with the existing Host authority or generation");
      if (prior && Number(prior.generation) < generation) {
        this.db.exec("DELETE FROM bedrock_grants");
        audit("BEDROCK_GENERATION_ADVANCED", serverId);
      }
      this.db.prepare(`
        INSERT INTO bedrock_authority(id, identity, generation) VALUES(1,?,?)
        ON CONFLICT(id) DO UPDATE SET generation=excluded.generation
      `).run(identity, generation);
      const revokedAt = Date.now();
      for (const id of revokedDevices) {
        const updated = this.db.prepare("DELETE FROM bedrock_grants WHERE device_id=?").run(id);
        if (updated.changes) {
          this.db.prepare("INSERT INTO bedrock_revocations(device_id, revoked_at) VALUES(?,?)").run(id, revokedAt);
          audit("BEDROCK_DEVICE_REVOKED", serverId, id);
        }
      }
      this.db.prepare("DELETE FROM bedrock_enrollments WHERE expires_at <= ?").run(revokedAt);
      this.db.prepare("DELETE FROM bedrock_revocations WHERE revoked_at <= ?").run(revokedAt - DEVICE_LIFETIME_SECONDS * 1000);
    });
  }

  private transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

export function audit(event: string, serverId: string, deviceId?: string): void {
  console.info(JSON.stringify({ component: "PlexonPanelRelay", event, serverId, deviceId, at: new Date().toISOString() }));
}
