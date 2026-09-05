"use client";
import type { DashboardWorkspace } from "./dashboard-types";
import { safeCache, type ControlState } from "./control-state";
import { validScopes } from "./scopes";
export interface RelayCredential {
  protocolVersion: 3;
  serverId: string;
  deviceId: string;
  name: string;
  role: string;
  scopes: string[];
  accessToken: string;
  websocketUrl: string;
  expiresAt: string;
}
const DB = "plexonpanel-browser-v3",
  STORE = "workspace";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Browser storage is blocked by another tab"));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode),
        request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error ?? new Error("Browser storage transaction aborted"));
    });
  } finally {
    db.close();
  }
}
const read = <T>(key: string) =>
  transaction<T | undefined>("readonly", (s) => s.get(key));
const write = (key: string, value: unknown) =>
  transaction("readwrite", (s) => s.put(value, key));
const remove = (key: string) => transaction("readwrite", (s) => s.delete(key));
function valid(c: RelayCredential | undefined): c is RelayCredential {
  return Boolean(
    c &&
      c.protocolVersion === 3 &&
      typeof c.serverId === "string" &&
      typeof c.deviceId === "string" &&
      typeof c.accessToken === "string" &&
      c.accessToken.length < 8192 &&
      validScopes(c.scopes) &&
      Date.parse(c.expiresAt) > Date.now(),
  );
}
export async function listRelayCredentials(): Promise<RelayCredential[]> {
  return (await transaction<unknown[]>("readonly", (s) => s.getAll())).filter(
    (v): v is RelayCredential => valid(v as RelayCredential),
  );
}
export async function loadRelayCredential(): Promise<RelayCredential | null> {
  const selected = await read<string>("selected");
  if (!selected) return null;
  const c = await read<RelayCredential>(`credential:${selected}`);
  if (valid(c)) return c;
  await remove(`credential:${selected}`);
  await remove(`cache:${selected}`);
  await remove("selected");
  return null;
}
export async function selectRelayCredential(id: string): Promise<void> {
  const c = await read<RelayCredential>(`credential:${id}`);
  if (!valid(c))
    throw new Error("This server credential has expired. Pair again.");
  await write("selected", id);
}
export async function saveRelayCredential(c: RelayCredential): Promise<void> {
  if (!valid(c)) throw new Error("Invalid protocol 3 credential");
  await write(`credential:${c.serverId}`, c);
  await write("selected", c.serverId);
  await remove(`cache:${c.serverId}`);
  indexedDB.deleteDatabase("plexonpanel-browser-v2");
}
export async function loadControlCache(
  id: string,
): Promise<ControlState | null> {
  const cached = await read<ControlState>(`cache:${id}`);
  return cached &&
    cached.serverId === id &&
    Date.now() - cached.updatedAt < 3600000
    ? safeCache(cached)
    : null;
}
export async function saveControlCache(state: ControlState): Promise<void> {
  await write(`cache:${state.serverId}`, safeCache(state));
}
export async function clearBrowserWorkspace(): Promise<void> {
  const id = await read<string>("selected");
  if (id) {
    await remove(`credential:${id}`);
    await remove(`cache:${id}`);
  }
  await remove("selected");
  indexedDB.deleteDatabase("plexonpanel-browser-v2");
}
// Legacy transformation helpers remain available to isolated migration tests; live v3 uses server-specific state.
export async function loadCachedWorkspace(): Promise<DashboardWorkspace | null> {
  return null;
}
export async function saveCachedWorkspace(
  _workspace: DashboardWorkspace,
): Promise<void> {
  void _workspace;
}
