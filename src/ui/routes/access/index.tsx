import { useState } from "react";
import { ShieldCheck, KeyRound, Plus, History } from "lucide-react";
import { Heading, Panel, QueryNotice } from "../shared";
import { useControl, useQuery } from "../../hooks/useControl";
import { records, record } from "../../../adapter/control-state";
import { usePairing } from "../../pairing/PairingGate";
import { MutationButton } from "../../review/ActionReviewModal";
import { Pill } from "../../primitives/Pill";
export default function Access() {
  const snap = useControl(),
    query = useQuery("devices.list", "PAPER"),
    audit = useQuery("audit.list", "HOST", { limit: 50 }),
    pair = usePairing(),
    [filter, setFilter] = useState(""),
    devices = records(query.data.devices, 100).length
      ? records(query.data.devices, 100)
      : snap.state.ready
        ? [{ ...snap.state.ready.device }]
        : [],
    rows = records(audit.data.entries ?? audit.data.events, 100).filter((r) =>
      JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()),
    ),
    capabilities = [
      ["View telemetry", "telemetry.view"],
      ["View console", "console.view.full"],
      ["Send commands", "console.execute.allowed"],
      ["Power actions", "server.stop"],
      ["Backups", "backup.create"],
      ["Manage access", "devices.revoke"],
    ];
  return (
    <>
      <Heading
        id="R07 · Access & audit"
        title="Trust is explicit."
        detail="Device-bound grants, visible scope boundaries and a traceable action history."
      />
      <div className="below-grid mt-0">
        <div className="space-y-4">
          <Panel title="Trusted devices" tone="emerald" icon={ShieldCheck}>
            <QueryNotice query={query} />
            <div className="space-y-3">
              {devices.map((d) => (
                <div key={String(d.deviceId)} className="pp-well p-4">
                  <div className="flex justify-between gap-3">
                    <strong>{String(d.name)}</strong>
                    <Pill tone="emerald">{String(d.role)}</Pill>
                  </div>
                  <p className="mono text-muted text-xs mt-2 break-all">
                    {String(d.fingerprint ?? d.deviceId)}
                  </p>
                  <p className="text-muted text-xs mt-2">
                    Paired {String(d.issuedAt ?? "Not reported")} · last seen{" "}
                    {String(d.lastSeen ?? "Not reported")}
                  </p>
                  <div className="flex flex-wrap gap-1 my-3">
                    {(Array.isArray(d.scopes) ? d.scopes : [])
                      .slice(0, 8)
                      .map((s) => (
                        <span className="source-chip" key={String(s)}>
                          {String(s)}
                        </span>
                      ))}
                  </div>
                  <MutationButton
                    action="devices.revoke"
                    kind="PAPER"
                    label="Revoke device"
                    tone="rose"
                    parameters={{ deviceId: d.deviceId }}
                  />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Pair another device" tone="violet" icon={KeyRound}>
            <div className="pp-well p-4 mb-4 text-secondary leading-6">
              Pairing codes expire after five minutes. Each browser gets its own
              signed scope grant.
            </div>
            <button
              className="btn"
              aria-label="Open pairing gate"
              onClick={pair}
            >
              <Plus size={16} />
              Open pairing gate
            </button>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Capability matrix" tone="emerald" icon={ShieldCheck}>
            <div
              className="pp-well table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Scope matrix"
            >
              <table className="scope-matrix">
                <thead>
                  <tr>
                    <th>Capability</th>
                    {devices.map((d) => (
                      <th key={String(d.deviceId)}>{String(d.name)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {capabilities.map(([label, scope]) => (
                    <tr key={scope}>
                      <td>{label}</td>
                      {devices.map((d) => {
                        const granted =
                          Array.isArray(d.scopes) && d.scopes.includes(scope);
                        return (
                          <td key={String(d.deviceId)}>
                            <span
                              className="scope-dot"
                              data-tone={granted ? "emerald" : "slate"}
                              role="img"
                              aria-label={granted ? "Granted" : "Not granted"}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted text-xs mt-3">
              Execution also requires the target agent's current capability and
              policy.
            </p>
          </Panel>
          <Panel title="Audit trail" tone="indigo" icon={History}>
            <input
              aria-label="Filter audit log"
              className="field w-full mb-4"
              placeholder="Filter device, action or result…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <QueryNotice query={audit} />
            {rows.length ? (
              <ol className="timeline">
                {rows.map((a, i) => (
                  <li
                    key={String(a.id ?? i)}
                    data-tone={a.status === "FAILED" ? "rose" : "emerald"}
                  >
                    <div className="flex justify-between gap-3">
                      <strong>{String(a.action ?? "Action")}</strong>
                      <Pill tone={a.status === "FAILED" ? "rose" : "emerald"}>
                        {String(a.status ?? a.result ?? "Recorded")}
                      </Pill>
                    </div>
                    <p className="text-secondary">
                      {String(a.actor ?? a.deviceId ?? "Operator")} ·{" "}
                      {String(a.timestamp ?? a.capturedAt ?? "")}
                    </p>
                    <details className="pp-well p-2 mt-2">
                      <summary>Recorded event JSON</summary>
                      <pre>{JSON.stringify(a, null, 2)}</pre>
                    </details>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="pp-well p-4 text-secondary">
                No matching audit events were returned.
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
