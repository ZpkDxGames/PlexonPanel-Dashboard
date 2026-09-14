import { type DashboardAccess } from "./security.js";
interface Env {
    SERVER_ROOMS: DurableObjectNamespace;
    PAIRING_DIRECTORY: DurableObjectNamespace;
    DASHBOARD_ORIGINS: string;
    PAIRING_CODE_PEPPER: string;
    ACCESS_TOKEN_SECRET: string;
    GATEWAY_ED25519_PRIVATE_KEY: string;
    GATEWAY_ED25519_PUBLIC_KEY: string;
}
interface AgentIdentity {
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
interface Device {
    deviceId: string;
    name: string;
    role: string;
    scopes: string[];
    issuedAt: number;
    expiresAt: number;
    lastSeen: number;
}
interface PairingRegistration {
    lookupId: string;
    serverId: string;
    requestId: string;
    challengeId: string;
    fingerprint: string;
    expiresAt: number;
}
interface RoomMetadata {
    protocolVersion: 3;
    identity?: AgentIdentity;
    hostIdentity?: AgentIdentity;
    paired: boolean;
    generation: number;
    revision: number;
    devices: Device[];
    currentPairing?: PairingRegistration;
}
declare const relayWorker: {
    fetch(request: Request, env: Env): Promise<Response>;
};
export default relayWorker;
export declare class PairingDirectory {
    private readonly state;
    private readonly env;
    constructor(state: DurableObjectState, env: Env);
    fetch(request: Request): Promise<Response>;
    alarm(): Promise<void>;
    private consumeRateLimit;
    private scheduleCleanup;
}
export declare class ServerRoom {
    private readonly state;
    private readonly env;
    private claiming;
    private messages;
    private queuedBytes;
    private pairingWaiters;
    private pending;
    constructor(state: DurableObjectState, env: Env);
    fetch(request: Request): Promise<Response>;
    webSocketMessage(socket: WebSocket, message: ArrayBuffer | string): Promise<void>;
    webSocketClose(socket: WebSocket): Promise<void>;
    webSocketError(socket: WebSocket): Promise<void>;
    alarm(): Promise<void>;
    private agentMessage;
    private dashboardMessage;
    private registerPairing;
    private metadata;
    private agents;
    private directory;
    private sendGateway;
    private sendGatewaySafely;
    private sendToAgent;
    private safeDashboardSend;
    private safeClose;
    private recordDiagnostic;
    private ready;
    private broadcastReady;
    private closeInvalid;
    private scheduleExpiry;
    private disconnected;
}
export declare function validDevice(value: unknown): value is Device;
export declare function currentAccess(m: RoomMetadata, access: DashboardAccess | undefined): boolean;
export declare function filterEvent(type: string, body: Record<string, unknown>, scopes: string[], caps: Record<string, boolean>): Record<string, unknown> | null;
