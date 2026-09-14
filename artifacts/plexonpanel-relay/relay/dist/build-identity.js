export const RELAY_VERSION = "3.4.1";
export const RELAY_PROTOCOL_VERSION = 3;
function safeCommit(value) {
    const commit = typeof value === "string" ? value.trim() : "";
    return /^[0-9a-f]{7,64}$/i.test(commit) ? commit : "unavailable";
}
function safeTimestamp(value) {
    const timestamp = typeof value === "string" ? value.trim() : "";
    if (!timestamp || !Number.isFinite(Date.parse(timestamp)))
        return "unavailable";
    return new Date(timestamp).toISOString();
}
export function relayBuildIdentity(runtimeKind, env = {}) {
    return {
        version: RELAY_VERSION,
        gitCommit: safeCommit(env.BUILD_GIT_COMMIT),
        buildTimestamp: safeTimestamp(env.BUILD_TIMESTAMP),
        protocolVersion: RELAY_PROTOCOL_VERSION,
        runtimeKind,
    };
}
//# sourceMappingURL=build-identity.js.map