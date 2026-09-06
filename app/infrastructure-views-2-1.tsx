"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionButton,
  Badge,
  Empty,
  Panel,
  time,
  useQuery,
  type ViewProps,
} from "./control-views";
import { number, records, str, type JsonMap } from "../lib/control-state";

function metricDuration(value: unknown) {
  const result = number(value);
  return result === null ? "—" : `${result} ms`;
}

function expired(value: unknown) {
  const timestamp = number(value);
  return timestamp !== null && timestamp < Date.now();
}

export function AuditView21(props: ViewProps) {
  const [kind, setKind] = useState<"PAPER" | "HOST">("PAPER");
  const [filters, setFilters] = useState({
    search: "",
    actor: "",
    action: "",
    target: "",
    outcome: "",
    from: "",
    to: "",
  });
  const [submitted, setSubmitted] = useState<JsonMap>({});
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<JsonMap | null>(null);
  const action = props.can("audit.list", kind) ? "audit.list" : "audit.self";
  const allowed = props.can(action, kind);
  const query = useQuery(action, { ...submitted, page }, allowed, kind);
  const entries = records(query.data.entries, 50);
  const visible = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) =>
      [
        entry.actorLabel,
        entry.role,
        entry.actionType,
        entry.target,
        entry.outcome,
        entry.code,
        entry.requestId,
      ].some((value) => str(value, "").toLowerCase().includes(needle)),
    );
  }, [entries, filters.search]);

  return (
    <>
      <form
        className="cr21-audit-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setSubmitted({
            actor: filters.actor,
            action: filters.action,
            target: filters.target,
            outcome: filters.outcome,
            ...(filters.from
              ? { from: new Date(filters.from).toISOString() }
              : {}),
            ...(filters.to ? { to: new Date(filters.to).toISOString() } : {}),
          });
        }}
      >
        <label className="wide">
          Search loaded records
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
            placeholder="Request ID, actor, action, target or result"
          />
        </label>
        <label>
          Source
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as "PAPER" | "HOST");
              setPage(0);
            }}
          >
            <option value="PAPER">Paper</option>
            {props.state.ready?.agents.host && (
              <option value="HOST">Host</option>
            )}
          </select>
        </label>
        {(["actor", "action", "target", "outcome"] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              value={filters[key]}
              onChange={(event) =>
                setFilters({ ...filters, [key]: event.target.value })
              }
            />
          </label>
        ))}
        {(["from", "to"] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              type="datetime-local"
              value={filters[key]}
              onChange={(event) =>
                setFilters({ ...filters, [key]: event.target.value })
              }
            />
          </label>
        ))}
        <button className="cr-button primary">Apply server filters</button>
        <button
          className="cr-button"
          type="button"
          onClick={query.refresh}
          disabled={query.busy}
        >
          {query.busy ? "Refreshing…" : "Refresh"}
        </button>
      </form>

      {query.error && (
        <p className="cr-alert" role="alert">
          {query.error}
        </p>
      )}

      <Panel
        title={
          action === "audit.self"
            ? "Your device audit"
            : "Local authoritative audit"
        }
        aside={<Badge>{visible.length} loaded</Badge>}
      >
        {!allowed ? (
          <Empty title="Audit access unavailable" />
        ) : visible.length ? (
          <div className="cr-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor / role</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Outcome</th>
                  <th>Duration</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry, index) => (
                  <tr key={`${entry.requestId}-${index}`}>
                    <td>{time(entry.timestamp)}</td>
                    <td>
                      {str(entry.actorLabel)}
                      <small>{str(entry.role)}</small>
                    </td>
                    <td>
                      {str(entry.actionType)}
                      <small>{str(entry.requestId)}</small>
                    </td>
                    <td>{str(entry.target)}</td>
                    <td>
                      <Badge
                        tone={
                          entry.outcome === "SUCCESS"
                            ? "green"
                            : entry.outcome === "STARTED"
                              ? "cyan"
                              : entry.outcome === "DENIED"
                                ? "amber"
                                : "quiet"
                        }
                      >
                        {str(entry.outcome)}
                      </Badge>
                      {entry.code !== undefined && (
                        <small>{str(entry.code)}</small>
                      )}
                    </td>
                    <td>{metricDuration(entry.durationMillis)}</td>
                    <td>
                      <button
                        className="cr-button"
                        onClick={() => setSelected(entry)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={query.busy ? "Loading audit…" : "No matching records"} />
        )}
      </Panel>

      <div className="cr21-pagination">
        <button
          className="cr-button"
          disabled={!page}
          onClick={() => setPage((current) => current - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1} · 50 records per page</span>
        <button
          className="cr-button"
          disabled={!query.data.hasMore}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </button>
      </div>
      <p className="cr-hint">
        Records remain authoritative on the selected local agent. This viewer
        searches a bounded query window and does not copy the audit database to
        Vercel or the relay.
      </p>

      {selected && (
        <AuditDialog21
          entry={selected}
          close={() => setSelected(null)}
          notice={props.notice}
        />
      )}
    </>
  );
}

