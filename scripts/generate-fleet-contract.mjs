import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "protocol/fleet-contract-v1.json"), "utf8"));
if (manifest.contractVersion !== 1 || manifest.protocolVersion !== 3 ||
    manifest.paperSchemaVersion !== 5 || manifest.hostSchemaVersion !== 5 ||
    manifest.instanceKeyPattern !== "^[a-z][a-z0-9-]{0,31}$" ||
    manifest.serverNameMaximumLength !== 64 || manifest.maximumFleetConnections !== 16 ||
    manifest.nodeAuthority !== "HOST") throw new Error("Unsupported fleet contract");
const id = `sha256:${createHash("sha256").update(JSON.stringify(manifest)).digest("hex")}`;
const output = `// GENERATED from protocol/fleet-contract-v1.json; run npm run fleet:generate.
export const FLEET_CONTRACT_ID = ${JSON.stringify(id)} as const;
export const FLEET_CONTRACT_VERSION = 1 as const;
export const FLEET_PROTOCOL_VERSION = 3 as const;
export const PAPER_SCHEMA_VERSION = 5 as const;
export const HOST_SCHEMA_VERSION = 5 as const;
export const MAXIMUM_FLEET_CONNECTIONS = 16 as const;
const INSTANCE_KEY = new RegExp(${JSON.stringify(manifest.instanceKeyPattern)});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface FleetIdentity {
  serverId: string;
  nodeId: string;
  instanceKey: string;
  serverName: string;
}
export function validFleetUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
export function validInstanceKey(value: unknown): value is string {
  return typeof value === "string" && INSTANCE_KEY.test(value);
}
export function parseFleetIdentity(value: unknown): FleetIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid fleet identity");
  const item = value as Record<string, unknown>;
  if (!validFleetUuid(item.serverId)) throw new Error("Invalid serverId");
  if (!validFleetUuid(item.nodeId)) throw new Error("Invalid nodeId");
  if (!validInstanceKey(item.instanceKey)) throw new Error("Invalid instanceKey");
  if (typeof item.serverName !== "string" || !item.serverName.trim() ||
      item.serverName.length > 64 || /[\\u0000-\\u001f\\u007f-\\u009f]/.test(item.serverName))
    throw new Error("Invalid serverName");
  return { serverId: item.serverId.toLowerCase(), nodeId: item.nodeId.toLowerCase(),
    instanceKey: item.instanceKey, serverName: item.serverName.trim() };
}
export function sameFleetTarget(first: FleetIdentity, second: FleetIdentity): boolean {
  return first.serverId === second.serverId && first.nodeId === second.nodeId;
}
export function minecraftUnit(identity: FleetIdentity): string {
  if (!validInstanceKey(identity.instanceKey)) throw new Error("Invalid instanceKey");
  return "minecraft@" + identity.instanceKey + ".service";
}
`;
for (const path of ["lib/fleet-contract.ts", "relay/src/fleet-contract.ts"]) {
  const target = resolve(root, path);
  if (process.argv.includes("--check")) {
    if (await readFile(target, "utf8") !== output) throw new Error("Generated fleet contract is stale");
  } else await writeFile(target, output, "utf8");
}
