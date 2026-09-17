"use client";

import {
  clearBrowserWorkspace,
  loadCachedWorkspace,
  loadRelayCredential,
  saveCachedWorkspace,
  saveRelayCredential,
  type RelayCredential,
} from "./browser-store";
import { ACTION_SCOPES, validScopes } from "./scopes";
import type { DashboardWorkspace } from "./dashboard-types";

export interface DashboardSessionResponse {
  authenticated: boolean;
  serverId?: string;
  workspace?: DashboardWorkspace;
  error?: string;
}

export interface LiveConnectionGrant {
  serverId: string;
  deviceId: string;
  role: string;
  scopes: string[];
  token: string;
  websocketUrl: string;
  expiresAt: string;
}

interface LiveSessionResponse {
  ok: boolean;
  protocolVersion: number;
  serverId: string;
  deviceId: string;
  role: string;
  scopes: string[];
  expiresAt: string;
}

export interface ActionCompletion {
  requestId: string;
  action: string;
  status: string;
  code: string;
  message: string;
  data: Record<string, unknown>;
}

interface PairingResponse extends RelayCredential {
  ok: boolean;
  fingerprint: string;
}

let activeSocket: WebSocket | null = null;
const pendingActions = new Map<
  string,
  {
    resolve: (value: ActionCompletion) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    action: string;
    agentKind?: "PAPER" | "HOST";
  }
>();

async function readJson<T>(response: Response): Promise<T> {
  let body: T & { error?: string };
  try {
    body = (await response.json()) as T & { error?: string };
  } catch {
    throw new DashboardRequestError(
      "The relay returned an invalid response",
      response.status,
    );
  }
  if (!response.ok)
    throw new DashboardRequestError(
      body.error ?? "Dashboard request failed",
      response.status,
    );
  return body;
}

function relayHttpUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_PLEXON_RELAY_URL?.trim() ?? "";
  if (!raw) throw new Error("The PlexonPanel relay URL is not configured.");
  const url = new URL(raw);
  const local =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local)
    throw new Error("The PlexonPanel relay must use HTTPS.");
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "The PlexonPanel relay URL must be an origin without credentials, a path, query, or fragment.",
    );
  }
  return url;
}

export async function loadDashboardSession(): Promise<DashboardSessionResponse> {
  const [credential, workspace] = await Promise.all([
    loadRelayCredential(),
    loadCachedWorkspace(),
  ]);
  if (!credential) return { authenticated: false };
  return {
    authenticated: true,
    serverId: credential.serverId,
    ...(workspace ? { workspace } : {}),
  };
}

export async function pairDashboardServer(
  code: string,
  name = "Browser device",
): Promise<{ serverId: string }> {
  const url = new URL("v1/pairings/claim", relayHttpUrl());
  const result = await readJson<PairingResponse>(
    await fetch(url, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ code, name }),
    }),
  );
  const websocket = new URL(result.websocketUrl);
  const relay = relayHttpUrl();
  const expectedProtocol = relay.protocol === "https:" ? "wss:" : "ws:";
  if (
    websocket.protocol !== expectedProtocol ||
    websocket.host !== relay.host ||
    websocket.pathname !== "/v1/dashboard" ||
    websocket.username ||
    websocket.password ||
    websocket.search ||
    websocket.hash
  ) {
    throw new Error("The relay returned an unsafe WebSocket URL.");
  }
  await saveRelayCredential({
    protocolVersion: result.protocolVersion,
    name: result.name,
    role: result.role,
    scopes: result.scopes,
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
  if (!credential)
    throw new DashboardRequestError(
      "This browser is not paired with a server",
      401,
    );
  const websocket = new URL(credential.websocketUrl);
  const relay = relayHttpUrl();
  if (
    websocket.protocol !== (relay.protocol === "https:" ? "wss:" : "ws:") ||
    websocket.host !== relay.host ||
    websocket.pathname !== "/v1/dashboard" ||
    websocket.username ||
    websocket.password ||
    websocket.search ||
    websocket.hash
  ) {
    await clearBrowserWorkspace();
    throw new DashboardRequestError(
      "The stored relay credential is invalid",
      401,
    );
  }
  const sessionUrl = new URL("v1/dashboard/session", relayHttpUrl());
  const session = await readJson<LiveSessionResponse>(
    await fetch(sessionUrl, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        Accept: "application/json",
      },
    }),
  );
  if (
    session.ok !== true ||
    session.protocolVersion !== 3 ||
    session.serverId !== credential.serverId ||
    typeof session.deviceId !== "string" ||
    !session.deviceId ||
    typeof session.role !== "string" ||
    !session.role ||
    !validScopes(session.scopes) ||
    !Number.isFinite(Date.parse(session.expiresAt)) ||
    Date.parse(session.expiresAt) <= Date.now()
  ) {
    throw new DashboardRequestError(
      "The relay returned an invalid signed session grant; pair this browser again.",
      401,
    );
  }
  return {
    serverId: session.serverId,
    deviceId: session.deviceId,
    role: session.role,
    scopes: session.scopes,
    token: credential.accessToken,
    websocketUrl: websocket.toString(),
    expiresAt: session.expiresAt,
  };
}