function AuditDialog21({
  entry,
  close,
  notice,
}: {
  entry: JsonMap;
  close: () => void;
  notice: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  const json = JSON.stringify(entry, null, 2);
  return (
    <dialog
      className="cr-drawer cr21-player-drawer"
      ref={ref}
      onCancel={close}
      aria-labelledby="audit-entry-title"
    >
      <div className="cr-panel-head">
        <div>
          <small>Audit entry</small>
          <h2 id="audit-entry-title">{str(entry.actionType)}</h2>
        </div>
        <button className="cr-button" onClick={close} aria-label="Close audit entry">
          ×
        </button>
      </div>
      <div className="cr21-drawer-section">
        <dl className="cr-details">
          {[
            ["Request ID", entry.requestId],
            ["Timestamp", time(entry.timestamp)],
            ["Actor", entry.actorLabel],
            ["Role", entry.role],
            ["Target", entry.target],
            ["Outcome", entry.outcome],
            ["Code", entry.code],
            ["Duration", metricDuration(entry.durationMillis)],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{String(label)}</dt>
              <dd>{String(value ?? "—")}</dd>
            </div>
          ))}
        </dl>
        <div className="cr-actions">
          <button
            className="cr-button"
            onClick={() =>
              void navigator.clipboard
                .writeText(str(entry.requestId, ""))
                .then(() => notice("Request ID copied."))
            }
          >
            Copy request ID
          </button>
          <button
            className="cr-button"
            onClick={() =>
              void navigator.clipboard
                .writeText(json)
                .then(() => notice("Audit entry JSON copied."))
            }
          >
            Copy JSON
          </button>
        </div>
        <pre className="cr-output cr21-audit-json">{json}</pre>
      </div>
    </dialog>
  );
}

