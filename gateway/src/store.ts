import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentData,
  type Firestore,
} from "firebase-admin/firestore";
import {
  pairingLookupId,
  pairingVerificationHash,
  verifyPairingHash,
} from "./crypto.js";

const APP_NAME = "plexonpanel-gateway";
const PAIRING_AUDIT_RETENTION_MS = 24 * 60 * 60_000;
const AUDIT_RETENTION_MS = 90 * 24 * 60 * 60_000;

export class IdentityConflictError extends Error {}
export class PairingCollisionError extends Error {}
export class PairingClaimError extends Error {}

export interface AgentIdentityRecord {
  serverId: string;
  publicKey: string;
  fingerprint: string;
  pluginVersion: string;
  paperVersion: string;
  minecraftVersion: string;
  javaVersion: string;
  operatingSystem: string;
  capabilities: Record<string, boolean>;
}

export interface PairingRegistration {
  serverId: string;
  requestId: string;
  challengeId: string;
  code: string;
  fingerprint: string;
  expiresAt: Date;
}

export interface PairingResolution {
  serverId: string;
  challengeId: string;
  expiresAt: Date;
  status: string;
}

export interface PairingClaim {
  serverId: string;
  deviceId: string;
  deviceLabel: string;
}

export type StateSlot = "server" | "system" | "players" | "plugins" | "errors";

export class GatewayStore {
  private readonly firestore: Firestore;

  constructor(
    private readonly pairingPepper: string,
    firebaseProjectId?: string,
  ) {
    const existing = getApps().find((app) => app.name === APP_NAME);
    const app = existing ?? initializeApp(
      {
        credential: applicationDefault(),
        ...(firebaseProjectId ? { projectId: firebaseProjectId } : {}),
      },
      APP_NAME,
    );
    this.firestore = getFirestore(app);
  }

