import { useEffect, useRef, useState } from "react";
import { record, records, str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared, type Kind } from "../adapter/session";
import { ActionReview } from "../features/ActionReview";
import { Button, Notice, Panel, Status, Empty } from "../components/ui";
import { useSession } from "../hooks";
import { SectionLabel } from "../components/Telemetry";
import { reconcileDeviceGrant } from "../adapter/device-grant";
export default function Access() {
  const snap = useSession(),
    [devices, setDevices] = useState<JsonMap[]>([]),
    [audit, setAudit] = useState<JsonMap[]>([]),
    [error, setError] = useState(""),
    [prepared, setPrepared] = useState<Prepared | null>(null),
    [filter, setFilter] = useState(""),
    [loading, setLoading] = useState(false),
    [auditSource, setAuditSource] = useState<Kind>("HOST");
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
        if (index === 0) setDevices([]);
        else setAudit([]);
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
      <div className="access-summary">
        <div>
          <strong>{devices.length.toString().padStart(2, "0")}</strong>
          <span>Reported devices</span>
        </div>
        <div>
          <strong>{grant?.scopes.length ?? "—"}</strong>
          <span>Effective scopes</span>
        </div>
        <div>
          <strong>{audit.length.toString().padStart(2, "0")}</strong>
          <span>Loaded records</span>
        </div>
        <Button loading={loading} onClick={() => void refresh()}>
          Refresh access
        </Button>
      </div>
      <div className="access-grid">
        <Panel
          eyebrow={`DEVICE REGISTER / ${deviceKind === "PAPER" ? "PAPER AUTHORITY" : "HOST MIRROR"}`}
          title="Paired browser devices"
          description="Grants are immutable. Changes require revocation and a new pairing."
        >
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
            <div
              role="region"
              tabIndex={0}
              aria-label="Effective device scopes"
            >
              {grant?.scopes.map((scope) => (
                <code key={scope}>{scope}</code>
              ))}
            </div>
          </div>
        </Panel>
      </div>
      <SectionLabel
        index="02"
        title="Operation audit"
        detail={
          auditAction === "audit.self"
            ? "This device only"
            : "Authorized audit scope"
        }
      />
      <Panel
        eyebrow={`${auditSource} / AUTHORITATIVE RECORDS`}
        title="Trace the operation"
      >
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
              onChange={(e) => setAuditSource(e.target.value as Kind)}
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
                      <td>{str(entry.timestamp)}</td>
                      <td>{str(entry.actorLabel, str(entry.actor))}</td>
                      <td>
                        <code>{str(entry.actionType, str(entry.action))}</code>
                      </td>
                      <td>{str(entry.target)}</td>
                      <td>
                        <Status
                          tone={
                            outcome === "SUCCESS"
                              ? "success"
                              : outcome === "DEGRADED" || outcome === "STARTED"
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
                  <td colSpan={5}>No matching authorized records received.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
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
