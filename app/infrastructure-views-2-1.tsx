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
import { SCOPES, type Scope } from "../lib/scopes";

function metricDuration(value: unknown) {
  const result = number(value);
  return result === null ? "—" : `${result} ms`;
}

function expired(value: unknown) {
  const timestamp = number(value);
  return timestamp !== null && timestamp < Date.now();
}

function outcomeTone(value: unknown): "green" | "cyan" | "amber" | "quiet" {
  return value === "SUCCESS"
    ? "green"
    : value === "STARTED"
      ? "cyan"
      : value === "DENIED" || value === "FAILED"
        ? "amber"
        : "quiet";
}

export function AuditView21(props: ViewProps) {
  const [kind, setKind] = useState<"PAPER" | "HOST">("PAPER");
  const [filters, setFilters] = useState({
    search: "",
    actor: "",
    action: "",
    outcome: "",
    from: "",
    to: "",
  });
  const [submitted, setSubmitted] = useState<JsonMap>({});
  const [page, setPage] = useState(0);
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

  const applyServerFilters = () => {
    setPage(0);
    setSubmitted({
      actor: filters.actor,
      action: filters.action,
      outcome: filters.outcome,
      ...(filters.from ? { from: new Date(filters.from).toISOString() } : {}),
      ...(filters.to ? { to: new Date(filters.to).toISOString() } : {}),
    });
  };

  return (
    <div className="cr30-audit-stack">
      <form
        className="cr30-audit-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          applyServerFilters();
        }}
      >
        <label className="cr-search cr30-audit-search">
          <span className="sr-only">Search loaded audit records</span>
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
            placeholder="Search actor, action, target or request ID"
          />
        </label>
        <label>
          <span className="sr-only">Audit source</span>
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as "PAPER" | "HOST");
              setPage(0);
            }}
          >
            <option value="PAPER">Paper audit</option>
            {props.state.ready?.agents.host && <option value="HOST">Host audit</option>}
          </select>
        </label>
        <button
          className="cr-button"
          type="button"
          onClick={query.refresh}
          disabled={query.busy}
        >
          {query.busy ? "Refreshing…" : "Refresh"}
        </button>
        <details className="cr30-audit-filters">
          <summary className="cr-button">More filters</summary>
          <div>
            <label>
              Actor / device
              <input
                value={filters.actor}
                onChange={(event) =>
                  setFilters({ ...filters, actor: event.target.value })
                }
              />
            </label>
            <label>
              Action / category
              <input
                value={filters.action}
                onChange={(event) =>
                  setFilters({ ...filters, action: event.target.value })
                }
              />
            </label>
            <label>
              Outcome
              <input
                value={filters.outcome}
                onChange={(event) =>
                  setFilters({ ...filters, outcome: event.target.value })
                }
              />
            </label>
            <label>
              From
              <input
                type="datetime-local"
                value={filters.from}
                onChange={(event) =>
                  setFilters({ ...filters, from: event.target.value })
                }
              />
            </label>
            <label>
              To
              <input
                type="datetime-local"
                value={filters.to}
                onChange={(event) =>
                  setFilters({ ...filters, to: event.target.value })
                }
              />
            </label>
            <button className="cr-button primary" type="submit">
              Apply filters
            </button>
          </div>
        </details>
      </form>

      {query.error && (
        <p className="cr-alert" role="alert">
          {query.error}
        </p>
      )}

      <Panel
        title={action === "audit.self" ? "Your device audit" : "Audit timeline"}
        aside={<Badge>{visible.length} loaded</Badge>}
      >
        {!allowed ? (
          <Empty title="Audit access unavailable" />
        ) : visible.length ? (
          <div className="cr30-audit-list" role="list">
            <div className="cr30-audit-columns" aria-hidden="true">
              <span>Time</span>
              <span>Actor / device</span>
              <span>Action</span>
              <span>Target</span>
              <span>Outcome</span>
            </div>
            {visible.map((entry, index) => {
              const json = JSON.stringify(entry, null, 2);
              return (
                <article
                  className="cr30-audit-event"
                  role="listitem"
                  key={`${entry.requestId}-${index}`}
                >
                  <div className="cr30-audit-event-main">
                    <div data-label="Time">
                      <strong>{time(entry.timestamp)}</strong>
                      <small>{metricDuration(entry.durationMillis)}</small>
                    </div>
                    <div data-label="Actor / device">
                      <strong>{str(entry.actorLabel)}</strong>
                      <small>{str(entry.role)}</small>
                    </div>
                    <div data-label="Action">
                      <strong>{str(entry.actionType)}</strong>
                      <small>{str(entry.requestId)}</small>
                    </div>
                    <div data-label="Target">
                      <span>{str(entry.target)}</span>
                    </div>
                    <div data-label="Outcome">
                      <Badge tone={outcomeTone(entry.outcome)}>
                        {str(entry.outcome)}
                      </Badge>
                      {entry.code !== undefined && <small>{str(entry.code)}</small>}
                    </div>
                  </div>
                  <details className="cr30-audit-details">
                    <summary>Advanced event details</summary>
                    <div className="cr30-audit-detail-body">
                      <dl className="cr-details">
                        <div><dt>Request ID</dt><dd>{str(entry.requestId)}</dd></div>
                        <div><dt>Timestamp</dt><dd>{time(entry.timestamp)}</dd></div>
                        <div><dt>Duration</dt><dd>{metricDuration(entry.durationMillis)}</dd></div>
                        <div><dt>Code</dt><dd>{str(entry.code)}</dd></div>
                      </dl>
                      <div className="cr-actions">
                        <button
                          className="cr-button"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(str(entry.requestId, ""))
                              .then(() => props.notice("Request ID copied."))
                          }
                        >
                          Copy request ID
                        </button>
                        <button
                          className="cr-button"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(json)
                              .then(() => props.notice("Audit entry JSON copied."))
                          }
                        >
                          Copy JSON
                        </button>
                      </div>
                      <pre className="cr-output cr21-audit-json">{json}</pre>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty title={query.busy ? "Loading audit…" : "No matching records"} />
        )}
      </Panel>

      <div className="cr21-pagination cr30-audit-pagination">
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
      <p className="cr-hint cr30-audit-authority">
        Records remain authoritative on the selected local agent. This viewer
        searches a bounded query window and does not copy the audit database to
        Vercel or the relay.
      </p>
    </div>
  );
}

