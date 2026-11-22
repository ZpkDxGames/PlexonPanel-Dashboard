import { createPublicKey } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";

export const BEDROCK_CONTRACT = "bedrock-host-v1";
export const BEDROCK_INSTANCE = "tonimbedrock";
export const ENROLLMENT_WINDOW_MS = 5 * 60_000;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface BedrockEnrollment {
  id: string;
  lookupId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface BedrockConfig {
  serverId: string;
  nodeId: string;
  instanceKey: typeof BEDROCK_INSTANCE;
  publicKey: string;
  generation: number;
  revokedDevices: string[];
  enrollment?: BedrockEnrollment;
}

export async function loadBedrockConfig(path: string | undefined): Promise<BedrockConfig | undefined> {
  if (!path) return undefined;
  if (!isAbsolute(path)) throw new Error("Bedrock registration path must be absolute");
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 16_384 || (stat.mode & 0o037) !== 0 ||
        (stat.uid !== 0 && stat.uid !== process.geteuid?.()))
      throw new Error("Bedrock registration must be a private regular file owned by the operator");
    const buffer = Buffer.alloc(16_385);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset > 16_384) throw new Error("Bedrock registration is too large");
    return parseBedrockConfig(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, offset))));
  } finally {
    await handle.close();
  }
}

export function parseBedrockConfig(raw: unknown): BedrockConfig {
  if (!object(raw) || Object.keys(raw).some((key) => ![
    "serverId", "nodeId", "instanceKey", "publicKey", "generation", "revokedDevices", "enrollment",
  ].includes(key))) throw new Error("Invalid Bedrock registration fields");
  const { serverId, nodeId, instanceKey, publicKey, generation, revokedDevices = [], enrollment } = raw;
  if (!uuid(serverId) || !uuid(nodeId) || serverId === nodeId || instanceKey !== BEDROCK_INSTANCE ||
      typeof publicKey !== "string" || !/^[A-Za-z0-9+/]{59}=$/.test(publicKey) ||
      !positiveInteger(generation) || !Array.isArray(revokedDevices) || revokedDevices.length > 128 ||
      !revokedDevices.every(uuid) || new Set(revokedDevices).size !== revokedDevices.length)
    throw new Error("Invalid Bedrock registration identity or revocations");
  const key = createPublicKey({ key: Buffer.from(publicKey, "base64"), format: "der", type: "spki" });
  if (key.asymmetricKeyType !== "ed25519" || key.export({ format: "der", type: "spki" }).toString("base64") !== publicKey)
    throw new Error("Bedrock registration requires a canonical Ed25519 SPKI key");
  return {
    serverId, nodeId, instanceKey, publicKey, generation, revokedDevices,
    ...(enrollment === undefined ? {} : { enrollment: parseEnrollment(enrollment) }),
  };
}

function parseEnrollment(raw: unknown): BedrockEnrollment {
  if (!object(raw) || Object.keys(raw).length !== 4) throw new Error("Invalid Bedrock enrollment fields");
  const { id, lookupId, issuedAt, expiresAt } = raw;
  if (!uuid(id) || typeof lookupId !== "string" || !/^[0-9a-f]{64}$/.test(lookupId) ||
      !positiveInteger(issuedAt) || !positiveInteger(expiresAt) ||
      expiresAt <= issuedAt || expiresAt - issuedAt > ENROLLMENT_WINDOW_MS)
    throw new Error("Invalid Bedrock enrollment identity or window");
  return { id, lookupId, issuedAt, expiresAt };
}

export function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
