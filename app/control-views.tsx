"use client";
import { useCallback, useEffect, useState } from "react";
import { sendDashboardAction, type ActionCompletion } from "../lib/data-source";
import {
  number,
  str,
  type ControlState,
  type JsonMap,
} from "../lib/control-state";
import type { EffectiveDeviceGrant } from "../lib/device-grant";
export interface ViewProps {
  state: ControlState;
  deviceGrant?: EffectiveDeviceGrant;
  can: (action: string, kind?: "PAPER" | "HOST") => boolean;
  run: (
    action: string,
    parameters: JsonMap,
    kind?: "PAPER" | "HOST",
    confirmationMode?: "default" | "preconfirmed",
  ) => Promise<ActionCompletion>;
  notice: (message: string) => void;
  connected: boolean;
  setUnsaved?: (dirty: boolean) => void;
}
export function bytes(value: unknown): string {
  const n = number(value);
  if (n === null) return "Unavailable";
  if (n === 0) return "0 B";
  const unit = Math.min(4, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** unit).toFixed(unit ? 1 : 0)} ${["B", "KiB", "MiB", "GiB", "TiB"][unit]}`;
}
export function metric(value: unknown, suffix = "", digits = 1): string {
  const n = number(value);
  return n === null ? "—" : `${n.toFixed(digits)}${suffix}`;
}
export function time(value: unknown): string {
  const date =
    typeof value === "number"
      ? new Date(value * 1000)
      : new Date(str(value, ""));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "—";
}
export function duration(value: unknown): string {
  const n = number(value);
  if (n === null) return "—";
  const minutes = Math.floor(n / 60000);
  return minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
export function Badge({
  children,
  tone = "quiet",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`cr-badge ${tone}`}>{children}</span>;
}
export function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`cr-panel ${className}`}>
      <div className="cr-panel-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="cr-empty">
      <span className="cr-empty-mark" aria-hidden>
        ◇
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function ActionButton({
  children,
  onClick,
  danger = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => Promise<unknown>;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={danger ? "cr-button danger" : "cr-button"}
      disabled={busy || disabled}
      onClick={() => {
        setBusy(true);
        void onClick()
          .catch(() => {})
          .finally(() => setBusy(false));
      }}
    >
      {busy ? "Working…" : children}
    </button>
  );
}
export function useQuery(
  action: string,
  parameters: JsonMap,
  enabled: boolean,
  kind?: "PAPER" | "HOST",
) {
  const [data, setData] = useState<JsonMap>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [hasSuccess, setHasSuccess] = useState(false),
    [updatedAt, setUpdatedAt] = useState(0),
    [revision, setRevision] = useState(0);
  const key = JSON.stringify(parameters);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void Promise.resolve()
      .then(() => {
        if (current) {
          setBusy(true);
          setError("");
        }
        return sendDashboardAction(action, JSON.parse(key) as JsonMap, kind);
      })
      .then((result) => {
        if (current) {
          setData(result.data);
          setHasSuccess(true);
          setUpdatedAt(Date.now());
        }
      })
      .catch((e) => {
        if (current)
          setError(e instanceof Error ? e.message : "Request failed");
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [action, key, enabled, kind, revision]);
  return {
    data,
    error,
    busy,
    hasSuccess,
    updatedAt,
    refresh: useCallback(() => setRevision((r) => r + 1), []),
  };
}
export function ratio(a: unknown, b: unknown) {
  const x = number(a),
    y = number(b);
  return x !== null && y !== null && y > 0 ? (x / y) * 100 : null;
}
export function Agent({
  name,
  online,
  detail,
}: {
  name: string;
  online: boolean;
  detail: string;
}) {
  return (
    <div className="cr-agent">
      <span className={`cr-dot ${online ? "online" : ""}`} />
      <div>
        <strong>{name}</strong>
        <small>{detail}</small>
      </div>
      <Badge tone={online ? "green" : "quiet"}>
        {online ? "Connected" : "Disconnected"}
      </Badge>
    </div>
  );
}