export function bindLiveSocket(socket: WebSocket | null): void {
  if (activeSocket && activeSocket !== socket)
    rejectPendingActions(
      "The connection closed before completion was observed. Check the local audit; this request will not be resent.",
    );
  activeSocket = socket;
}

function rejectionBoundary(
  relayRejected: boolean,
  code: string,
  agentKind?: "PAPER" | "HOST",
): string | undefined {
  if (relayRejected) {
    if (code === "SCOPE_DENIED") return "RELAY_SCOPE";
    if (code === "CAPABILITY_DISABLED") return "RELAY_CAPABILITY";
    if (code === "HOST_OFFLINE" || code === "PAPER_OFFLINE") return "RELAY_ROUTING";
    return undefined;
  }
  if (code === "SCOPE_DENIED") return agentKind === "HOST" ? "HOST_SCOPE" : "PAPER_SCOPE";
  if (code === "CAPABILITY_DISABLED" && agentKind === "HOST") return "HOST_CAPABILITY";
  if (code === "OPERATION_FAILED" && agentKind === "HOST") return "HOST_EXECUTION";
  return undefined;
}

export function handleRelayControlMessage(
  message: Record<string, unknown>,
): boolean {
  if (message.type === "dashboard.action_queued") return true;
  const result =
    message.type === "server.event" && message.eventType === "action.result"
      ? (message.body as Record<string, unknown>)
      : message;
  if (message.type !== "dashboard.action_rejected" && result === message)
    return false;
  const requestId =
    typeof result.requestId === "string" ? result.requestId : "";
  const pending = pendingActions.get(requestId);
  if (!pending) return true;
  clearTimeout(pending.timer);
  pendingActions.delete(requestId);
  if (result.status === "SUCCESS")
    pending.resolve(result as unknown as ActionCompletion);
  else {
    const code = String(result.code ?? "FAILED");
    const action = typeof result.action === "string" ? result.action : pending.action;
    const agentKind =
      result.agentKind === "HOST" || result.agentKind === "PAPER"
        ? result.agentKind
        : message.agentKind === "HOST" || message.agentKind === "PAPER"
          ? message.agentKind
          : pending.agentKind;
    const data =
      result.data !== null && typeof result.data === "object" && !Array.isArray(result.data)
        ? { ...(result.data as Record<string, unknown>) }
        : {};
    const boundary = rejectionBoundary(message.type === "dashboard.action_rejected", code, agentKind);
    if (boundary) data.rejectionBoundary = boundary;
    const requiredScope = ACTION_SCOPES[action];
    if (requiredScope) data.requiredScope = requiredScope;
    if (agentKind) data.agentKind = agentKind;
    data.runtimeKind = message.type === "dashboard.action_rejected" ? "relay" : agentKind?.toLowerCase() ?? "agent";
    pending.reject(
      new ActionError(
        typeof result.message === "string"
          ? result.message
          : typeof result.error === "string"
            ? result.error
            : "The operation was denied.",
        code,
        String(result.status ?? "DENIED"),
        requestId,
        action,
        data,
      ),
    );
  }
  return true;
}
export class ActionError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: string,
    readonly requestId = "",
    readonly action = "",
    readonly data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
export async function sendDashboardAction(
  action: string,
  parameters: Record<string, unknown>,
  agentKind?: "PAPER" | "HOST",
): Promise<ActionCompletion> {
  const socket = activeSocket;
  if (!socket || socket.readyState !== WebSocket.OPEN)
    throw new Error("The relay is not connected.");
  if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(action) || pendingActions.size >= 32)
    throw new Error("Request limit reached.");
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => {
        pendingActions.delete(requestId);
        reject(
          new Error(
            "Completion was not observed. Check the local audit before retrying.",
          ),
        );
      },
      action.startsWith("backup.") || action.startsWith("server.")
        ? 15 * 60000
        : 45000,
    );
    pendingActions.set(requestId, { resolve, reject, timer, action, agentKind });
    try {
      socket.send(
        JSON.stringify({
          type: "dashboard.action",
          requestId,
          action,
          parameters,
          ...(agentKind ? { agentKind } : {}),
        }),
      );
    } catch (error) {
      clearTimeout(timer);
      pendingActions.delete(requestId);
      reject(error);
    }
  });
}

export function cacheDashboardWorkspace(
  workspace: DashboardWorkspace,
): Promise<void> {
  return saveCachedWorkspace(workspace);
}

export async function logoutDashboard(): Promise<void> {
  const socket = activeSocket;
  activeSocket = null;
  rejectPendingActions(
    "This browser credential was removed before the action completed.",
  );
  if (socket && socket.readyState < WebSocket.CLOSING)
    socket.close(1000, "Dashboard device signed out");
  await clearBrowserWorkspace();
}

export class DashboardRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
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
