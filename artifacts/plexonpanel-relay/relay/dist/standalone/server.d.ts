import { createServer } from "node:http";
import { type StandaloneConfig } from "./config.js";
import { CoordinationStore } from "./persistence.js";
import { RoomManager, type RelayCounters } from "./room-manager.js";
export interface StandaloneRelay {
    readonly config: StandaloneConfig;
    readonly counters: RelayCounters;
    readonly store: CoordinationStore;
    readonly rooms: RoomManager;
    readonly server: ReturnType<typeof createServer>;
    start(): Promise<void>;
    close(): Promise<void>;
}
export declare function createStandaloneRelay(config: StandaloneConfig): StandaloneRelay;
export declare function main(): Promise<void>;
