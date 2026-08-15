import {
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";

export const PROTOCOL_VERSION = 2;
export const MAX_ENVELOPE_BYTES = 1_048_576;
export const MAX_BODY_BYTES = 524_288;
const MESSAGE_TYPE = /^[a-z][a-z0-9_.-]{0,95}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENVELOPE_FIELDS = [
  "body",
  "messageId",
  "protocolVersion",
  "serverId",
  "signature",
  "timestamp",
  "type",
];

export interface ProtocolEnvelope {
  protocolVersion: number;
  type: string;
  messageId: string;
  serverId: string;
  timestamp: string;
  body: string;
  signature: string;
}

export interface DecodedEnvelope {
  envelope: ProtocolEnvelope;
  body: Record<string, unknown>;
}

export interface GatewayIdentity {
  privateKey: KeyObject;
  publicKey: KeyObject;
  publicKeyBase64: string;
}

export function loadGatewayIdentity(privateKeyBase64: string): GatewayIdentity {
  const privateKey = createPrivateKey({
    key: Buffer.from(privateKeyBase64, "base64"),
    format: "der",
    type: "pkcs8",
  });
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("GATEWAY_ED25519_PRIVATE_KEY is not an Ed25519 key");
  }
  const publicKey = createPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    publicKeyBase64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  };
}

export function decodeEnvelope(text: string): DecodedEnvelope {
  if (Buffer.byteLength(text, "utf8") > MAX_ENVELOPE_BYTES) {
    throw new Error("Protocol envelope is too large");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Protocol envelope is not valid JSON");
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Protocol envelope must be an object");
  }
  const candidate = raw as Record<string, unknown>;
  if (Object.keys(candidate).sort().join("\n") !== ENVELOPE_FIELDS.join("\n")) {
    throw new Error("Protocol envelope fields do not match version 2");
  }
  const envelope = candidate as unknown as ProtocolEnvelope;
  validateEnvelope(envelope);

  let decodedBody: Buffer;
  try {
    decodedBody = Buffer.from(envelope.body, "base64url");
  } catch {
    throw new Error("Protocol body is not valid Base64URL");
  }
  if (decodedBody.length > MAX_BODY_BYTES) {
    throw new Error("Decoded protocol body is too large");
  }
  let body: unknown;
  try {
    body = JSON.parse(decodedBody.toString("utf8"));
  } catch {
    throw new Error("Protocol body is not valid JSON");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Protocol body must be an object");
  }
  return { envelope, body: body as Record<string, unknown> };
}

export function verifyEnvelope(envelope: ProtocolEnvelope, publicKey: KeyObject): boolean {
  try {
    return verify(
      null,
      Buffer.from(signable(envelope), "utf8"),
      publicKey,
      Buffer.from(envelope.signature, "base64url"),
    );
  } catch {
    return false;
  }
}

export function signEnvelope(
  type: string,
  serverId: string,
  body: Record<string, unknown>,
  identity: GatewayIdentity,
): string {
  if (!MESSAGE_TYPE.test(type) || !UUID.test(serverId)) {
    throw new Error("Invalid outbound protocol metadata");
  }
  const encodedBody = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  if (encodedBody.length > MAX_BODY_BYTES * 2) {
    throw new Error("Outbound protocol body is too large");
  }
  const envelope: ProtocolEnvelope = {
    protocolVersion: PROTOCOL_VERSION,
    type,
    messageId: randomUUID(),
    serverId,
    timestamp: new Date().toISOString(),
    body: encodedBody,
    signature: "",
  };
  envelope.signature = sign(
    null,
    Buffer.from(signable(envelope), "utf8"),
    identity.privateKey,
  ).toString("base64url");
  return JSON.stringify(envelope);
}

export function decodeAgentPublicKey(value: unknown): KeyObject {
  if (typeof value !== "string" || value.length < 32 || value.length > 512) {
    throw new Error("Invalid agent public key");
  }
  const key = createPublicKey({ key: Buffer.from(value, "base64"), format: "der", type: "spki" });
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("Agent public key must use Ed25519");
  }
  return key;
}

export function verifyChallengeProof(
  nonce: string,
  proof: unknown,
  publicKey: KeyObject,
): boolean {
  if (typeof proof !== "string" || proof.length > 256) return false;
  try {
    return verify(
      null,
      Buffer.from(`challenge:${nonce}`, "utf8"),
      publicKey,
      Buffer.from(proof, "base64url"),
    );
  } catch {
    return false;
  }
}

export function assertFreshEnvelope(envelope: ProtocolEnvelope, now = Date.now()): void {
  const timestamp = Date.parse(envelope.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 30_000) {
    throw new Error("Protocol message timestamp is outside the allowed clock skew");
  }
}

export class ReplayWindow {
  private readonly seen = new Map<string, number>();

  accept(messageId: string, now = Date.now()): boolean {
    this.prune(now);
    if (this.seen.has(messageId)) return false;
    this.seen.set(messageId, now);
    if (this.seen.size > 8192) {
      const oldest = this.seen.keys().next().value as string | undefined;
      if (oldest) this.seen.delete(oldest);
    }
    return true;
  }

  private prune(now: number): void {
    const cutoff = now - 120_000;
    for (const [messageId, timestamp] of this.seen) {
      if (timestamp >= cutoff) break;
      this.seen.delete(messageId);
    }
  }
}

function signable(envelope: ProtocolEnvelope): string {
  return [
    envelope.protocolVersion,
    envelope.type,
    envelope.messageId,
    envelope.serverId,
    envelope.timestamp,
    envelope.body,
  ].join("\n");
}

function validateEnvelope(envelope: ProtocolEnvelope): void {
  if (envelope.protocolVersion !== PROTOCOL_VERSION) throw new Error("Unsupported protocol version");
  if (typeof envelope.type !== "string" || !MESSAGE_TYPE.test(envelope.type)) throw new Error("Invalid message type");
  if (typeof envelope.messageId !== "string" || !UUID.test(envelope.messageId)) throw new Error("Invalid message ID");
  if (typeof envelope.serverId !== "string" || !UUID.test(envelope.serverId)) throw new Error("Invalid server ID");
  if (typeof envelope.timestamp !== "string" || envelope.timestamp.length > 64) throw new Error("Invalid timestamp");
  if (typeof envelope.body !== "string" || envelope.body.length < 2 || envelope.body.length > MAX_BODY_BYTES * 2) {
    throw new Error("Invalid protocol body");
  }
  if (typeof envelope.signature !== "string" || envelope.signature.length !== 86) {
    throw new Error("Invalid protocol signature");
  }
}
