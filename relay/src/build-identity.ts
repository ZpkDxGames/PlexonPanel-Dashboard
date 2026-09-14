export const RELAY_VERSION = "3.4.1" as const;
export const RELAY_PROTOCOL_VERSION = 3 as const;

export interface RelayBuildEnvironment {
  BUILD_GIT_COMMIT?: string;
  BUILD_TIMESTAMP?: string;
}

export interface RelayBuildIdentity {
  version: string;
  gitCommit: string;
  buildTimestamp: string;
  protocolVersion: 3;
  runtimeKind: "cloudflare-worker" | "standalone";
}

function safeCommit(value: unknown): string {
  const commit = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f]{7,64}$/i.test(commit) ? commit : "unavailable";
}

function safeTimestamp(value: unknown): string {
  const timestamp = typeof value === "string" ? value.trim() : "";
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return "unavailable";
  return new Date(timestamp).toISOString();
}

export function relayBuildIdentity(
  runtimeKind: RelayBuildIdentity["runtimeKind"],
  env: RelayBuildEnvironment = {},
): RelayBuildIdentity {
  return {
    version: RELAY_VERSION,
    gitCommit: safeCommit(env.BUILD_GIT_COMMIT),
    buildTimestamp: safeTimestamp(env.BUILD_TIMESTAMP),
    protocolVersion: RELAY_PROTOCOL_VERSION,
    runtimeKind,
  };
}