type CapabilityGroup = {
  label: string;
  scopes: readonly Scope[];
  future?: boolean;
};

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    label: "Monitoring",
    scopes: ["overview.view", "telemetry.view"],
  },
  {
    label: "Players",
    scopes: SCOPES.filter(
      (scope) => scope.startsWith("players.") || scope.startsWith("player."),
    ),
  },
  {
    label: "Console & Chat",
    scopes: SCOPES.filter(
      (scope) => scope.startsWith("console.") || scope.startsWith("chat."),
    ),
  },
  {
    label: "Plugins",
    scopes: SCOPES.filter((scope) => scope.startsWith("plugins.")),
  },
  {
    label: "Server",
    scopes: SCOPES.filter((scope) => scope.startsWith("server.")),
  },
  {
    label: "Security / Access",
    scopes: SCOPES.filter(
      (scope) =>
        scope.startsWith("audit.") ||
        scope.startsWith("devices.") ||
        scope === "settings.view",
    ),
  },
  {
    label: "Advanced / Future",
    future: true,
    scopes: SCOPES.filter(
      (scope) => scope.startsWith("files.") || scope.startsWith("backup."),
    ),
  },
];

function localCapability(
  scope: Scope,
  paper: Record<string, boolean>,
  host: Record<string, boolean>,
) {
  return paper[scope] === true || host[scope] === true;
}

