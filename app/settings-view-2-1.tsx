"use client";

import { SettingsView } from "./advanced-views";
import { Badge, Panel, type ViewProps } from "./control-views";
import { diagnostics } from "../lib/control-state";

export function SettingsView21(
  props: ViewProps & { reconnect: () => void },
) {
  return (
    <>
      <SettingsView {...props} />

      <div className="cr21-settings-grid">
        <Panel title="Data & refresh">
          <div className="cr-pad">
            <dl className="cr-details">
              <div>
                <dt>Live telemetry</dt>
                <dd>WebSocket pushed</dd>
              </div>
              <div>
                <dt>Performance history</dt>
                <dd>Bounded browser-local rolling samples</dd>
              </div>
              <div>
                <dt>Query refresh</dt>
                <dd>Per-view, only where protocol 3 provides a query</dd>
              </div>
            </dl>
            <p className="cr-hint">
              PlexonPanel does not poll values that are already streamed live.
              Pausing a chart pauses its browser presentation, not server-side
              telemetry or the WebSocket.
            </p>
          </div>
        </Panel>

        <Panel title="Local browser storage">
          <div className="cr-pad">
            <dl className="cr-details">
              <div>
                <dt>Workspace</dt>
                <dd>Isolated by server identity</dd>
              </div>
              <div>
                <dt>Preferences</dt>
                <dd>Density, section, sidebar and chart window</dd>
              </div>
              <div>
                <dt>Telemetry</dt>
                <dd>Bounded local history only</dd>
              </div>
            </dl>
            <p className="cr-hint">
              Browser storage is not a server telemetry database. Raw pairing
              codes and private agent keys are never stored here by the
              dashboard.
            </p>
          </div>
        </Panel>

        <Panel title="Diagnostics">
          <div className="cr-pad">
            <p>
              Copy a safe support snapshot containing versions, protocol,
              connection state, capabilities and non-sensitive runtime state.
            </p>
            <button
              className="cr-button"
              onClick={() =>
                void navigator.clipboard
                  .writeText(diagnostics(props.state))
                  .then(() => props.notice("Safe diagnostics copied."))
              }
            >
              Copy safe diagnostics
            </button>
            <p className="cr-hint">
              Access tokens, pairing codes, private keys and relay secrets are
              not included.
            </p>
          </div>
        </Panel>

        <Panel title="Security">
          <div className="cr-pad">
            <div className="cr-actions">
              <Badge tone="cyan">Protocol 3</Badge>
              <Badge>{props.state.ready?.device.role ?? "Role unavailable"}</Badge>
            </div>
            <p>
              Browser actions remain subject to relay scope validation, agent
              validation, local capability policy, Owner-only restrictions and
              confirmation requirements.
            </p>
            <p className="cr-hint">
              The dashboard cannot grant itself a scope or enable a locally
              disabled capability.
            </p>
          </div>
        </Panel>

        <Panel title="About">
          <dl className="cr-details cr-pad">
            <div>
              <dt>Dashboard</dt>
              <dd>PlexonPanel Dashboard 2.1.0</dd>
            </div>
            <div>
              <dt>Wire protocol</dt>
              <dd>3</dd>
            </div>
            <div>
              <dt>Paper agent</dt>
              <dd>{props.state.ready?.server.pluginVersion ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Host companion</dt>
              <dd>{props.state.ready?.server.hostVersion ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Storage model</dt>
              <dd>Coordination relay + browser-local rolling history</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </>
  );
}
