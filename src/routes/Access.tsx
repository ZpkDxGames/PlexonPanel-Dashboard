import { useEffect, useMemo, useState } from "react";
import { record, records, str, type JsonMap } from "../adapter/control-state";
import { SCOPES, type Scope } from "../adapter/scopes";
import { session, type Kind, type Prepared } from "../adapter/session";
import { ActionReview } from "../features/ActionReview";
import { Button, Notice, Panel, Status } from "../components/ui";
import { useSession } from "../hooks";
import { effectiveScopes } from "../store/selectors";
import { formatDateTime } from "../lib/time";

type AuditEntry = JsonMap & { _agent?: Kind };

function scopeGroup(scope: Scope): string {
  if (scope === "overview.view" || scope === "telemetry.view")
    return "Telemetry";
  if (scope.startsWith("players.") || scope.startsWith("player."))
    return "Players";
  if (scope.startsWith("console.") || scope.startsWith("chat."))
    return "Console & chat";
  if (scope.startsWith("plugins.") || scope.startsWith("files."))
    return "Plugins & files";
  if (
    scope.startsWith("backup.") ||
    scope.startsWith("maintenance.") ||
    scope.startsWith("provider.") ||
    scope.startsWith("server.")
  )
    return "Operations";
  return "Access & settings";
}

function auditValue(entry: JsonMap, preferred: string, legacy: string) {
  return str(entry[preferred], str(entry[legacy], ""));
}

function auditTone(outcome: string): "success" | "warning" | "error" | "neutral" {
  const upper = outcome.toUpperCase();
  if (upper === "SUCCESS" || upper === "COMPLETED") return "success";
  if (upper === "STARTED" || upper === "QUEUED" || upper === "DEGRADED")
    return "warning";
  if (!upper) return "neutral";
  return "error";
}

