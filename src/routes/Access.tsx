import { useEffect, useRef, useState } from "react";
import { record, records, str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared, type Kind } from "../adapter/session";
import { ActionReview } from "../features/ActionReview";
import { Button, Notice, Panel, Status, Empty } from "../components/ui";
import { useSession } from "../hooks";
import { SectionLabel } from "../components/Telemetry";
import { reconcileDeviceGrant } from "../adapter/device-grant";
import { ACTION_SCOPES } from "../adapter/scopes";
import { useTimestamp } from "../presentation/nextgen/time";
import { ActionAvailability } from "../components/nextgen/ActionAvailability";
export default function Access() {
  const stamp = useTimestamp();
  const snap = useSession(),
    [devices, setDevices] = useState<JsonMap[]>([]),
    [audit, setAudit] = useState<JsonMap[]>([]),
    [error, setError] = useState(""),
    [auditError, setAuditError] = useState(""),
    [deviceError, setDeviceError] = useState(""),
    [prepared, setPrepared] = useState<Prepared | null>(null),
    [filter, setFilter] = useState(""),
    [authorityFilter, setAuthorityFilter] = useState(""),
    [loading, setLoading] = useState(false),
    [auditSource, setAuditSource] = useState<Kind>("HOST"),
    [view, setView] = useState("audit");
  const mounted = useRef(true),
    request = useRef(0);
  const grant = reconcileDeviceGrant(snap.grant, snap.state.ready?.device),
    deviceKind: Kind = session.reason("devices.list", "PAPER")
      ? "HOST"
      : "PAPER";
  const auditAction = grant?.scopes.includes("audit.view")
    ? "audit.list"
    : "audit.self";
  const refresh = async () => {
    const ticket = ++request.current;
    setLoading(true);
    setError("");
    setAudit([]);
    setAuditError("");
    setDeviceError("");
    const results = await Promise.allSettled([
      session.query("devices.list", {}, deviceKind),
      session.query(auditAction, { limit: 50 }, auditSource),
    ]);
    if (!mounted.current || ticket !== request.current) return;
    const failures: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failures.push(
          result.reason instanceof Error
            ? result.reason.message
            : "Access query unavailable.",
        );
        if (index === 0) {
          setDevices([]);
          setDeviceError(failures.at(-1) ?? "Device read unavailable");
        } else {
          setAudit([]);
          setAuditError(failures.at(-1) ?? "Audit read unavailable");
        }
      } else if (index === 0)
        setDevices(records(record(result.value.data).devices));
      else setAudit(records(record(result.value.data).entries));
    });
    setError([...new Set(failures)].join(" "));
    setLoading(false);
  };
  useEffect(() => {
    mounted.current = true;
    if (snap.phase === "live") void refresh();
    return () => {
      mounted.current = false;
      request.current++;
    };
  }, [snap.phase, snap.revision, auditSource]);
  const visible = audit.filter((entry) =>
    JSON.stringify(entry).toLowerCase().includes(filter.toLowerCase()),
  );
  const revoke = (id: string) => {
    try {
      setPrepared(session.prepare("devices.revoke", { deviceId: id }, "PAPER"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Revocation unavailable.",
      );
    }
  };
  return (
    <>
      <div className="access-command">
        <div className="workspace-tabs" role="group" aria-label="Access views">
          {[
            ["audit", "Operation trail"],
            ["devices", "Paired devices"],
            ["grant", "Your authority"],
          ].map(([key, label]) => (
            <button
              key={key}
              id={`access-view-${key}`}
              aria-pressed={view === key}
              className={view === key ? "active" : ""}
              onClick={() => setView(key)}
              onKeyDown={(event) => {
                if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const keys = ["audit", "devices", "grant"];
                const index = event.key === "Home" ? 0 : event.key === "End" ? 2 : (keys.indexOf(key) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
                setView(keys[index]);
                document.getElementById(`access-view-${keys[index]}`)?.focus();
              }}
            >
              {label}
              <span>
                {key === "audit"
                  ? audit.length
                  : key === "devices"
                    ? devices.length
                    : (grant?.scopes.length ?? "—")}
              </span>
            </button>
          ))}
        </div>
        <Button loading={loading} onClick={() => void refresh()}>
          Refresh access
        </Button>
      </div>
      <div hidden={view !== "audit"} className="audit-workspace">
        {" "}
        <SectionLabel
          index=""
          title="Operation audit"
          detail={
            auditAction === "audit.self"
              ? "This device only"
              : "Authorized audit scope"
          }
        />
        <Panel
          eyebrow={`${auditSource} / AUTHORITATIVE RECORDS`}
          title="Audit records"
        >
          {auditError && (
            <p className="read-error" role="status">
              Audit read unavailable: {auditError}
            </p>
          )}
          <div className="access-toolbar">
            <label className="field">
              <span className="sr-only">Filter audit</span>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter audit"
              />
            </label>
            <label className="field">
              <span className="sr-only">Audit authority</span>
              <select
                value={auditSource}
                onChange={(e) => {
                  request.current++;
                  setAudit([]);
                  setAuditSource(e.target.value as Kind);
                }}
              >
                <option value="HOST">Host audit</option>
                <option value="PAPER">Paper audit</option>
              </select>
            </label>
          </div>
          <div
            className="table-region"
            tabIndex={0}
            role="region"
            aria-label="Audit records"
          >
            <table>
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Actor</th>
                  <th>Operation</th>
                  <th>Target</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {visible.length ? (
                  visible.map((entry, index) => {
                    const outcome = str(
                      entry.outcome,
                      str(entry.status, "Unknown"),
                    );
                    return (
                      <tr key={`${str(entry.timestamp)}:${index}`}>
                        <td data-label="Recorded">
                          <time title={str(entry.timestamp)}>
                            {stamp(entry.timestamp)}
                          </time>
                        </td>
                        <td data-label="Actor">
                          {str(entry.actorLabel, str(entry.actor))}
                        </td>
                        <td data-label="Operation">
                          <code>
                            {str(entry.actionType, str(entry.action))}
                          </code>
                        </td>
                        <td data-label="Target">{str(entry.target)}</td>
                        <td data-label="Outcome">
                          <Status
                            tone={
                              outcome === "SUCCESS"
                                ? "success"
                                : outcome === "DEGRADED" ||
                                    outcome === "STARTED"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {str(entry.code, outcome)}
                          </Status>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5}>
                      {auditError
                        ? "Audit unavailable; this is not an empty authorized result."
                        : loading
                          ? "Reading authorized audit…"
                          : "No matching authorized records received."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <div hidden={view !== "devices"} className="devices-workspace">
        {" "}
        <Panel
          eyebrow={`DEVICE REGISTER / ${deviceKind === "PAPER" ? "PAPER AUTHORITY" : "HOST MIRROR"}`}
          title="Paired browser devices"
          description="Grants are immutable. Changes require revocation and a new pairing."
        >
          {deviceError && (
            <p className="read-error" role="status">
              Device register unavailable: {deviceError}
            </p>
          )}
          <div className="device-list">
            {devices.length ? (
              devices.map((device) => {
                const current =
                  str(device.deviceId) === snap.state.ready?.device.deviceId;
                return (
                  <div className="device-row" key={str(device.deviceId)}>
                    <div>
                      <strong>{str(device.name)}</strong>
                      <span>{str(device.deviceId)}</span>
                    </div>
                    <Status tone={current ? "success" : "neutral"}>
                      {current
                        ? "This browser"
                        : str(device.role, "Unknown role")}
                    </Status>
                    <span>
                      {Array.isArray(device.scopes)
                        ? `${device.scopes.length} scopes`
                        : "Scopes unknown"}
                    </span>
                    <Button
                      variant="danger"
                      disabled={
                        current || !!session.reason("devices.revoke", "PAPER")
                      }
                      title={
                        current
                          ? "The current browser cannot revoke itself here."
                          : session.reason("devices.revoke", "PAPER")
                      }
                      onClick={() => revoke(str(device.deviceId))}
                    >
                      Review revoke
                    </Button>
                    <ActionAvailability
                      reason={
                        current
                          ? "This browser cannot revoke itself here."
                          : session.reason("devices.revoke", "PAPER")
                      }
                    />
                  </div>
                );
              })
            ) : (
              <Empty title="No device register received">
                A current devices.view grant and an authorized agent are
                required.
              </Empty>
            )}
          </div>
        </Panel>
      </div>
      <div hidden={view !== "grant"} className="grant-workspace">
        {" "}
        <Panel eyebrow="THIS BROWSER / EFFECTIVE GRANT" title="Your authority">
          <div className="scope-view">
            <strong>
              {snap.state.ready?.device.name ?? "No signed device"}
            </strong>
            <span>{grant?.role ?? "Grant unavailable"}</span>
            <p className="subtle">
              Only scopes shared by the signed credential and reported grant
              apply.
            </p>
            <label className="field">
              Search authority
              <input
                value={authorityFilter}
                onChange={(e) => setAuthorityFilter(e.target.value)}
                placeholder="Action or exact scope"
              />
            </label>
            <div
              className="authority-ledger"
              role="region"
              tabIndex={0}
              aria-label="Effective device scopes"
            >
              <table>
                <caption>
                  Existing UI operations · immutable signed grant intersection
                </caption>
                <thead>
                  <tr>
                    <th>Action / agent</th>
                    <th>Effective scope</th>
                    <th>Capability</th>
                    <th>Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ACTION_SCOPES)
                    .filter(([action]) =>
                      [
                        "server.start",
                        "server.stop",
                        "server.restart",
                        "player.message",
                        "player.gamemode",
                        "player.whitelist.add",
                        "player.whitelist.remove",
                        "player.heal",
                        "player.feed",
                        "player.kick",
                        "player.ban",
                        "player.kill",
                        "player.op",
                        "player.deop",
                        "console.execute",
                        "chat.global.send",
                        "plugin.command.reload",
                        "backup.preflight",
                        "backup.full.list",
                        "backup.full.verify",
                        "backup.full.delete",
                        "backup.full.retry-upload",
                        "maintenance.status",
                        "maintenance.full-backup.create",
                        "devices.list",
                        "devices.revoke",
                        "audit.list",
                        "audit.self",
                        "players.history.list",
                      ].includes(action),
                    )
                    .filter(([a, scope]) =>
                      `${a} ${scope}`
                        .toLowerCase()
                        .includes(authorityFilter.toLowerCase()),
                    )
                    .map(([action, scope]) => {
                      const kind: Kind =
                        /^(server\.|backup\.|maintenance\.)/.test(action)
                          ? "HOST"
                          : action.startsWith("audit.")
                            ? auditSource
                            : action === "devices.list"
                              ? deviceKind
                              : "PAPER";
                      const caps =
                        kind === "HOST"
                          ? snap.state.ready?.server.hostCapabilities
                          : snap.state.ready?.server.paperCapabilities;
                      const capability = caps?.[scope];
                      const reason = session.reason(action, kind);
                      return (
                        <tr key={action}>
                          <td>
                            <strong>{action}</strong>
                            <small>{kind}</small>
                          </td>
                          <td>
                            <code>{scope}</code>
                            <small>
                              {grant?.scopes.includes(scope)
                                ? "Granted"
                                : "Not granted"}
                            </small>
                          </td>
                          <td>
                            {capability === true
                              ? "Enabled"
                              : capability === false
                                ? "Disabled"
                                : "Not reported"}
                          </td>
                          <td>
                            {reason ||
                              "Available for review; target revalidated on dispatch"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <details className="granted-scopes">
              <summary>All effective scope strings</summary>
              {grant?.scopes.map((scope) => (
                <code key={scope}>{scope}</code>
              ))}
            </details>
            <p>Local appearance preferences require no server grant.</p>
          </div>
        </Panel>
      </div>
      {error && (
        <div className="page-notice">
          <Notice tone="error" title="Some access evidence is unavailable">
            {error}
          </Notice>
        </div>
      )}
      <ActionReview
        prepared={prepared}
        onClose={() => {
          setPrepared(null);
          void refresh();
        }}
      />
    </>
  );
}
