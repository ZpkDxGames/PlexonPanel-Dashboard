import { copy } from "../i18n/en";
import { useEffect, useState } from "react";
import { record, records, str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { ActionReview } from "../features/ActionReview";
import { Button, Notice, Panel, Status } from "../components/ui";
import { useSession } from "../hooks";
import { effectiveScopes } from "../store/selectors";
export default function Access() {
  const snap = useSession();
  const [devices, setDevices] = useState<JsonMap[]>([]);
  const [audit, setAudit] = useState<JsonMap[]>([]);
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [filter, setFilter] = useState("");
  const refresh = async () => {
    setError("");
    try {
      const [d, a] = await Promise.all([
        session.query("devices.list", {}, "HOST"),
        session.query("audit.list", { limit: 50 }, "HOST"),
      ]);
      setDevices(records(record(d.data).devices));
      setAudit(records(record(a.data).entries));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Access data unavailable.",
      );
    }
  };
  useEffect(() => {
    if (snap.phase === "live") void refresh();
  }, [snap.phase, snap.revision]);
  const visible = audit.filter((entry) =>
    JSON.stringify(entry).toLowerCase().includes(filter.toLowerCase()),
  );
  const granted = [...effectiveScopes(snap.state, snap.grant)];
  const owner = snap.state.ready?.device.role === "Owner";
  return (
    <>
      <div className="access-grid">
        <Panel
          eyebrow={copy.trusted_browsers_18f26}
          title={copy.paired_devices_9559d}
          action={
            <Button onClick={() => void refresh()}>{copy.refresh_56e3b}</Button>
          }
        >
          <div className="device-list">
            {devices.length ? (
              devices.map((device) => (
                <div className="device-row" key={str(device.deviceId)}>
                  <div>
                    <strong>{str(device.name)}</strong>
                    <span>{str(device.deviceId)}</span>
                  </div>
                  <Status
                    tone={
                      str(device.deviceId) === snap.state.ready?.device.deviceId
                        ? "success"
                        : "neutral"
                    }
                  >
                    {str(device.role, "Unknown")}
                  </Status>
                  <span>
                    {Array.isArray(device.scopes)
                      ? `${device.scopes.length} scopes`
                      : "Scopes unavailable"}
                  </span>
                  <Button
                    variant="danger"
                    disabled={
                      str(device.deviceId) ===
                        snap.state.ready?.device.deviceId ||
                      Boolean(session.reason("devices.revoke", "HOST"))
                    }
                    onClick={() =>
                      setPrepared(
                        session.prepare(
                          "devices.revoke",
                          { deviceId: str(device.deviceId) },
                          "HOST",
                        ),
                      )
                    }
                  >
                    {copy.review_revoke_d9115}
                  </Button>
                </div>
              ))
            ) : (
              <div className="inline-empty">
                <strong>{copy.no_device_list_6f572}</strong>
                <span>{copy.requires_devices_view_from_the_host_ag_7617f}</span>
              </div>
            )}
          </div>
        </Panel>
        <Panel
          eyebrow={copy.permissions_for_this_browser_4db26}
          title={copy.current_device_e9261}
        >
          <div className="scope-view">
            <strong>
              {snap.state.ready?.device.name ?? "No signed device"}
            </strong>
            <span>
              {snap.state.ready?.device.role ?? "Unpaired"}
              {owner ? ` · Full control · ${granted.length} permissions` : ""}
            </span>
            <details>
              <summary>{copy.view_all_permissions_9a316}</summary>
              <div>
                {granted.map((scope) => (
                  <code key={scope}>{scope}</code>
                ))}
              </div>
            </details>
          </div>
        </Panel>
      </div>
      <Panel
        eyebrow={copy.recent_server_operations_71615}
        title={copy.audit_trail_33de8}
        action={
          <input
            className="compact-search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={copy.filter_audit_4b6b5}
            aria-label={copy.filter_audit_4b6b5}
          />
        }
      >
        <p className="table-scroll-hint">
          {copy.swipe_to_see_the_complete_audit_4d2f9}
        </p>
        <div className="table-region" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>{copy.time_6c82e}</th>
                <th>{copy.actor_cbd19}</th>
                <th>{copy.action_97c89}</th>
                <th>{copy.target_61ad5}</th>
                <th>{copy.result_5faa5}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map((entry, index) => (
                  <tr key={`${str(entry.timestamp)}:${index}`}>
                    <td>{str(entry.timestamp)}</td>
                    <td>{str(entry.actor)}</td>
                    <td>
                      <code>
                        {str(entry.action)
                          .replaceAll(
                            "maintenance.full-backup.create",
                            "Create restore point",
                          )
                          .replaceAll("backup.upload", "Upload backup")}
                      </code>
                    </td>
                    <td>{str(entry.target)}</td>
                    <td>
                      <Status
                        tone={
                          str(entry.status) === "SUCCESS"
                            ? "success"
                            : str(entry.status) === "DEGRADED"
                              ? "warning"
                              : "error"
                        }
                      >
                        {str(entry.status) === "SUCCESS"
                          ? "Completed"
                          : str(entry.status) === "DEGRADED"
                            ? "Needs attention"
                            : str(entry.status)}
                      </Status>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>{copy.no_matching_audit_entries_0061b}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {error && (
        <div className="page-notice">
          <Notice tone="error" title={copy.access_data_unavailable_0fb04}>
            {error}
          </Notice>
        </div>
      )}
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}
