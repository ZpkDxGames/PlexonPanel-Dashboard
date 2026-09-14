export interface StoredRoom {
    protocolVersion: 3;
    identity?: StoredAgentIdentity;
    hostIdentity?: StoredAgentIdentity;
    paired: boolean;
    generation: number;
    revision: number;
    devices: StoredDevice[];
    currentPairing?: PairingRegistration;
}
export interface StoredAgentIdentity {
    publicKey: string;
    fingerprint: string;
    pluginVersion: string;
    paperVersion: string;
    minecraftVersion: string;
    javaVersion: string;
    operatingSystem: string;
    capabilities: Record<string, boolean>;
    hostPublicKey: string;
}
export interface StoredDevice {
    deviceId: string;
    name: string;
    role: string;
    scopes: string[];
    issuedAt: number;
    expiresAt: number;
    lastSeen: number;
}
export interface PairingRegistration {
    lookupId: string;
    serverId: string;
    requestId: string;
    challengeId: string;
    fingerprint: string;
    expiresAt: number;
}
export declare class CoordinationStore {
    private readonly db;
    constructor(path: string);
    private migrate;
    loadRoom(serverId: string): StoredRoom;
    saveRoom(serverId: string, room: StoredRoom): void;
    registerPairing(registration: PairingRegistration): "ok" | "collision";
    resolvePairingByLookup(lookupId: string): PairingRegistration | null;
    deletePairing(lookupId: string): void;
    consumePairingRateLimit(clientKey: string, now?: number): boolean;
    prune(now?: number, limit?: number): {
        pairings: number;
        rateLimits: number;
    };
    counts(): {
        rooms: number;
        pairings: number;
        rateLimits: number;
    };
    close(): void;
    private transaction;
}
export declare function emptyRoom(): StoredRoom;
