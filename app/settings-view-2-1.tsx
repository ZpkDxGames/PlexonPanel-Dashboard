"use client";
import { Panel, type ViewProps } from "./control-views";
import { diagnostics } from "../lib/control-state";
import { DASHBOARD_LABEL } from "../lib/dashboard-version";
import { useUiPreferences } from "../components/ui-preferences-provider";
import { ControlPlaneBuildPanel } from "./control-plane-build-panel";
import { ClientPreferences } from "./client-preferences";

export function SettingsView21(props: ViewProps & { reconnect: () => void }) {
  const ready = props.state.ready;
  const { avatarProviderStatus } = useUiPreferences();
  const providerLabel = { "built-in": "Built-in provider", custom: "Custom deployment provider", disabled: "Disabled by deployment", invalid: "Invalid provider configuration" }[avatarProviderStatus];
  return (<div className="cr30-settings-stack"><ClientPreferences />
      <div className="cr21-settings-grid cr30-diagnostics-grid">
        <ControlPlaneBuildPanel
          paperVersion={ready?.server.pluginVersion}
          hostVersion={ready?.server.hostVersion}
        />

        <Panel title="Connection">
          <dl className="cr-details cr-pad">
            <div><dt>Protocol</dt><dd>3</dd></div>
            <div><dt>Server identity</dt><dd>{props.state.serverId}</dd></div>
            <div><dt>Fingerprint</dt><dd>{ready?.server.fingerprint ?? "Unavailable"}</dd></div>
            <div><dt>Device role</dt><dd>{ready?.device.role ?? "Unknown"}</dd></div>
          </dl>
          <div className="cr-actions cr-pad">
            <button className="cr-button" onClick={props.reconnect}>Reconnect</button>
          </div>
        </Panel>

        <Panel title="Diagnostics">
          <div className="cr-pad cr30-copy-stack">
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
              Access tokens, pairing codes, private keys and relay secrets are not included.
            </p>
          </div>
        </Panel>

        <Panel title="Browser storage">
          <div className="cr-pad">
            <dl className="cr-details">
              <div><dt>Workspace</dt><dd>Isolated by server identity</dd></div>
              <div><dt>Preferences</dt><dd>Strict browser-local schema</dd></div>
              <div><dt>Telemetry</dt><dd>Bounded sanitized local history</dd></div>
            </dl>
            <p className="cr-hint">
              Interface preferences never contain credentials, history queries,
              console text or action parameters.
            </p>
          </div>
        </Panel>

        <Panel title="About">
          <dl className="cr-details cr-pad">
            <div><dt>Dashboard</dt><dd>{DASHBOARD_LABEL}</dd></div>
            <div><dt>Wire protocol</dt><dd>3</dd></div>
            <div><dt>Paper agent</dt><dd>{ready?.server.pluginVersion ?? "Unavailable"}</dd></div>
            <div><dt>Host companion</dt><dd>{ready?.server.hostVersion ?? "Unavailable"}</dd></div>
            <div><dt>Avatar provider</dt><dd>{providerLabel}</dd></div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
