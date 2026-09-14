export interface StandaloneConfig {
    host: string;
    port: number;
    databasePath: string;
    dashboardOrigins: ReadonlySet<string>;
    pairingCodePepper: string;
    accessTokenSecret: string;
    relayPrivateKey: string;
    relayPublicKey: string;
    dashboardLimit: number;
    unauthenticatedLimit: number;
    handshakeTimeoutMs: number;
    gracefulShutdownMs: number;
    trustedProxy: "none" | "cloudflare-loopback";
    allowPublicBind: boolean;
}
export declare function loadStandaloneConfig(env?: NodeJS.ProcessEnv): Promise<StandaloneConfig>;
