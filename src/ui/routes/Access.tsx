"use client";
import { useState } from "react";
import Link from "next/link";
import { Laptop, Plus, Check, Minus } from "lucide-react";
import {
  useControl,
  useQuery,
  records,
  SCOPES,
  usePrefs,
  time,
  type JsonMap,
} from "../bindings";
import { MutationButton } from "../primitives/MutationButton";
import { Tooltip } from "../primitives/Tooltip";
import { Pane, QueryState, Table } from "./shared";
export default function Access() {
  const snap = useControl(),
    devicesQ = useQuery("devices.list", "PAPER"),
    host = useQuery("audit.list", "HOST", { limit: 100 }),
    paper = useQuery("audit.list", "PAPER", { limit: 100 }),
    prefs = usePrefs(),
    [source, setSource] = useState("All"),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    devices = records(devicesQ.data.devices, 100).length
      ? records(devicesQ.data.devices, 100)
      : snap.state.ready
        ? [{ ...snap.state.ready.device }]
        : [],
    rows = [
      ...records(paper.data.entries ?? paper.data.events, 500).map(
        (r): JsonMap => ({ ...r, source: "P" }),
      ),
      ...records(host.data.entries ?? host.data.events, 500).map(
        (r): JsonMap => ({ ...r, source: "H" }),
      ),
    ]
      .filter(
        (r) =>
          (source === "All" || r.source === (source === "Panel" ? "P" : "H")) &&
          JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) =>
        String(b.timestamp ?? b.capturedAt).localeCompare(
          String(a.timestamp ?? a.capturedAt),
        ),
      );
  return (
    <div className="pp-access">
      <Pane
        title="Trusted devices"
        actions={
          <Link
            href="/pair"
            className="pp-ctl"
            aria-label="Pair another browser"
          >
            <Plus size={13} />
          </Link>
        }
      >
        <QueryState query={devicesQ} />
        <div style={{ overflow: "auto" }}>
          {devices.map((d) => (
            <div className="pp-device" key={String(d.deviceId)}>
              <div className="row">
                <Laptop size={16} className="muted" />
                <strong className="grow">{String(d.name)}</strong>
                {d.deviceId === snap.state.ready?.device.deviceId && (
                  <span className="pp-tag">current</span>
                )}
              </div>
              <code>{String(d.fingerprint ?? d.deviceId)}</code>
              <div className="row spread">
                <small className="muted">
                  {String(d.role)} ·{" "}
                  {d.lastSeen
                    ? time(
                        typeof d.lastSeen === "number"
                          ? d.lastSeen
                          : String(d.lastSeen),
                        prefs.timezone,
                      )
                    : "last seen unavailable"}
                </small>
                <MutationButton
                  action="devices.revoke"
                  kind="PAPER"
                  label="Revoke"
                  tone="rose"
                  args={{ deviceId: d.deviceId }}
                />
              </div>
            </div>
          ))}
        </div>
        <footer
          className="pp-pane__foot muted"
          style={{ fontSize: 11, marginTop: "auto" }}
        >
          Device-bound grants · Ed25519 / Protocol 3
        </footer>
      </Pane>
      <Pane title="Scope authority matrix">
        <div
          className="pp-table-wrap pp-well"
          style={{ flex: 1 }}
          tabIndex={0}
          role="region"
          aria-label="Scope authority matrix"
        >
          <table className="pp-table">
            <thead>
              <tr>
                <th>Scope</th>
                {devices.map((d) => (
                  <th key={String(d.deviceId)}>{String(d.name)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCOPES.map((scope) => (
                <tr key={scope}>
                  <td>
                    <code style={{ fontSize: 10 }}>{scope}</code>
                  </td>
                  {devices.map((d) => {
                    const granted =
                      Array.isArray(d.scopes) && d.scopes.includes(scope);
                    return (
                      <td key={String(d.deviceId)}>
                        <Tooltip
                          content={`${d.name}: ${granted ? "granted" : "not granted"}. Agent policy is checked again at dispatch.`}
                        >
                          <button
                            className="tone"
                            data-tone={granted ? "emerald" : undefined}
                            aria-label={`${scope} ${granted ? "granted" : "not granted"} to ${d.name}`}
                          >
                            {granted ? (
                              <Check size={14} />
                            ) : (
                              <Minus size={14} />
                            )}
                          </button>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="pp-pane__foot muted" style={{ fontSize: 11 }}>
          Scope changes are managed by the pairing authority. This contract
          exposes inspection and revocation.
        </footer>
      </Pane>
      <Pane
        title="Audit ledger"
        actions={
          <span className="pp-num muted" style={{ fontSize: 11 }}>
            {rows.length}
          </span>
        }
      >
        <div className="pp-console-toolbar" style={{ flexWrap: "wrap" }}>
          <div className="pp-seg">
            {["All", "Panel", "Host"].map((s) => (
              <button
                key={s}
                aria-pressed={source === s}
                onClick={() => setSource(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            aria-label="Filter audit ledger"
            placeholder="Actor, action or result…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div
          style={{ flex: 1, overflow: "auto", minHeight: 0 }}
          onScroll={(e) =>
            setOffset(
              Math.max(0, Math.floor(e.currentTarget.scrollTop / 64) - 5),
            )
          }
        >
          {rows.length ? (
            <div style={{ height: rows.length * 64, position: "relative" }}>
              {rows.slice(offset, offset + 24).map((a, i) => (
                <div
                  className="pp-audit-row"
                  key={`${a.source}-${i}`}
                  style={{
                    position: "absolute",
                    top: (offset + i) * 64,
                    height: 64,
                    left: 0,
                    right: 0,
                  }}
                >
                  <div className="row spread">
                    <span
                      className="grow"
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {String(a.action ?? "Action")}
                    </span>
                    <span className="pp-src">{String(a.source)}</span>
                    {a.chainVerified === true && (
                      <Check
                        size={12}
                        role="img"
                        aria-label="Chain verified"
                        data-tone="emerald"
                        className="tone"
                      />
                    )}
                  </div>
                  <div className="row spread">
                    <small>
                      {String(a.actor ?? "Operator")} ·{" "}
                      {time(
                        String(a.timestamp ?? a.capturedAt),
                        prefs.timezone,
                      )}
                    </small>
                    <small
                      className="tone"
                      data-tone={a.status === "SUCCESS" ? "emerald" : "amber"}
                    >
                      {String(a.status ?? a.result ?? "Recorded")}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <QueryState query={source === "Panel" ? paper : host} />
          )}
        </div>
      </Pane>
    </div>
  );
}
