"use client";

import type { DashboardWorkspace } from "./dashboard-types";

export interface RelayCredential {
  serverId: string;
  deviceId: string;
  accessToken: string;
  websocketUrl: string;
  expiresAt: string;
}

const DATABASE_NAME = "plexonpanel-browser-v2";
const STORE_NAME = "workspace";
const CREDENTIAL_KEY = "active-credential";
const SNAPSHOT_KEY = "active-workspace";

export async function loadRelayCredential(): Promise<RelayCredential | null> {
  const credential = await readValue<RelayCredential>(CREDENTIAL_KEY);
  if (!validRelayCredential(credential) || Date.parse(credential.expiresAt) <= Date.now()) {
    if (credential) await clearBrowserWorkspace();
    return null;
  }
  return credential;
}

export async function saveRelayCredential(credential: RelayCredential): Promise<void> {
  if (!validRelayCredential(credential) || Date.parse(credential.expiresAt) <= Date.now()) {
    throw new Error("The relay returned an invalid browser credential");
  }
  await writeValue(CREDENTIAL_KEY, credential);
  await deleteValue(SNAPSHOT_KEY);
}

export async function loadCachedWorkspace(): Promise<DashboardWorkspace | null> {
  const workspace = await readValue<DashboardWorkspace>(SNAPSHOT_KEY);
  if (workspace && (!isRecord(workspace.overview) || !isRecord(workspace.management))) {
    await deleteValue(SNAPSHOT_KEY);
    return null;
  }
  return workspace;
}

export function saveCachedWorkspace(workspace: DashboardWorkspace): Promise<void> {
  return writeValue(SNAPSHOT_KEY, workspace);
}

export async function clearBrowserWorkspace(): Promise<void> {
  await Promise.all([deleteValue(CREDENTIAL_KEY), deleteValue(SNAPSHOT_KEY)]);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Browser storage could not be opened"));
    request.onblocked = () => reject(new Error("Browser storage upgrade is blocked by another open tab"));
  });
}

async function readValue<T>(key: string): Promise<T | null> {
  const database = await openDatabase();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Browser storage read failed"));
    });
  } finally {
    database.close();
  }
}

async function writeValue(key: string, value: unknown): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Browser storage write failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Browser storage write was aborted"));
    });
  } finally {
    database.close();
  }
}

async function deleteValue(key: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Browser storage delete failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Browser storage delete was aborted"));
    });
  } finally {
    database.close();
  }
}

function validRelayCredential(value: unknown): value is RelayCredential {
  if (!isRecord(value)) return false;
  return typeof value.serverId === "string" && UUID.test(value.serverId)
    && typeof value.deviceId === "string" && UUID.test(value.deviceId)
    && typeof value.accessToken === "string" && value.accessToken.length >= 64 && value.accessToken.length <= 4096
    && typeof value.websocketUrl === "string" && value.websocketUrl.length <= 2048
    && typeof value.expiresAt === "string" && Number.isFinite(Date.parse(value.expiresAt));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
