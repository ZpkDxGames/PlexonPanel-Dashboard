const VERSION = 3;
export const MAX_ENVELOPE_BYTES = 131_072;
const MAX_BODY_BYTES = 65_536;
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

export function decodeEnvelope(text: string): DecodedEnvelope {
  if (new TextEncoder().encode(text).byteLength > MAX_ENVELOPE_BYTES) throw new Error("Protocol envelope is too large");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Protocol envelope is not valid JSON");
  }
  if (!isRecord(raw)) throw new Error("Protocol envelope must be an object");
  if (Object.keys(raw).sort().join("\n") !== ENVELOPE_FIELDS.join("\n")) {
    throw new Error("Protocol envelope fields do not match version 3");
  }
  const envelope = raw as unknown as ProtocolEnvelope;
  validateEnvelope(envelope);
  const bodyBytes = fromBase64Url(envelope.body);
  if (bodyBytes.byteLength > MAX_BODY_BYTES) throw new Error("Protocol body is too large");
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes));
  } catch {
    throw new Error("Protocol body is not valid JSON");
  }
  if (!isRecord(body)) throw new Error("Protocol body must be an object");
  return { envelope, body };
}

export function assertFreshEnvelope(envelope: ProtocolEnvelope, now = Date.now()): void {
  const timestamp = Date.parse(envelope.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 30_000) {
    throw new Error("Protocol message timestamp is outside the allowed clock skew");
  }
}

export async function importAgentPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  if (publicKeyBase64.length < 32 || publicKeyBase64.length > 512) throw new Error("Invalid agent public key");
  return crypto.subtle.importKey("spki", fromBase64(publicKeyBase64), { name: "Ed25519" }, false, ["verify"]);
}

export async function verifyEnvelope(envelope: ProtocolEnvelope, publicKey: CryptoKey): Promise<boolean> {
  try {
    return crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      fromBase64Url(envelope.signature),
      new TextEncoder().encode(signable(envelope)),
    );
  } catch {
    return false;
  }
}

export async function verifyChallengeProof(nonce: string, proof: unknown, publicKey: CryptoKey): Promise<boolean> {
  if (typeof proof !== "string" || proof.length > 256) return false;
  try {
    return crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      fromBase64Url(proof),
      new TextEncoder().encode(`challenge:${nonce}`),
    );
  } catch {
    return false;
  }
}

export async function signEnvelope(
  type: string,
  serverId: string,
  body: Record<string, unknown>,
  privateKeyBase64: string,
): Promise<string> {
  if (!MESSAGE_TYPE.test(type) || !UUID.test(serverId)) throw new Error("Invalid outbound protocol metadata");
  const bodyBytes = new TextEncoder().encode(JSON.stringify(body));
  if (bodyBytes.byteLength > MAX_BODY_BYTES) throw new Error("Outbound protocol body is too large");
  const envelope: ProtocolEnvelope = {
    protocolVersion: VERSION,
    type,
    messageId: crypto.randomUUID(),
    serverId,
    timestamp: new Date().toISOString(),
    body: toBase64Url(bodyBytes),
    signature: "",
  };
  const key = await crypto.subtle.importKey(
    "pkcs8",
    fromBase64(privateKeyBase64),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    key,
    new TextEncoder().encode(signable(envelope)),
  );
  envelope.signature = toBase64Url(new Uint8Array(signature));
  return JSON.stringify(envelope);
}

export async function publicKeyFingerprint(publicKeyBase64: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", fromBase64(publicKeyBase64)));
  return [...digest.slice(0, 12)].map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(normalized + "=".repeat((4 - normalized.length % 4) % 4));
}

export function toBase64Url(value: Uint8Array<ArrayBufferLike>): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
  if (envelope.protocolVersion !== VERSION) throw new Error("Unsupported protocol version");
  if (typeof envelope.type !== "string" || !MESSAGE_TYPE.test(envelope.type)) throw new Error("Invalid message type");
  if (typeof envelope.messageId !== "string" || !UUID.test(envelope.messageId)) throw new Error("Invalid message ID");
  if (typeof envelope.serverId !== "string" || !UUID.test(envelope.serverId)) throw new Error("Invalid server ID");
  if (typeof envelope.timestamp !== "string" || envelope.timestamp.length > 64) throw new Error("Invalid timestamp");
  if (typeof envelope.body !== "string" || envelope.body.length < 2 || envelope.body.length > MAX_BODY_BYTES * 2 || !/^[A-Za-z0-9_-]+$/.test(envelope.body)) {
    throw new Error("Invalid protocol body");
  }
  if (typeof envelope.signature !== "string" || !(/^[A-Za-z0-9_-]{86}$/).test(envelope.signature)) throw new Error("Invalid signature");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

