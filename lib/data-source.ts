"use client";

import {
  clearBrowserWorkspace,
  loadCachedWorkspace,
  loadRelayCredential,
  saveCachedWorkspace,
  saveRelayCredential,
  type RelayCredential,
} from "./browser-store";
import type { DashboardWorkspace } from "./dashboard-types";

export interface DashboardSessionResponse {
  authenticated: boolean;
  serverId?: string;
  workspace?: DashboardWorkspace;
  error?: string;
}

export interface LiveConnectionGrant {
  token: string;
  websocketUrl: string;
  expiresAt: string;
}

interface PairingResponse extends RelayCredential {
  ok: boolean;
  fingerprint: string;
}

let activeSocket: WebSocket | null = null;
const pendingActions = new Map<string, {
  resolve: (value: { requestId: string }) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

async function readJson<T>(response: Response): Promise<T> {
  let body: T & { error?: string };
  try {
    body = await response.json() as T & { error?: string };
  } catch {
    throw new DashboardRequestError("The relay returned an invalid response", response.status);
  }
  if (!response.ok) throw new DashboardRequestError(body.error ?? "Dashboard request failed", response.status);
  return body;
}

function relayHttpUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_PLEXON_RELAY_URL?.trim() ?? "";
  if (!raw) throw new Error("The PlexonPanel relay URL is not configured.");
  const url = new URL(raw);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error("The PlexonPanel relay must use HTTPS.");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("The PlexonPanel relay URL must be an origin without credentials, a path, query, or fragment.");
  }
  return url;
}

export async function loadDashboardSession(): Promise<DashboardSessionResponse> {
  const [credential, workspace] = await Promise.all([loadRelayCredential(), loadCachedWorkspace()]);
  if (!credential) return { authenticated: false };
  return {
    authenticated: true,
    serverId: credential.serverId,
    ...(workspace ? { workspace } : {}),
  };
}

export async function pairDashboardServer(code: string): Promise<{ serverId: string }> {
  const url = new URL("v1/pairings/claim", relayHttpUrl());
  const result = await readJson<PairingResponse>(await fetch(url, {
    method: "POST",
    mode: "cors",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code }),
  }));
  const websocket = new URL(result.websocketUrl);
  const relay = relayHttpUrl();
  const expectedProtocol = relay.protocol === "https:" ? "wss:" : "ws:";
  if (websocket.protocol !== expectedProtocol || websocket.host !== relay.host
      || websocket.pathname !== "/v1/dashboard" || websocket.username || websocket.password
      || websocket.search || websocket.hash) {
    throw new Error("The relay returned an unsafe WebSocket URL.");
  }
  await saveRelayCredential({
    serverId: result.serverId,
    deviceId: result.deviceId,
    accessToken: result.accessToken,
    websocketUrl: websocket.toString(),
    expiresAt: result.expiresAt,
  });
  return { serverId: result.serverId };
}

export async function requestLiveConnection(): Promise<LiveConnectionGrant> {
  const credential = await loadRelayCredential();
  if (!credential) throw new DashboardRequestError("This browser is not paired with a server", 401);
  const websocket = new URL(credential.websocketUrl);
  const relay = relayHttpUrl();
  if (websocket.protocol !== (relay.protocol === "https:" ? "wss:" : "ws:") || websocket.host !== relay.host
      || websocket.pathname !== "/v1/dashboard" || websocket.username || websocket.password
      || websocket.search || websocket.hash) {
    await clearBrowserWorkspace();
    throw new DashboardRequestError("The stored relay credential is invalid", 401);
  }
  const sessionUrl = new URL("v1/dashboard/session", relayHttpUrl());
  await readJson<{ ok: boolean }>(await fetch(sessionUrl, {
    method: "GET",
    mode: "cors",
    cache: "no-store",
    headers: { Authorization: `Bearer ${credential.accessToken}`, Accept: "application/json" },
  }));
  return {
    token: credential.accessToken,
    websocketUrl: websocket.toString(),
    expiresAt: credential.expiresAt,
  };
}

export function bindLiveSocket(socket: WebSocket | null): void {
  if (activeSocket && activeSocket !== socket) rejectPendingActions("The relay connection closed before accepting the action.");
  activeSocket = socket;
}

export function handleRelayControlMessage(message: Record<string, unknown>): boolean {
  if (message.type !== "dashboard.action_queued" && message.type !== "dashboard.action_rejected") return false;
  const requestId = typeof message.requestId === "string" ? message.requestId : "";
  const pending = pendingActions.get(requestId);
  if (!pending) return true;
  clearTimeout(pending.timer);
  pendingActions.delete(requestId);
  if (message.type === "dashboard.action_queued") pending.resolve({ requestId });
  else pending.reject(new Error(typeof message.error === "string" ? message.error : "The relay rejected the action."));
  return true;
}

export async function sendDashboardAction(
  action: string,
  parameters: Record<string, unknown>,
): Promise<{ requestId: string }> {
  const socket = activeSocket;
  if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("The Paper server relay is not connected.");
  if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(action)) throw new Error("Invalid dashboard action");
  const requestId = crypto.randomUUID();
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingActions.delete(requestId);
      reject(new Error("The relay did not acknowledge the action in time."));
    }, 10_000);
    pendingActions.set(requestId, { resolve, reject, timer });
    try {
      socket.send(JSON.stringify({ type: "dashboard.action", requestId, action, parameters }));
    } catch (error) {
      clearTimeout(timer);
      pendingActions.delete(requestId);
      reject(error instanceof Error ? error : new Error("The action could not be sent."));
    }
  });
}

export function cacheDashboardWorkspace(workspace: DashboardWorkspace): Promise<void> {
  return saveCachedWorkspace(workspace);
}

export async function logoutDashboard(): Promise<void> {
  const socket = activeSocket;
  activeSocket = null;
  rejectPendingActions("This browser credential was removed before the action completed.");
  if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Dashboard device signed out");
  await clearBrowserWorkspace();
}

export class DashboardRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function rejectPendingActions(message: string): void {
  for (const pending of pendingActions.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error(message));
  }
  pendingActions.clear();
}

export type DashboardDataSource = () => Promise<DashboardWorkspace>;
