export declare const RELAY_VERSION: "3.4.1";
export declare const RELAY_PROTOCOL_VERSION: 3;
export interface RelayBuildEnvironment {
    BUILD_GIT_COMMIT?: string | undefined;
    BUILD_TIMESTAMP?: string | undefined;
}
export interface RelayBuildIdentity {
    version: string;
    gitCommit: string;
    buildTimestamp: string;
    protocolVersion: 3;
    runtimeKind: "cloudflare-worker" | "standalone";
}
export declare function relayBuildIdentity(runtimeKind: RelayBuildIdentity["runtimeKind"], env?: RelayBuildEnvironment): RelayBuildIdentity;
