import type { DashboardWorkspace } from "./dashboard-types";

export interface DashboardSessionResponse {
  authenticated: boolean;
  serverId?: string;
  state?: Record<string, unknown>;
  error?: string;
}

export interface LiveConnectionGrant {
  token: string;
  websocketUrl: string;
  expiresIn: number;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new DashboardRequestError(body.error ?? "Dashboard request failed", response.status);
  }
  return body;
}

export async function loadDashboardSession(): Promise<DashboardSessionResponse> {
  const response = await fetch("/api/session", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401) {
    return { authenticated: false, ...(await response.json() as { error?: string }) };
  }
  return readJson<DashboardSessionResponse>(response);
}

export async function pairDashboardServer(code: string): Promise<{ serverId: string }> {
  return readJson(await fetch("/api/pair", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code }),
  }));
}

export async function requestLiveConnection(): Promise<LiveConnectionGrant> {
  return readJson(await fetch("/api/live-token", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  }));
}

export async function sendDashboardAction(
  action: string,
  parameters: Record<string, unknown>,
): Promise<{ requestId: string }> {
  return readJson(await fetch("/api/actions", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action, parameters }),
  }));
}

export async function logoutDashboard(): Promise<void> {
  await readJson(await fetch("/api/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  }));
}

export class DashboardRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type DashboardDataSource = () => Promise<DashboardWorkspace>;
