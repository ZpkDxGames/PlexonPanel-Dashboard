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
let selectionRevision = 0;
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
export async function loadServerLabels(): Promise<Record<string, string>> {
  const entries = await transaction<unknown[]>("readonly", s => s.getAll());
  const labels: Record<string, string> = {};
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as { kind?: string; serverId?: string; label?: string };
    if (value.kind === "server-label" && typeof value.serverId === "string" && validLabel(value.label))
      labels[value.serverId] = value.label;
  }
  return labels;
}
function validLabel(label: unknown): label is string {
  return typeof label === "string" && label.trim().length > 0 && label.length <= 80 && !/[\u0000-\u001f\u007f]/.test(label);
}
export async function saveServerLabel(serverId: string, label: string): Promise<void> {
  if (!serverId || !validLabel(label)) return;
  await write(`label:${serverId}`, { kind: "server-label", serverId, label });
}
async function writeSelection(id: string, revision: number): Promise<void> {
  const db = await openDatabase();
  try {
    if (revision !== selectionRevision) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(id, "selected");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Browser storage transaction aborted"));
    });
  } finally { db.close(); }
}
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
  await clearBrowserWorkspace(selected);
  return null;
}
export async function selectRelayCredential(id: string): Promise<void> {
  const revision = ++selectionRevision;
  const c = await read<RelayCredential>(`credential:${id}`);
  if (revision !== selectionRevision) return;
  if (!valid(c))
    throw new Error("This server credential has expired. Pair again.");
  await writeSelection(id, revision);
}
export async function saveRelayCredential(c: RelayCredential): Promise<void> {
  const revision = ++selectionRevision;
  if (!valid(c)) throw new Error("Invalid protocol 3 credential");
  await write(`credential:${c.serverId}`, c);
  await writeSelection(c.serverId, revision);
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
export async function clearBrowserWorkspace(serverId?: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite"), store = tx.objectStore(STORE);
      const selected = store.get("selected");
      selected.onsuccess = () => {
        const id = serverId ?? selected.result;
        if (typeof id === "string" && id) {
          store.delete(`credential:${id}`);
          store.delete(`cache:${id}`);
          store.delete(`label:${id}`);
          if (selected.result === id) store.delete("selected");
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Browser storage transaction aborted"));
    });
  } finally { db.close(); }
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