  async registerAgentIdentity(identity: AgentIdentityRecord): Promise<{ paired: boolean }> {
    const reference = this.firestore.doc(`servers/${identity.serverId}`);
    return this.firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) {
        const data = existing.data()!;
        if (data.publicKey !== identity.publicKey || data.fingerprint !== identity.fingerprint) {
          throw new IdentityConflictError("Server ID is already bound to another cryptographic identity");
        }
      }
      transaction.set(reference, {
        serverId: identity.serverId,
        publicKey: identity.publicKey,
        fingerprint: identity.fingerprint,
        pluginVersion: identity.pluginVersion,
        paperVersion: identity.paperVersion,
        minecraftVersion: identity.minecraftVersion,
        javaVersion: identity.javaVersion,
        operatingSystem: identity.operatingSystem,
        capabilities: identity.capabilities,
        connectionStatus: "authenticating",
        lastSeenAt: FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : {
          paired: false,
          pairingStatus: "unpaired",
          createdAt: FieldValue.serverTimestamp(),
        }),
      }, { merge: true });
      return { paired: existing.exists && existing.data()?.paired === true };
    });
  }

  async markAgentOnline(serverId: string, connectionId: string): Promise<void> {
    await this.firestore.doc(`servers/${serverId}`).set({
      connectionId,
      connectionStatus: "online",
      connectedAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  async markAgentOffline(serverId: string, connectionId: string): Promise<void> {
    const reference = this.firestore.doc(`servers/${serverId}`);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists || snapshot.data()?.connectionId !== connectionId) return;
      transaction.set(reference, {
        connectionStatus: "offline",
        disconnectedAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  }

  async registerPairing(registration: PairingRegistration): Promise<void> {
    const lookupId = pairingLookupId(registration.code, this.pairingPepper);
    const challengeReference = this.firestore.doc(`pairingChallenges/${lookupId}`);
    const serverReference = this.firestore.doc(`servers/${registration.serverId}`);
    await this.firestore.runTransaction(async (transaction) => {
      const server = await transaction.get(serverReference);
      if (!server.exists || server.data()?.fingerprint !== registration.fingerprint) {
        throw new IdentityConflictError("Pairing identity does not match the registered server");
      }
      const existingChallenge = await transaction.get(challengeReference);
      const previousLookup = typeof server.data()?.currentPairingLookup === "string"
        ? server.data()!.currentPairingLookup as string
        : null;
      const previousReference = previousLookup && previousLookup !== lookupId
        ? this.firestore.doc(`pairingChallenges/${previousLookup}`)
        : null;
      const previousChallenge = previousReference ? await transaction.get(previousReference) : null;

      if (existingChallenge.exists) {
        const existing = existingChallenge.data()!;
        const existingExpiry = existing.expiresAt instanceof Timestamp
          ? existing.expiresAt.toMillis()
          : 0;
        if (existing.status === "open" && existingExpiry > Date.now() && existing.serverId !== registration.serverId) {
          throw new PairingCollisionError("Pairing code is already active");
        }
      }

      if (previousReference && previousChallenge?.exists) {
        transaction.set(previousReference, {
          status: "replaced",
          deleteAt: Timestamp.fromMillis(Date.now() + PAIRING_AUDIT_RETENTION_MS),
        }, { merge: true });
      }
      transaction.set(challengeReference, {
        lookupId,
        serverId: registration.serverId,
        requestId: registration.requestId,
        challengeId: registration.challengeId,
        fingerprint: registration.fingerprint,
        verificationHash: pairingVerificationHash(
          registration.challengeId,
          registration.code,
          this.pairingPepper,
        ),
        status: "open",
        attempts: 0,
        expiresAt: Timestamp.fromDate(registration.expiresAt),
        deleteAt: Timestamp.fromMillis(registration.expiresAt.getTime() + PAIRING_AUDIT_RETENTION_MS),
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(serverReference, {
        currentPairingLookup: lookupId,
        pairingStatus: "pending",
        pairingUpdatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  }

  async resolvePairing(code: string): Promise<PairingResolution | null> {
    const lookupId = pairingLookupId(code, this.pairingPepper);
    const challenge = await this.firestore.doc(`pairingChallenges/${lookupId}`).get();
    if (!challenge.exists) return null;
    const data = challenge.data()!;
    if (typeof data.serverId !== "string"
        || typeof data.challengeId !== "string"
        || !(data.expiresAt instanceof Timestamp)) {
      return null;
    }
    return {
      serverId: data.serverId,
      challengeId: data.challengeId,
      expiresAt: data.expiresAt.toDate(),
      status: typeof data.status === "string" ? data.status : "invalid",
    };
  }

  async claimPairing(code: string, deviceId: string, deviceLabel: string): Promise<PairingClaim> {
    const lookupId = pairingLookupId(code, this.pairingPepper);
    const challengeReference = this.firestore.doc(`pairingChallenges/${lookupId}`);
    const result = await this.firestore.runTransaction(async (transaction) => {
      const challenge = await transaction.get(challengeReference);
      if (!challenge.exists) return null;
      const data = challenge.data()!;
      if (typeof data.serverId !== "string" || typeof data.challengeId !== "string") return null;
      const serverReference = this.firestore.doc(`servers/${data.serverId}`);
      const server = await transaction.get(serverReference);
      if (!server.exists) return null;
      const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : 0;
      const attempts = Number.isInteger(data.attempts) ? Number(data.attempts) : 0;
      const valid = data.status === "open"
        && attempts < 5
        && expiresAt > Date.now()
        && typeof data.verificationHash === "string"
        && verifyPairingHash(data.verificationHash, data.challengeId, code, this.pairingPepper);
      if (!valid) {
        transaction.set(challengeReference, {
          attempts: attempts + 1,
          ...(expiresAt <= Date.now() ? { status: "expired" } : {}),
        }, { merge: true });
        return null;
      }

      const deviceReference = this.firestore.doc(`servers/${data.serverId}/authorizedDevices/${deviceId}`);
      transaction.set(challengeReference, {
        status: "claimed",
        attempts: attempts + 1,
        claimedAt: FieldValue.serverTimestamp(),
        claimedDeviceId: deviceId,
        deleteAt: Timestamp.fromMillis(Date.now() + PAIRING_AUDIT_RETENTION_MS),
      }, { merge: true });
      transaction.set(deviceReference, {
        deviceId,
        label: deviceLabel,
        role: "owner",
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(serverReference, {
        paired: true,
        pairingStatus: "paired",
        pairedAt: FieldValue.serverTimestamp(),
        pairingUpdatedAt: FieldValue.serverTimestamp(),
        currentPairingLookup: FieldValue.delete(),
      }, { merge: true });
      return { serverId: data.serverId, deviceId, deviceLabel };
    });
    if (!result) throw new PairingClaimError("Invalid or expired pairing code");
    return result;
  }

  async isAuthorizedDevice(serverId: string, deviceId: string): Promise<boolean> {
    const device = await this.firestore.doc(`servers/${serverId}/authorizedDevices/${deviceId}`).get();
    return device.exists && device.data()?.active === true;
  }

  async revokeDevice(serverId: string, deviceId: string): Promise<boolean> {
    const reference = this.firestore.doc(`servers/${serverId}/authorizedDevices/${deviceId}`);
    return this.firestore.runTransaction(async (transaction) => {
      const device = await transaction.get(reference);
      if (!device.exists || device.data()?.active !== true) return false;
      transaction.delete(reference);
      return true;
    });
  }

  async revokePairing(serverId: string): Promise<void> {
    await this.firestore.doc(`servers/${serverId}`).set({
      paired: false,
      pairingStatus: "unpaired",
      pairingUpdatedAt: FieldValue.serverTimestamp(),
      currentPairingLookup: FieldValue.delete(),
    }, { merge: true });

    const devices = await this.firestore.collection(`servers/${serverId}/authorizedDevices`).limit(500).get();
    if (!devices.empty) {
      const batch = this.firestore.batch();
      for (const device of devices.docs) batch.delete(device.ref);
      await batch.commit();
    }
  }

  async saveLatestState(serverId: string, slot: StateSlot, body: Record<string, unknown>): Promise<void> {
    await this.firestore.doc(`servers/${serverId}/state/latest`).set({
      [slot]: body,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  async readDashboardState(serverId: string): Promise<Record<string, unknown> | null> {
    const [snapshots, auditSnapshot] = await Promise.all([
      this.firestore.getAll(
        this.firestore.doc(`servers/${serverId}`),
        this.firestore.doc(`servers/${serverId}/state/latest`),
      ),
      this.firestore.collection(`servers/${serverId}/auditEvents`)
        .orderBy("createdAt", "desc")
        .limit(12)
        .get(),
    ]);
    const server = snapshots[0]!;
    const state = snapshots[1]!;
    if (!server.exists) return null;
    return sanitizeForJson({
      server: server.data(),
      state: state.exists ? state.data() : {},
      audit: auditSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })),
    }) as Record<string, unknown>;
  }

  async recordAudit(serverId: string, eventId: string, event: Record<string, unknown>): Promise<void> {
    await this.firestore.doc(`servers/${serverId}/auditEvents/${eventId}`).set({
      ...event,
      createdAt: FieldValue.serverTimestamp(),
      deleteAt: Timestamp.fromMillis(Date.now() + AUDIT_RETENTION_MS),
    });
  }
}

function sanitizeForJson(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(sanitizeForJson);
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as DocumentData)) {
      result[key] = sanitizeForJson(child);
    }
    return result;
  }
  return value;
}