export default function Access() {
  const snap = useSession();
  const [devices, setDevices] = useState<JsonMap[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [deviceSource, setDeviceSource] = useState<Kind | null>(null);
  const [deviceError, setDeviceError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = snap.state.ready;
  const granted = useMemo(
    () => effectiveScopes(snap.state, snap.grant),
    [snap.state, snap.grant],
  );
  const owner = ready?.device.role === "Owner";

  const connected = (kind: Kind) =>
    Boolean(ready?.agents[kind === "PAPER" ? "paper" : "host"]);
  const capabilities = (kind: Kind) =>
    kind === "PAPER"
      ? (ready?.server.paperCapabilities ?? {})
      : (ready?.server.hostCapabilities ?? {});

  const usableKind = (action: string, order: Kind[]): Kind | null =>
    order.find((kind) => !session.reason(action, kind)) ?? null;

  const refresh = async () => {
    setBusy(true);
    setDeviceError("");
    setAuditError("");

    const deviceKind = usableKind("devices.list", ["PAPER", "HOST"]);
    if (deviceKind) {
      try {
        const result = await session.query("devices.list", {}, deviceKind);
        setDevices(records(record(result.data).devices));
        setDeviceSource(deviceKind);
      } catch (cause) {
        setDevices([]);
        setDeviceSource(null);
        setDeviceError(
          cause instanceof Error ? cause.message : "Device registry unavailable.",
        );
      }
    } else {
      setDevices([]);
      setDeviceSource(null);
      const paperReason = session.reason("devices.list", "PAPER");
      const hostReason = session.reason("devices.list", "HOST");
      setDeviceError(
        paperReason && hostReason
          ? `Paper: ${paperReason} Host: ${hostReason}`
          : paperReason || hostReason || "Device registry unavailable.",
      );
    }

    const requests: Promise<AuditEntry[]>[] = [];
    for (const kind of ["PAPER", "HOST"] as const) {
      const action = !session.reason("audit.list", kind)
        ? "audit.list"
        : !session.reason("audit.self", kind)
          ? "audit.self"
          : "";
      if (!action) continue;
      requests.push(
        session
          .query(action, { page: 0 }, kind)
          .then((result) =>
            records(record(result.data).entries, 50).map((entry) => ({
              ...entry,
              _agent: kind,
            })),
          ),
      );
    }

    if (requests.length) {
      const settled = await Promise.allSettled(requests);
      const entries = settled.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );
      entries.sort((a, b) =>
        auditValue(b, "timestamp", "time").localeCompare(
          auditValue(a, "timestamp", "time"),
        ),
      );
      setAudit(entries.slice(0, 100));
      if (!entries.length && settled.every((result) => result.status === "rejected"))
        setAuditError("Both Paper and Host audit sources rejected the request.");
    } else {
      setAudit([]);
      setAuditError(
        "Neither connected agent currently advertises an audit capability for this device.",
      );
    }

    setBusy(false);
  };

  useEffect(() => {
    if (snap.phase === "live") void refresh();
  }, [
    snap.phase,
    snap.revision,
    ready?.server.paperSession,
    ready?.server.hostSession,
  ]);

  const visible = audit.filter((entry) =>
    JSON.stringify(entry).toLowerCase().includes(filter.toLowerCase()),
  );

  const groups = useMemo(() => {
    const result = new Map<string, Scope[]>();
    for (const scope of SCOPES) {
      const group = scopeGroup(scope);
      result.set(group, [...(result.get(group) ?? []), scope]);
    }
    return [...result.entries()];
  }, []);

  const paperAvailable = SCOPES.filter(
    (scope) =>
      granted.has(scope) &&
      connected("PAPER") &&
      capabilities("PAPER")[scope] === true,
  ).length;
  const hostAvailable = SCOPES.filter(
    (scope) =>
      granted.has(scope) &&
      connected("HOST") &&
      capabilities("HOST")[scope] === true,
  ).length;

  const revokeReason = session.reason("devices.revoke", "PAPER");

  return (
    <>
      <div className="access-summary-grid">
        <Panel
          eyebrow="Negotiated authority"
          title="Permission center"
          action={
            <Button disabled={busy} onClick={() => void refresh()}>
              {busy ? "Refreshing…" : "Refresh"}
            </Button>
          }
        >
          <div className="access-identity">
            <div>
              <span className="eyebrow">Current browser</span>
              <strong>{ready?.device.name ?? "No signed device"}</strong>
              <small>
                {ready?.device.role ?? "Unpaired"}
                {owner ? " · canonical full-control role" : ""}
              </small>
            </div>
            <div className="access-counts">
              <span>
                <b>{granted.size}</b>
                Dashboard grant
              </span>
              <span>
                <b>{paperAvailable}</b>
                Effective on Paper
              </span>
              <span>
                <b>{hostAvailable}</b>
                Effective on Host
              </span>
            </div>
          </div>
          <p className="access-explainer">
            A permission is usable only when the signed browser grant and the
            selected agent capability both allow it. Telemetry and actions are
            never enabled from the UI alone.
          </p>
        </Panel>

        <Panel eyebrow="Agent boundary" title="Live authority">
          <div className="authority-agents">
            {(["PAPER", "HOST"] as const).map((kind) => {
              const live = connected(kind);
              const supported = SCOPES.filter(
                (scope) => capabilities(kind)[scope] === true,
              ).length;
              const effective = SCOPES.filter(
                (scope) =>
                  live &&
                  granted.has(scope) &&
                  capabilities(kind)[scope] === true,
              ).length;
              return (
                <div className="authority-agent" key={kind}>
                  <span>
                    <i className={live ? "ok" : "bad"} />
                    <strong>{kind === "PAPER" ? "Paper agent" : "Host agent"}</strong>
                  </span>
                  <b>{live ? "Connected" : "Offline"}</b>
                  <small>
                    {supported} advertised · {effective} effective
                  </small>
                </div>
              );
            })}
          </div>
          <Notice tone="warning" title="No local privilege escalation">
            Roles and grants are issued by the server-side pairing/access
            authority. This page can inspect and revoke devices, but it cannot
            manufacture permissions that an agent does not advertise.
          </Notice>
        </Panel>
      </div>

      <Panel
        eyebrow="Grant × agent capability"
        title="Effective permissions"
        className="permission-center"
      >
        <div className="permission-groups">
          {groups.map(([group, scopes]) => (
            <section className="permission-group" key={group}>
              <header>
                <strong>{group}</strong>
                <span>
                  {
                    scopes.filter(
                      (scope) =>
                        granted.has(scope) &&
                        ((connected("PAPER") &&
                          capabilities("PAPER")[scope] === true) ||
                          (connected("HOST") &&
                            capabilities("HOST")[scope] === true)),
                    ).length
                  }
                  /{scopes.length} usable
                </span>
              </header>
              <div className="permission-table" tabIndex={0}>
                <div className="permission-row permission-head">
                  <span>Permission</span>
                  <span>Browser</span>
                  <span>Paper</span>
                  <span>Host</span>
                </div>
                {scopes.map((scope) => {
                  const browser = granted.has(scope);
                  const paper =
                    connected("PAPER") &&
                    capabilities("PAPER")[scope] === true;
                  const host =
                    connected("HOST") && capabilities("HOST")[scope] === true;
                  return (
                    <div className="permission-row" key={scope}>
                      <code>{scope}</code>
                      <Status tone={browser ? "success" : "neutral"}>
                        {browser ? "Granted" : "Denied"}
                      </Status>
                      <Status
                        tone={
                          !connected("PAPER")
                            ? "neutral"
                            : paper
                              ? "success"
                              : "warning"
                        }
                      >
                        {!connected("PAPER")
                          ? "Offline"
                          : paper
                            ? "Allowed"
                            : "Not advertised"}
                      </Status>
                      <Status
                        tone={
                          !connected("HOST")
                            ? "neutral"
                            : host
                              ? "success"
                              : "warning"
                        }
                      >
                        {!connected("HOST")
                          ? "Offline"
                          : host
                            ? "Allowed"
                            : "Not advertised"}
                      </Status>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Panel>

      <div className="access-grid access-data-grid">
        <Panel
          eyebrow={
            deviceSource
              ? `${deviceSource === "PAPER" ? "Paper authority" : "Host mirror"} · trusted browsers`
              : "Trusted browsers"
          }
          title="Paired devices"
          action={
            <Status tone={deviceSource ? "success" : "neutral"}>
              {devices.length} visible
            </Status>
          }
        >
          <div className="device-list">
            {devices.length ? (
              devices.map((device) => {
                const current =
                  str(device.deviceId) === ready?.device.deviceId;
                return (
                  <div className="device-row" key={str(device.deviceId)}>
                    <div>
                      <strong>{str(device.name, "Unnamed device")}</strong>
                      <span>{str(device.deviceId)}</span>
                    </div>
                    <Status tone={current ? "success" : "neutral"}>
                      {current ? "Current · " : ""}
                      {str(device.role, "Unknown")}
                    </Status>
                    <span>
                      {Array.isArray(device.scopes)
                        ? `${device.scopes.length} scopes`
                        : "Scopes unavailable"}
                    </span>
                    <Button
                      variant="danger"
                      disabled={current || Boolean(revokeReason)}
                      title={
                        current
                          ? "The current browser cannot revoke itself here."
                          : revokeReason
                      }
                      onClick={() =>
                        setPrepared(
                          session.prepare(
                            "devices.revoke",
                            { deviceId: str(device.deviceId) },
                            "PAPER",
                          ),
                        )
                      }
                    >
                      Review revoke
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="inline-empty">
                <strong>No device registry available</strong>
                <span>
                  {deviceError ||
                    "Waiting for a connected authority that can expose trusted devices."}
                </span>
              </div>
            )}
          </div>
        </Panel>

        <Panel eyebrow="Signed browser authority" title="Current device">
          <div className="scope-view">
            <strong>{ready?.device.name ?? "No signed device"}</strong>
            <span>
              {ready?.device.role ?? "Unpaired"} · {granted.size} effective
              browser permissions
            </span>
            <details>
              <summary>View signed/effective grant</summary>
              <div>
                {[...granted].map((scope) => (
                  <code key={scope}>{scope}</code>
                ))}
              </div>
            </details>
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Paper + Host"
        title="Audit trail"
        action={
          <input
            className="compact-search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter audit"
            aria-label="Filter audit"
          />
        }
      >
        <p className="table-scroll-hint">
          Swipe horizontally to see the complete audit entry.
        </p>
        <div className="table-region" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map((entry, index) => {
                  const timestamp = auditValue(entry, "timestamp", "time");
                  const actor = auditValue(entry, "actorLabel", "actor");
                  const action = auditValue(entry, "actionType", "action");
                  const outcome = auditValue(entry, "outcome", "status");
                  return (
                    <tr
                      key={`${str(entry.requestId, timestamp)}:${entry._agent ?? "unknown"}:${outcome}:${index}`}
                    >
                      <td>
                        {timestamp ? formatDateTime(timestamp) : "Unavailable"}
                      </td>
                      <td>
                        <Status
                          tone={entry._agent === "HOST" ? "neutral" : "success"}
                        >
                          {entry._agent ?? "Unknown"}
                        </Status>
                      </td>
                      <td>{actor || str(entry.deviceId, "Unknown")}</td>
                      <td>
                        <code>{action || "Unknown action"}</code>
                      </td>
                      <td>{str(entry.target, "—")}</td>
                      <td>
                        <Status tone={auditTone(outcome)}>
                          {outcome || "Unknown"}
                        </Status>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    {auditError || "No matching audit entries."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {(deviceError || auditError) && (devices.length > 0 || audit.length > 0) && (
        <div className="page-notice">
          <Notice tone="warning" title="Partial access data">
            {[deviceError, auditError].filter(Boolean).join(" ")}
          </Notice>
        </div>
      )}

      <ActionReview
        prepared={prepared}
        onClose={() => setPrepared(null)}
        onComplete={() => void refresh()}
      />
    </>
  );
}
