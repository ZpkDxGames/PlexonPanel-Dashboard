"use client";

import { ActionButton, Badge, Button, Empty, Panel, PageHeader, Select } from "./ui/workspace";
import { Dialog, Disclosure, Skeleton, Table } from "./ui/primitives";

import { useMemo, useState } from "react";
import {
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
  return timestamp !== null && (timestamp < 1e12 ? timestamp * 1000 : timestamp) < Date.now();
}

function deviceTime(value:unknown){const at=number(value);return time(at===null?value:at<1e12?at:at/1000);}

function outcomeTone(value: unknown): "green" | "cyan" | "amber" | "quiet" {
  return value === "SUCCESS"
    ? "green"
    : value === "STARTED"
      ? "cyan"
      : value === "DENIED" || value === "FAILED"
        ? "amber"
        : "quiet";
}

export function AuditView(props: ViewProps) {
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
  const [layout,setLayout]=useState("timeline");
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
    <div className="pp-workspace" data-ui6-workspace="Audit">
      <PageHeader title="Audit" description={`${kind==='PAPER'?'Paper':'Host'} records. ${visible.length} loaded in this bounded page.`} primary={<Button variant="primary" busy={query.busy} disabled={!allowed} onClick={query.refresh}>Refresh audit</Button>}/>
      <div className="pp-row"><Button aria-pressed={layout==='timeline'} onClick={()=>setLayout('timeline')}>Timeline</Button><Button aria-pressed={layout==='table'} onClick={()=>setLayout('table')}>Table</Button></div>
      <form
        className="pp-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          applyServerFilters();
        }}
      >
        <label className=" view-audit-search">
          <span className="">Search loaded audit records</span>
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
            placeholder="Search actor, action, target or request ID"
          />
        </label>
        <label>
          <span className="">Audit source</span>
          <Select aria-label="Audit source"
            value={kind==='PAPER'?'Paper':'Host'}
            onValueChange={(selectedValue) => {
              setKind(selectedValue as "PAPER" | "HOST");
              setPage(0);
            }}
          >
            <option value="PAPER">Paper audit</option>
            {props.state.ready?.agents.host && <option value="HOST">Host audit</option>}
          </Select>
        </label>
        <Button
          className=""
          type="button"
          onClick={query.refresh}
          disabled={query.busy}
        >
          {query.busy ? "Refreshing…" : "Refresh"}
        </Button>
        <details className="pp-disclosure">
          <summary className="">More filters</summary>
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
            <Button className="" type="submit">
              Apply filters
            </Button>
          </div>
        </details>
      </form>

      {query.error && (
        <p className="pp-notice" role="alert">
          {query.error}
        </p>
      )}

      <Panel
        title={action === "audit.self" ? "Your device audit" : "Audit timeline"}
        aside={<Badge>{visible.length} loaded</Badge>}
      >
        {!allowed ? (
          <Empty title="Audit access unavailable">The required audit scope or local policy is unavailable. Re-pair for newly introduced scopes.</Empty>
        ) : query.busy&&!query.hasSuccess ? <Skeleton label="Loading audit"/> : layout==='table' ? <Table caption="Loaded audit records" rows={visible} rowKey={e=>str(e.requestId)} columns={[{key:'time',label:'Time',render:e=>time(e.timestamp)},{key:'actor',label:'Actor / device',render:e=>str(e.actorLabel)},{key:'action',label:'Action',render:e=>str(e.actionType)},{key:'target',label:'Target',render:e=>str(e.target)},{key:'result',label:'Result',render:e=><Badge tone={outcomeTone(e.outcome)}>{str(e.outcome).toLowerCase()}</Badge>}]} empty={<Empty title="No matching records"/>}/> : visible.length ? (
          <div className="pp-stack" role="list">
            <div className="pp-sr-only" aria-hidden="true">
              <span>Time</span>
              <span>Actor / device</span>
              <span>Action</span>
              <span>Target</span>
              <span>Outcome</span>
            </div>
            {visible.map((entry, index) => {
              const json = JSON.stringify(entry, null, 2);
              return (
                <div
                  className="pp-record"
                  role="listitem"
                  key={`${entry.requestId}-${index}`}
                >
                  <div className="pp-data-grid">
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
                  <details className="pp-disclosure">
                    <summary>Advanced event details</summary>
                    <div className="pp-stack">
                      <dl className="pp-facts">
                        <div><dt>Request ID</dt><dd>{str(entry.requestId)}</dd></div>
                        <div><dt>Timestamp</dt><dd>{time(entry.timestamp)}</dd></div>
                        <div><dt>Duration</dt><dd>{metricDuration(entry.durationMillis)}</dd></div>
                        <div><dt>Code</dt><dd>{str(entry.code)}</dd></div>
                      </dl>
                      <div className="pp-row">
                        <Button
                          className=""
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(str(entry.requestId, ""))
                              .then(() => props.notice("Request ID copied."))
                          }
                        >
                          Copy request ID
                        </Button>
                        <Button
                          className=""
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(json)
                              .then(() => props.notice("Audit entry JSON copied."))
                          }
                        >
                          Copy JSON
                        </Button>
                      </div>
                      <pre className="pp-output workspace-audit-json">{json}</pre>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty title={query.busy ? "Loading audit…" : "No matching records"} />
        )}
      </Panel>

      <div className="pp-row">
        <Button
          className=""
          disabled={!page}
          onClick={() => setPage((current) => current - 1)}
        >
          Previous
        </Button>
        <span>Page {page + 1}. 50 records per page</span>
        <Button
          className=""
          disabled={!query.data.hasMore}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </Button>
      </div>
      <p className="pp-muted pp-muted">
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
    label: "Files and Backups",
    scopes: SCOPES.filter(
      (scope) => scope.startsWith("files.") || scope.startsWith("backup.") || scope.startsWith("maintenance.") || scope.startsWith("provider."),
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

export function AccessView(
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
  const currentGrant =
    props.deviceGrant?.deviceId === current?.deviceId ? props.deviceGrant : null;
  const currentScopes = new Set<string>(currentGrant?.scopes ?? []);
  const currentRole = currentGrant?.role || "Unknown";
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
    <div className="pp-workspace" data-ui6-workspace="Access">
      <PageHeader title="Access" description="Scopes and local policy define this immutable device grant." primary={<Button variant="primary" onClick={props.pair}>Pair another server</Button>} secondary={<Disclosure title="More"><ActionButton danger onClick={props.forget}>Forget this device</ActionButton></Disclosure>}/>
      <Panel
        title="This device"
        aside={<Badge tone="cyan">{currentRole}</Badge>}
      >
        <div className="pp-stack">
          <div className="pp-row">
            <span className="view-device-mark" aria-hidden="true">
              {current?.name?.slice(0, 1).toUpperCase() ?? "B"}
            </span>
            <div>
              <h3>{current?.name ?? "Browser"}</h3>
              <p>{props.state.serverId || "Server unavailable"}</p>
            </div>
          </div>
          <dl className="pp-facts">
            <div><dt>Role</dt><dd>{currentRole}</dd></div>
            <div><dt>Connection</dt><dd>{props.connected ? "Live" : "Offline"}</dd></div>
            <div><dt>Credential expiry</dt><dd>{deviceTime(current?.expiresAt)}</dd></div>
            <div><dt>Issued</dt><dd>{deviceTime(current?.issuedAt)}</dd></div>
          </dl>

        </div>
      </Panel>

      <Panel title="Capability summary" aside={<Badge>Local policy + this grant</Badge>}><div className="pp-row" aria-label="Effective permission intersection">{["Scope","Agent","Capability","Local policy","Action rules","Confirmation"].map((label,index)=><span key={label}>{index>0&&<span aria-hidden="true"> ∩ </span>}<Badge>{label}</Badge></span>)}</div><p>Effective permission requires the signed scope, connected agent, capability, local policy, action rules and bound confirmation. The agent reports any undisclosed restriction.</p>
        {currentGrant && !currentGrant.metadataMatches && (
          <div className="pp-notice">
            <Badge tone="amber">Re-pair required</Badge>
            <p>
              This browser&apos;s signed grant does not match the current device
              metadata. PlexonPanel is using only the scopes present in both and
              will not silently expand this credential. Re-pair with the intended
              role to issue a current signed grant.
            </p>
          </div>
        )}
        <div className="pp-data-grid">
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
                  ? "All locally enabled scopes granted"
                  : `${availableToDevice} of ${locallyEnabled} locally enabled scopes granted`;
            return (
              <article className="pp-record" key={group.label}>
                <div>
                  <h3>{group.label}</h3>

                </div>
                <strong>{label}</strong>
                <small>
                  {locallyEnabled} local. {group.scopes.length} known scopes
                </small>
              </article>
            );
          })}
        </div>

        {locallyEnabledButUngraded.length > 0 && (
          <div className="pp-notice">
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

        <details className="pp-disclosure">
          <summary>Advanced capability details</summary>
          <div className="pp-table-scroll" data-cards="true" role="region" aria-label="Advertised scope policy" tabIndex={0}>
            <table className="pp-table">
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
                      <td data-label="Scope">
                        <strong>{scope}</strong>

                      </td>
                      <td data-label="Paper policy">
                        <Badge tone={paperCapabilities[scope] ? "green" : "quiet"}>
                          {paperCapabilities[scope] ? "Enabled" : "Disabled"}
                        </Badge>
                      </td>
                      <td data-label="Host policy">
                        <Badge tone={hostCapabilities[scope] ? "green" : "quiet"}>
                          {hostCapabilities[scope] ? "Enabled" : "Disabled"}
                        </Badge>
                      </td>
                      <td data-label="This device">{currentScopes.has(scope) ? "Granted" : "Not granted"}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className="pp-muted pp-stack">
            Files and Backups are active workspaces. The agent still enforces action rules; these counts describe scopes and advertised local policy only.
          </p>
        </details>
      </Panel>

      {props.can("devices.list") && (
        <Panel title="Paired devices" aside={<Badge>{devices.length} shown</Badge>}>
          <div className="pp-toolbar">
            <label className="">
              <span className="">Search devices</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search device name or ID"
              />
            </label>
            <label>
              <span className="">Filter devices by role</span>
              <Select aria-label="Filter devices by role" value={role} onValueChange={(selectedValue) => setRole(selectedValue)}>
                <option value="ALL">All roles</option>
                {roles.map((value) => <option key={value}>{value}</option>)}
              </Select>
            </label>
            <Button className="" disabled={query.busy} onClick={query.refresh}>
              {query.busy ? "Refreshing…" : "Refresh"}
            </Button>
          </div>

          <Table caption="Reported device grants" loading={query.busy} rows={devices} rowKey={d=>str(d.deviceId)} columns={[
            {key:'device',label:'Device',rowHeader:true,render:d=><><strong>{str(d.name)}</strong><small className="pp-identifier">{str(d.deviceId)}</small></>},
            {key:'role',label:'Role',render:d=><Badge>{str(d.role)}</Badge>},
            {key:'seen',label:'Last seen',render:d=>deviceTime(d.lastSeen)},
            {key:'expires',label:'Expires',render:d=>deviceTime(d.expiresAt)},
            {key:'status',label:'Status',render:d=><Badge tone={d.deviceId===current?.deviceId?'green':expired(d.expiresAt)?'amber':'quiet'}>{d.deviceId===current?.deviceId?'Current':expired(d.expiresAt)?'Expired':'Paired'}</Badge>},
            {key:'actions',label:'Actions',render:d=><div className="pp-row"><Button onClick={()=>setSelected(d)}>Details</Button>{props.can('devices.revoke')&&d.deviceId!==current?.deviceId&&<ActionButton danger onClick={()=>props.run('devices.revoke',{deviceId:d.deviceId}).then(result=>{query.refresh();return result;})}>Revoke</ActionButton>}</div>}
          ]} empty={<Empty title="No devices match these filters"/>}/>
          {query.error && <p className="pp-notice" role="alert">{query.error}</p>}
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

function DeviceDialog21({device,currentDeviceId,close}:{device:JsonMap;currentDeviceId?:string;close:()=>void}){
 const scopes=Array.isArray(device.scopes)?device.scopes.map(String):[];
 return <Dialog open onClose={close} title={str(device.name)} description="Immutable device permissions"><div className="pp-row"><Badge>{str(device.role)}</Badge>{device.deviceId===currentDeviceId&&<Badge tone="green">Current device</Badge>}{expired(device.expiresAt)&&<Badge tone="amber">Expired</Badge>}</div><dl className="pp-facts"><div><dt>Device ID</dt><dd>{str(device.deviceId)}</dd></div><div><dt>Issued</dt><dd>{deviceTime(device.issuedAt)}</dd></div><div><dt>Expires</dt><dd>{deviceTime(device.expiresAt)}</dd></div><div><dt>Last seen</dt><dd>{deviceTime(device.lastSeen)}</dd></div></dl><h3>Granted scopes</h3>{scopes.length?<div className="pp-row">{scopes.map(scope=><Badge key={scope}>{scope}</Badge>)}</div>:<Empty title="No scopes reported"/>}<p className="pp-muted">Only supplied device data is shown. Last seen does not prove a connection.</p></Dialog>;
}
