"use client";

import type { RelayCredential } from "./browser-store";
import { applyControlMessage, emptyControlState, record, type ControlState } from "./control-state";
import { DashboardRequestError, requestLiveConnection, type LiveConnectionGrant } from "./data-source";
import { reconcileDeviceGrant } from "./device-grant";
import { MAXIMUM_FLEET_CONNECTIONS } from "./fleet-contract";
import { ACTION_CONTRACT_ID } from "./scopes";

export type FleetPhase = "connecting" | "live" | "reconnecting" | "revoked" | "limited";
export interface FleetSnapshot { serverId: string; phase: FleetPhase; state: ControlState }
interface Entry {
  credential: RelayCredential; snapshot: FleetSnapshot; socket: WebSocket | null;
  retry?: ReturnType<typeof setTimeout>; heartbeat?: ReturnType<typeof setInterval>;
  expiry?: ReturnType<typeof setTimeout>; attempt: number; stopped: boolean;
}
interface Dependencies {
  grant: (credential: RelayCredential) => Promise<LiveConnectionGrant>;
  socket: (url: string, protocols: string[]) => WebSocket;
}
const passiveEvents = new Set(["telemetry.server", "telemetry.system", "service.status"]);

/** Room-bound read subscriptions. They never enter the action channel or persist a credential in a snapshot. */
export class FleetFeed {
  private entries = new Map<string, Entry>();
  private publishTimer?: ReturnType<typeof setTimeout>;
  private closed = false;
  constructor(private readonly publish: (value: FleetSnapshot[]) => void,
    private readonly dependencies: Dependencies = {
      grant: requestLiveConnection, socket: (url, protocols) => new WebSocket(url, protocols),
    }) {}

  updateRoster(credentials: readonly RelayCredential[], selectedId: string): void {
    if (this.closed) return;
    const unique = [...new Map(credentials.map(c => [c.serverId, c])).values()];
    const watched = new Set(unique.filter(c => c.serverId !== selectedId)
      .slice(0, MAXIMUM_FLEET_CONNECTIONS - (selectedId ? 1 : 0)).map(c => c.serverId));
    const remaining = new Set(unique.filter(c => c.serverId !== selectedId).map(c => c.serverId));
    for (const [id, entry] of this.entries) {
      const next = unique.find(c => c.serverId === id);
      if (!remaining.has(id) || !next || JSON.stringify(entry.credential) !== JSON.stringify(next) ||
          (entry.snapshot.phase === "limited") === watched.has(id)) {
        this.stop(entry); this.entries.delete(id);
      }
    }
    for (const credential of unique) {
      if (credential.serverId === selectedId || this.entries.has(credential.serverId)) continue;
      const entry: Entry = { credential, socket: null, attempt: 0, stopped: false,
        snapshot: { serverId: credential.serverId, phase: watched.has(credential.serverId) ? "connecting" : "limited",
          state: emptyControlState(credential.serverId) } };
      this.entries.set(credential.serverId, entry);
      if (watched.has(credential.serverId)) void this.connect(entry);
    }
    this.emit(true);
  }

