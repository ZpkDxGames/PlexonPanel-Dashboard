import { type DashboardAccess } from "../security.js";
import type { StandaloneConfig } from "./config.js";
import { CoordinationStore, type PairingRegistration, type StoredDevice, type StoredRoom } from "./persistence.js";
import { NodeWebSocket } from "./websocket.js";
export type AgentKind = "PAPER" | "HOST";
export interface RelayCounters {
    startedAt: number;
    connectionsAccepted: number;
    connectionsRejected: number;
    duplicateAgentsReplaced: number;
    authenticationFailures: number;
    protocolFailures: number;
    pairingClaims: number;
    pairingClaimFailures: number;
    rateLimitedPairingClaims: number;
    messagesAccepted: number;
    messagesRejected: number;
    recentDisconnects: string[];
}
interface PairingGrant {
    device: StoredDevice;
    generation: number;
    revision: number;
}
export declare class RoomManager {
    private readonly store;
    private readonly config;
    readonly counters: RelayCounters;
    private readonly rooms;
    constructor(store: CoordinationStore, config: StandaloneConfig, counters: RelayCounters);
    room(serverId: string): Room;
    roomCount(): number;
    socketCounts(): {
        paper: number;
        host: number;
        dashboards: number;
        unauthenticated: number;
    };
    closeAll(): void;
}
export declare class Room {
    readonly serverId: string;
    private metadata;
    private readonly store;
    private readonly config;
    private readonly counters;
    private paper;
    private host;
    private readonly candidates;
    private readonly dashboards;
    private readonly pending;
    private readonly pairingWaiters;
    private claiming;
    constructor(serverId: string, metadata: StoredRoom, store: CoordinationStore, config: StandaloneConfig, counters: RelayCounters);
    socketCounts(): {
        paper: number;
        host: number;
        dashboards: number;
        unauthenticated: number;
    };
    acceptsDashboard(access: DashboardAccess): boolean;
    attachAgent(socket: NodeWebSocket, kind: AgentKind): boolean;
    attachDashboard(socket: NodeWebSocket, access: DashboardAccess): boolean;
    claimPairing(registration: PairingRegistration, name: string): Promise<PairingGrant | null>;
    closeAll(): void;
    private agentMessage;
    private dashboardMessage;
    private replaceAgent;
    private agentDisconnected;
    private registerPairing;
    private resolvePairing;
    private applyAccessSync;
    private routeActionResult;
    private currentAccess;
    private ready;
    private broadcastReady;
    private closeInvalidDashboards;
    private sendToAgent;
    private sendGateway;
    private dashboardSend;
    private persist;
    private prunePending;
    private recordDisconnect;
    private log;
}
export {};
