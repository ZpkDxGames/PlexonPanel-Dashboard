import { reconcileDeviceGrant } from "../adapter/device-grant";
import { effectiveGrantScopes } from "../adapter/authority";
import { classifyTelemetry, type TelemetryKind } from "../adapter/telemetry-freshness";
import type { ControlState } from "../adapter/control-state";
import type { DeviceGrantLike } from "../adapter/device-grant";

export type SourceStatus = {
  source: "Paper" | "Host";
  kind: TelemetryKind;
  label: string;
  usable: boolean;
  ageMs: number | null;
  skewAheadMs: number;
};

export function sourceStatus(state: ControlState, source: "Paper" | "Host", connected: boolean, now = Date.now()): SourceStatus {
  const paper = source === "Paper";
  const result = classifyTelemetry({
    capturedAt: paper ? state.server.capturedAt : state.hostSystem.capturedAt,
    receivedAt: paper ? state.receipts?.paperHealth : state.receipts?.hostSystem,
    connected,
    now,
  });
  return { source, ...result };
}

export function effectiveScopes(state: ControlState, grant: DeviceGrantLike | null): ReadonlySet<string> {
  const reconciled = reconcileDeviceGrant(grant, state.ready?.device);
  return effectiveGrantScopes(reconciled);
}

export function metric(value: unknown, unit: string, digits = 1): { value: string; unit: string; available: boolean } {
  if (typeof value !== "number" || !Number.isFinite(value)) return { value: "—", unit, available: false };
  return { value: value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }), unit, available: true };
}

export function bytes(value: unknown): { value: string; unit: string; available: boolean } {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return { value: "—", unit: "", available: false };
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let amount = value;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index++; }
  return { value: amount.toLocaleString(undefined, { maximumFractionDigits: index ? 1 : 0 }), unit: units[index], available: true };
}

export function entityDensity(entities: unknown, chunks: unknown): number | null {
  return typeof entities === "number" && Number.isFinite(entities) && typeof chunks === "number" && Number.isFinite(chunks) && chunks > 0 ? entities / chunks : null;
}
