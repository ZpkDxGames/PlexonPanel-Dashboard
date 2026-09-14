export interface DashboardAccess {
    version: 3;
    protocolVersion: 3;
    role: string;
    scopes: string[];
    audience: "plexonpanel-relay";
    serverId: string;
    deviceId: string;
    generation: number;
    issuedAt: number;
    expiresAt: number;
}
export declare function normalizePairingCode(value: unknown): string;
export declare function pairingLookupId(code: string, pepper: string): Promise<string>;
export declare function opaqueClientKey(address: string, pepper: string): Promise<string>;
export declare function signDashboardAccess(access: DashboardAccess, secret: string): Promise<string>;
export declare function verifyDashboardAccess(token: string, secret: string, nowSeconds?: number): Promise<DashboardAccess>;