export function AccessView21(
  props: ViewProps & { forget: () => Promise<void>; pair: () => void },
) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ALL");
  const [selected, setSelected] = useState<JsonMap | null>(null);
  const query = useQuery("devices.list", {}, props.can("devices.list"));
  const current = props.state.ready?.device;
  const devices = useMemo(() => {
    return records(query.data.devices, 64).filter((device) => {
      const matchesSearch =
        str(device.name, "").toLowerCase().includes(search.toLowerCase()) ||
        str(device.deviceId, "").toLowerCase().includes(search.toLowerCase());
      return matchesSearch && (role === "ALL" || device.role === role);
    });
  }, [query.data.devices, search, role]);
  const roles = useMemo(
    () =>
      Array.from(
        new Set(records(query.data.devices, 64).map((device) => str(device.role))),
      ).filter(Boolean),
    [query.data.devices],
  );

  return (
    <>
      <Panel title="This device" aside={<Badge tone="cyan">{current?.role ?? "Unknown role"}</Badge>}>
        <div className="cr-pad">
          <h3>{current?.name ?? "Browser"}</h3>
          <p>
            Expires {time(current?.expiresAt)} · Paired {time(current?.issuedAt)}
          </p>
          <div className="cr-scope-list">
            {current?.scopes.map((scope) => (
              <Badge key={scope}>{scope}</Badge>
            ))}
          </div>
          <div className="cr-actions">
            <button className="cr-button" onClick={props.pair}>
              Pair another server
            </button>
            <ActionButton danger onClick={props.forget}>
              Forget this device
            </ActionButton>
          </div>
          <p className="cr-hint">
            Pairing a new device always requires a code generated locally with
            /plexonpanel pair &lt;role&gt;.
          </p>
        </div>
      </Panel>

      {props.can("devices.list") && (
        <>
          <div className="cr21-filter-toolbar">
            <label className="cr-search">
              Search devices
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Device name or ID"
              />
            </label>
            <label>
              Role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="ALL">All roles</option>
                {roles.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <button
              className="cr-button"
              disabled={query.busy}
              onClick={query.refresh}
            >
              {query.busy ? "Refreshing…" : "Refresh"}
            </button>
            <Badge>{devices.length} shown</Badge>
          </div>

          <Panel title="Paired devices">
            {devices.length ? (
              <div className="cr-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Role</th>
                      <th>Issued</th>
                      <th>Last seen</th>
                      <th>Expires</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device) => {
                      const isCurrent = device.deviceId === current?.deviceId;
                      const isExpired = expired(device.expiresAt);
                      return (
                        <tr key={str(device.deviceId)}>
                          <td>
                            <strong>{str(device.name)}</strong>
                            <small>{str(device.deviceId)}</small>
                          </td>
                          <td>
                            <Badge tone={device.role === "Owner" ? "cyan" : "quiet"}>
                              {str(device.role)}
                            </Badge>
                          </td>
                          <td>{time(device.issuedAt)}</td>
                          <td>{time(device.lastSeen)}</td>
                          <td>{time(device.expiresAt)}</td>
                          <td>
                            {isCurrent ? (
                              <Badge tone="green">Current device</Badge>
                            ) : isExpired ? (
                              <Badge tone="amber">Expired</Badge>
                            ) : (
                              <Badge>Paired</Badge>
                            )}
                          </td>
                          <td>
                            <div className="cr-actions">
                              <button
                                className="cr-button"
                                onClick={() => setSelected(device)}
                              >
                                Scopes
                              </button>
                              {props.can("devices.revoke") && !isCurrent && (
                                <ActionButton
                                  danger
                                  onClick={() =>
                                    props
                                      .run("devices.revoke", {
                                        deviceId: device.deviceId,
                                      })
                                      .then(() => query.refresh())
                                  }
                                >
                                  Revoke
                                </ActionButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No devices match these filters" />
            )}
            {query.error && (
              <p className="cr-alert" role="alert">
                {query.error}
              </p>
            )}
          </Panel>
        </>
      )}

      {selected && (
        <DeviceDialog21
          device={selected}
          currentDeviceId={current?.deviceId}
          close={() => setSelected(null)}
        />
      )}
    </>
  );
}

function DeviceDialog21({
  device,
  currentDeviceId,
  close,
}: {
  device: JsonMap;
  currentDeviceId?: string;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  const scopes = Array.isArray(device.scopes) ? device.scopes.map(String) : [];
  return (
    <dialog
      className="cr-drawer cr21-player-drawer"
      ref={ref}
      onCancel={close}
      aria-labelledby="device-title"
    >
      <div className="cr-panel-head">
        <div>
          <small>Device permissions</small>
          <h2 id="device-title">{str(device.name)}</h2>
        </div>
        <button className="cr-button" onClick={close} aria-label="Close device details">
          ×
        </button>
      </div>
      <div className="cr21-drawer-section">
        <div className="cr-actions">
          <Badge tone={device.role === "Owner" ? "cyan" : "quiet"}>
            {str(device.role)}
          </Badge>
          {device.deviceId === currentDeviceId && (
            <Badge tone="green">Current device</Badge>
          )}
          {expired(device.expiresAt) && <Badge tone="amber">Expired</Badge>}
        </div>
        <dl className="cr-details">
          <div>
            <dt>Device ID</dt>
            <dd>{str(device.deviceId)}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{time(device.issuedAt)}</dd>
          </div>
          <div>
            <dt>Expires</dt>
            <dd>{time(device.expiresAt)}</dd>
          </div>
          <div>
            <dt>Last seen</dt>
            <dd>{time(device.lastSeen)}</dd>
          </div>
        </dl>
        <h3>Granted scopes</h3>
        {scopes.length ? (
          <div className="cr-scope-list">
            {scopes.map((scope) => (
              <Badge key={scope}>{scope}</Badge>
            ))}
          </div>
        ) : (
          <Empty title="No scopes reported" />
        )}
        <p className="cr-hint">
          Connected/disconnected state is not inferred from last-seen time. Only
          explicit agent/device data is shown here.
        </p>
      </div>
    </dialog>
  );
}