export function AccessView21(
  props: ViewProps & { forget: () => Promise<void>; pair: () => void },
) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ALL");
  const [selected, setSelected] = useState<JsonMap | null>(null);
  const query = useQuery("devices.list", {}, props.can("devices.list"));
  const current = props.state.ready?.device;
  const ready = props.state.ready;
  const paperCapabilities = ready?.server.paperCapabilities ?? {};
  const hostCapabilities = ready?.server.hostCapabilities ?? {};
  const currentScopes = new Set<string>(current?.scopes ?? []);
  const locallyEnabledButUngraded = SCOPES.filter(
    (scope) =>
      localCapability(scope, paperCapabilities, hostCapabilities) &&
      !currentScopes.has(scope),
  );
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
    <div className="cr30-access-stack">
      <Panel
        title="This device"
        aside={<Badge tone="cyan">{current?.role ?? "Unknown role"}</Badge>}
      >
        <div className="cr30-device-summary">
          <div className="cr30-device-identity">
            <span className="cr30-device-mark" aria-hidden="true">
              {current?.name?.slice(0, 1).toUpperCase() ?? "B"}
            </span>
            <div>
              <h3>{current?.name ?? "Browser"}</h3>
              <p>{props.state.serverId || "Server unavailable"}</p>
            </div>
          </div>
          <dl className="cr30-device-facts">
            <div><dt>Role</dt><dd>{current?.role ?? "Unknown"}</dd></div>
            <div><dt>Connection</dt><dd>{props.connected ? "Live" : "Offline"}</dd></div>
            <div><dt>Credential expiry</dt><dd>{time(current?.expiresAt)}</dd></div>
            <div><dt>Issued</dt><dd>{time(current?.issuedAt)}</dd></div>
          </dl>
          <div className="cr-actions cr30-device-actions">
            <button className="cr-button" onClick={props.pair}>
              Pair another server
            </button>
            <ActionButton danger onClick={props.forget}>
              Forget this device
            </ActionButton>
          </div>
        </div>
      </Panel>

      <Panel title="Capability summary" aside={<Badge>Local policy + this grant</Badge>}>
        <div className="cr30-capability-grid">
          {CAPABILITY_GROUPS.map((group) => {
            const locallyEnabled = group.scopes.filter((scope) =>
              localCapability(scope, paperCapabilities, hostCapabilities),
            ).length;
            const availableToDevice = group.scopes.filter(
              (scope) =>
                localCapability(scope, paperCapabilities, hostCapabilities) &&
                currentScopes.has(scope),
            ).length;
            const label =
              locallyEnabled === 0
                ? "Unavailable locally"
                : availableToDevice === locallyEnabled
                  ? "Fully available"
                  : `${availableToDevice} of ${locallyEnabled} available`;
            return (
              <article className="cr30-capability-card" key={group.label}>
                <div>
                  <h3>{group.label}</h3>
                  {group.future && <Badge tone="quiet">Future workspace</Badge>}
                </div>
                <strong>{label}</strong>
                <small>
                  {locallyEnabled} local · {group.scopes.length} known scopes
                </small>
              </article>
            );
          })}
        </div>

        {locallyEnabledButUngraded.length > 0 && (
          <div className="cr30-repair-guidance">
            <Badge tone="amber">Immutable device grant</Badge>
            <p>
              {locallyEnabledButUngraded.length} locally enabled capability
              {locallyEnabledButUngraded.length === 1 ? " is" : " entries are"} not
              present in this device grant. If the current role should include them,
              re-pair this browser with the appropriate role to receive newly issued scopes.
              Existing grants are never silently expanded.
            </p>
          </div>
        )}

        <details className="cr30-capability-details">
          <summary>Advanced capability details</summary>
          <div className="cr-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Paper policy</th>
                  <th>Host policy</th>
                  <th>This device</th>
                </tr>
              </thead>
              <tbody>
                {CAPABILITY_GROUPS.flatMap((group) =>
                  group.scopes.map((scope) => (
                    <tr key={scope}>
                      <td>
                        <strong>{scope}</strong>
                        {group.future && <small>Advanced / Future</small>}
                      </td>
                      <td>
                        <Badge tone={paperCapabilities[scope] ? "green" : "quiet"}>
                          {paperCapabilities[scope] ? "Enabled" : "Disabled"}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={hostCapabilities[scope] ? "green" : "quiet"}>
                          {hostCapabilities[scope] ? "Enabled" : "Disabled"}
                        </Badge>
                      </td>
                      <td>{currentScopes.has(scope) ? "Granted" : "Not granted"}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className="cr-hint cr-pad">
            Local Paper/Host policy remains authoritative. Files and Backups scopes are
            retained here only as Advanced / Future capabilities; Dashboard 3.0 does not
            expose those workspaces as active pages.
          </p>
        </details>
      </Panel>

      {props.can("devices.list") && (
        <Panel title="Paired devices" aside={<Badge>{devices.length} shown</Badge>}>
          <div className="cr30-device-toolbar">
            <label className="cr-search">
              <span className="sr-only">Search devices</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search device name or ID"
              />
            </label>
            <label>
              <span className="sr-only">Filter devices by role</span>
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="ALL">All roles</option>
                {roles.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <button className="cr-button" disabled={query.busy} onClick={query.refresh}>
              {query.busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {devices.length ? (
            <div className="cr-table-wrap cr30-device-table">
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Role</th>
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
                        <td><strong>{str(device.name)}</strong><small>{str(device.deviceId)}</small></td>
                        <td><Badge tone={device.role === "Owner" ? "cyan" : "quiet"}>{str(device.role)}</Badge></td>
                        <td>{time(device.lastSeen)}</td>
                        <td>{time(device.expiresAt)}</td>
                        <td>
                          {isCurrent ? (
                            <Badge tone="green">Current</Badge>
                          ) : isExpired ? (
                            <Badge tone="amber">Expired</Badge>
                          ) : (
                            <Badge>Paired</Badge>
                          )}
                        </td>
                        <td>
                          <div className="cr-actions">
                            <button className="cr-button" onClick={() => setSelected(device)}>
                              Details
                            </button>
                            {props.can("devices.revoke") && !isCurrent && (
                              <ActionButton
                                danger
                                onClick={() =>
                                  props
                                    .run("devices.revoke", { deviceId: device.deviceId })
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
          {query.error && <p className="cr-alert" role="alert">{query.error}</p>}
        </Panel>
      )}

      {selected && (
        <DeviceDialog21
          device={selected}
          currentDeviceId={current?.deviceId}
          close={() => setSelected(null)}
        />
      )}
    </div>
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
        <button className="cr-button" onClick={close} aria-label="Close device details">×</button>
      </div>
      <div className="cr21-drawer-section">
        <div className="cr-actions">
          <Badge tone={device.role === "Owner" ? "cyan" : "quiet"}>{str(device.role)}</Badge>
          {device.deviceId === currentDeviceId && <Badge tone="green">Current device</Badge>}
          {expired(device.expiresAt) && <Badge tone="amber">Expired</Badge>}
        </div>
        <dl className="cr-details">
          <div><dt>Device ID</dt><dd>{str(device.deviceId)}</dd></div>
          <div><dt>Issued</dt><dd>{time(device.issuedAt)}</dd></div>
          <div><dt>Expires</dt><dd>{time(device.expiresAt)}</dd></div>
          <div><dt>Last seen</dt><dd>{time(device.lastSeen)}</dd></div>
        </dl>
        <h3>Granted scopes</h3>
        {scopes.length ? (
          <div className="cr-scope-list">
            {scopes.map((scope) => <Badge key={scope}>{scope}</Badge>)}
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