  close(): void {
    this.closed = true;
    if (this.publishTimer) clearTimeout(this.publishTimer);
    for (const entry of this.entries.values()) this.stop(entry);
    this.entries.clear();
  }
  private emit(immediate = false): void {
    if (this.closed) return;
    if (immediate) {
      if (this.publishTimer) clearTimeout(this.publishTimer);
      this.publishTimer = undefined;
      this.publish([...this.entries.values()].map(entry => entry.snapshot));
    } else if (!this.publishTimer) this.publishTimer = setTimeout(() => this.emit(true), 500);
  }
  private stop(entry: Entry): void {
    entry.stopped = true;
    if (entry.retry) clearTimeout(entry.retry);
    this.clearConnection(entry);
    entry.socket?.close(1000, "Fleet subscription changed");
    entry.socket = null;
  }
  private clearConnection(entry: Entry): void {
    if (entry.heartbeat) clearInterval(entry.heartbeat);
    if (entry.expiry) clearTimeout(entry.expiry);
    entry.heartbeat = undefined; entry.expiry = undefined;
  }
  private revoke(entry: Entry): void {
    if (entry.stopped) return;
    this.clearConnection(entry);
    const socket = entry.socket; entry.socket = null;
    entry.snapshot = { ...entry.snapshot, phase: "revoked", state: emptyControlState(entry.credential.serverId) };
    socket?.close(4003, "Grant unavailable");
    this.emit(true);
  }
  private retry(entry: Entry): void {
    if (entry.stopped || this.closed || entry.snapshot.phase === "revoked") return;
    this.clearConnection(entry);
    entry.snapshot = { ...entry.snapshot, phase: "reconnecting", state: { ...entry.snapshot.state, ready: null } };
    entry.attempt++;
    entry.retry = setTimeout(() => { entry.retry = undefined; void this.connect(entry); },
      Math.min(30_000, 1000 * 2 ** Math.min(entry.attempt, 5)));
    this.emit(true);
  }
  private async connect(entry: Entry): Promise<void> {
    if (entry.stopped || this.closed) return;
    try {
      const grant = await this.dependencies.grant(entry.credential);
      if (entry.stopped || this.closed) return;
      if (grant.serverId !== entry.credential.serverId || grant.deviceId !== entry.credential.deviceId ||
          grant.token !== entry.credential.accessToken || grant.actionContract !== ACTION_CONTRACT_ID) {
        this.revoke(entry); return;
      }
      const socket = this.dependencies.socket(grant.websocketUrl, ["plexonpanel-v3", `auth.${grant.token}`]);
      entry.socket = socket;
      const current = () => !entry.stopped && !this.closed && entry.socket === socket;
      const checkExpiry = () => {
        const remaining = Date.parse(grant.expiresAt) - Date.now();
        if (!current()) return;
        if (!Number.isFinite(remaining) || remaining <= 0) this.revoke(entry);
        else entry.expiry = setTimeout(checkExpiry, Math.min(2_147_483_647, remaining));
      };
      checkExpiry();
      socket.onopen = () => {
        if (!current()) { socket.close(); return; }
        entry.heartbeat = setInterval(() => {
          if (current() && socket.readyState === 1) socket.send(JSON.stringify({ type: "dashboard.ping" }));
        }, 20_000);
      };
      socket.onmessage = event => {
        if (!current() || typeof event.data !== "string" || event.data.length > 131_072) return;
        try {
          const message = record(JSON.parse(event.data));
          if (message.serverId !== entry.credential.serverId) return;
          if (message.type === "dashboard.ready") {
            const device = record(message.device);
            const effective = reconcileDeviceGrant(grant,
              typeof device.deviceId === "string" && typeof device.role === "string" &&
              Array.isArray(device.scopes) && device.scopes.every(s => typeof s === "string")
                ? { deviceId: device.deviceId, role: device.role, scopes: device.scopes } : null);
            if (message.protocolVersion !== 3 || (message.actionContract !== undefined && message.actionContract !== ACTION_CONTRACT_ID) ||
                !effective?.metadataMatches || typeof record(message.agents).paper !== "boolean" ||
                typeof record(message.agents).host !== "boolean") { this.revoke(entry); return; }
            entry.attempt = 0;
            entry.snapshot = { ...entry.snapshot, phase: "live", state: applyControlMessage(entry.snapshot.state, message) };
            this.emit(true);
          } else if (message.type === "server.event" && entry.snapshot.phase === "live" && passiveEvents.has(String(message.eventType))) {
            const ready = entry.snapshot.state.ready;
            if (message.agentKind !== "HOST" && message.agentKind !== "PAPER") return;
            if (message.agentKind === "HOST" ? !ready?.agents.host : !ready?.agents.paper) return;
            if (message.eventType === "service.status" && message.agentKind !== "HOST") return;
            entry.snapshot = { ...entry.snapshot, state: { ...applyControlMessage(entry.snapshot.state, message), history: [] } };
            this.emit();
          }
        } catch { /* Untrusted or unsupported events never change another room. */ }
      };
      socket.onclose = event => {
        if (!current()) return;
        entry.socket = null;
        if (event.code === 4003) this.revoke(entry);
        else this.retry(entry);
      };
      socket.onerror = () => { /* onclose owns retry; no credential-bearing error is displayed. */ };
    } catch (error) {
      if (entry.stopped || this.closed) return;
      if (error instanceof DashboardRequestError && (error.status === 401 || error.status === 403)) this.revoke(entry);
      else this.retry(entry);
    }
  }
}
