"use client";
import { useCallback } from "react";
import { session, useControl, record, type JsonMap } from "./index";
const READS = new Set(["backup.preflight", "maintenance.status", "maintenance.settings.get", "backup.full.list", "provider.status"]);
/** All calls retain the locked session's scope, generation and target checks. */
export function useHostInvoke() {
  const { revision, state } = useControl();
  return useCallback(async (action: string, parameters: JsonMap = {}) => {
    const result = READS.has(action)
      ? await session.query(action, parameters, "HOST")
      : await session.execute(session.prepare(action, parameters, "HOST"), true);
    if (result.status !== "SUCCESS") throw new Error(`${result.code}: ${result.message ?? "Host operation failed."}`);
    return record(result.data);
  }, [revision, state.serverId]);
}
