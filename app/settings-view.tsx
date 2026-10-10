"use client";
import { type ViewProps } from "./control-views";
import { ActionButton, Button, Panel, PageHeader } from "./ui/workspace";
import { diagnostics } from "../lib/control-state";
import { DASHBOARD_LABEL } from "../lib/dashboard-version";
import { useUiPreferences } from "../components/ui-preferences-provider";
import { ControlPlaneBuildPanel } from "./control-plane-build-panel";
import { ClientPreferences } from "./client-preferences";

export function SettingsView(props: ViewProps & { reconnect: () => void; clearLocalChatCache:()=>Promise<void>; clearLocalCache:()=>Promise<void> }) {
  const ready = props.state.ready;
  const { avatarProviderStatus } = useUiPreferences();
  const providerLabel = { "built-in": "Built-in provider", custom: "Custom deployment provider", disabled: "Disabled by deployment", invalid: "Invalid provider configuration" }[avatarProviderStatus];
  let relayHostname='Not configured';try{relayHostname=new URL(process.env.NEXT_PUBLIC_PLEXON_RELAY_URL??'').hostname;}catch{}
  return (<div className="pp-workspace" data-ui6-workspace="Settings"><PageHeader title="Settings" description="Appearance and local data belong to this browser." primary={<Button variant="primary" onClick={props.reconnect}>Reconnect</Button>}/><ClientPreferences />
      <Panel title="Data and privacy"><p>Clear data for the selected server. Credentials, preferences and other servers remain saved. Incoming streams can fill the cache again.</p><div className="pp-row"><ActionButton pendingLabel="Clearing local cache…" onClick={props.clearLocalCache}>Clear local cache</ActionButton><ActionButton pendingLabel="Clearing local chat cache…" onClick={props.clearLocalChatCache}>Clear local chat cache</ActionButton></div></Panel>
      <div className="pp-data-grid">
        <ControlPlaneBuildPanel
          paperVersion={ready?.server.pluginVersion}
          hostVersion={ready?.server.hostVersion}
        />

        <Panel title="Connection">
          <dl className="pp-facts">
            <div><dt>Protocol</dt><dd>3</dd></div>
            <div><dt>Server identity</dt><dd>{props.state.serverId}</dd></div>
            <div><dt>Fingerprint</dt><dd>{ready?.server.fingerprint ?? "Unavailable"}</dd></div>
            <div><dt>Device role</dt><dd>{ready?.device.role ?? "Unknown"}</dd></div>
          </dl>
          <div className="pp-row">
            <Button className="" onClick={props.reconnect}>Reconnect</Button>
          </div>
        </Panel>

        <Panel title="Diagnostics">
          <div className="pp-stack">
            <p>
              Copy a safe support snapshot containing versions, protocol,
              connection state, capabilities and non-sensitive runtime state.
            </p>
            <Button
              className=""
              onClick={() =>
                void navigator.clipboard
                  .writeText(diagnostics(props.state))
                  .then(() => props.notice("Safe diagnostics copied."))
              }
            >
              Copy safe diagnostics
            </Button>
            <p className="pp-muted">
              Access tokens, pairing codes, private keys and relay secrets are not included.
            </p>
          </div>
        </Panel>

        <Panel title="Browser storage">
          <div className="pp-stack">
            <dl className="pp-facts">
              <div><dt>Workspace</dt><dd>Isolated by server identity</dd></div>
              <div><dt>Preferences</dt><dd>Strict browser-local schema</dd></div>
              <div><dt>Telemetry</dt><dd>Bounded sanitized local history</dd></div>
            </dl>
            <p className="pp-muted">
              Interface preferences never contain credentials, history queries,
              console text or action parameters.
            </p>
          </div>
        </Panel>

        <Panel title="About">
          <dl className="pp-facts">
            <div><dt>Dashboard</dt><dd>{DASHBOARD_LABEL}</dd></div>
            <div><dt>Wire protocol</dt><dd>3</dd></div><div><dt>Relay hostname</dt><dd>{relayHostname}</dd></div>
            <div><dt>Paper agent</dt><dd>{ready?.server.pluginVersion ?? "Unavailable"}</dd></div>
            <div><dt>Host companion</dt><dd>{ready?.server.hostVersion ?? "Unavailable"}</dd></div>
            <div><dt>Avatar provider</dt><dd>{providerLabel}</dd></div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
