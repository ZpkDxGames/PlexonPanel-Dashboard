import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "protocol/action-scopes.json");
const targets = [
  resolve(root, "lib/scopes.ts"),
  resolve(root, "relay/src/scopes.ts"),
];
const check = process.argv.includes("--check");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
validate(manifest);
const contractId = `sha256:${createHash("sha256")
  .update(JSON.stringify(manifest))
  .digest("hex")}`;
const output = render(manifest, contractId);

let drift = false;
for (const target of targets) {
  if (check) {
    const current = await readFile(target, "utf8");
    if (current !== output) {
      drift = true;
      console.error(`Generated authorization contract is stale: ${target}`);
    }
  } else {
    await writeFile(target, output, "utf8");
  }
}
if (drift) process.exitCode = 1;

function validate(value) {
  if (!value || value.protocolVersion !== 3)
    throw new Error("Scope manifest must target Protocol 3");
  if (!Array.isArray(value.scopes) || value.scopes.length === 0)
    throw new Error("Scope manifest has no scopes");
  if (new Set(value.scopes).size !== value.scopes.length)
    throw new Error("Scope manifest contains duplicate scopes");
  const scopes = new Set(value.scopes);
  for (const scope of value.scopes)
    if (typeof scope !== "string" || !/^[a-z][a-z0-9_.-]+$/.test(scope))
      throw new Error(`Invalid scope: ${scope}`);
  if (
    !Array.isArray(value.identityActionPrefixes) ||
    value.identityActionPrefixes.some(
      (prefix) => typeof prefix !== "string" || !prefix.endsWith("."),
    )
  )
    throw new Error("Invalid identity action prefix list");
  if (
    !value.actionAliases ||
    typeof value.actionAliases !== "object" ||
    Array.isArray(value.actionAliases)
  )
    throw new Error("Invalid action alias map");
  for (const [action, scope] of Object.entries(value.actionAliases)) {
    if (!/^[a-z][a-z0-9_.-]+$/.test(action))
      throw new Error(`Invalid action alias: ${action}`);
    if (!scopes.has(scope)) throw new Error(`Unknown scope ${scope} for ${action}`);
  }
  if (
    !Array.isArray(value.highRisk) ||
    new Set(value.highRisk).size !== value.highRisk.length
  )
    throw new Error("Invalid high-risk action list");
}

function render(value, contractId) {
  const scopes = JSON.stringify(value.scopes, null, 2);
  const prefixes = JSON.stringify(value.identityActionPrefixes, null, 2);
  const aliases = JSON.stringify(value.actionAliases, null, 2);
  const highRisk = JSON.stringify(value.highRisk, null, 2);
  return `// GENERATED FILE — source: protocol/action-scopes.json
// Run npm run scopes:generate after editing the canonical manifest.

export const ACTION_CONTRACT_ID = ${JSON.stringify(contractId)} as const;

export const SCOPES = ${scopes} as const;
export type Scope = (typeof SCOPES)[number];

const IDENTITY_ACTION_PREFIXES = ${prefixes} as const;
const ACTION_ALIASES: Readonly<Record<string, Scope>> = ${aliases};

export const HIGH_RISK = new Set<string>(${highRisk});

export const ACTION_SCOPES: Readonly<Record<string, Scope>> = Object.freeze({
  ...Object.fromEntries(
    SCOPES.filter((scope) =>
      IDENTITY_ACTION_PREFIXES.some((prefix) => scope.startsWith(prefix)),
    ).map((scope) => [scope, scope]),
  ),
  ...ACTION_ALIASES,
}) as Readonly<Record<string, Scope>>;

export function validScopes(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= SCOPES.length &&
    new Set(value).size === value.length &&
    value.every(
      (scope) => typeof scope === "string" && (SCOPES as readonly string[]).includes(scope),
    )
  );
}

export function canAction(
  action: string,
  scopes: readonly string[],
  capabilities: Record<string, boolean>,
): boolean {
  const scope = ACTION_SCOPES[action];
  return Boolean(scope && scopes.includes(scope) && capabilities[scope] === true);
}
`;
}
