"use client";

import { Badge, Panel, type ViewProps } from "./control-views";
import { diagnostics } from "../lib/control-state";
import { SCOPES } from "../lib/scopes";
import { useUiPreferences } from "../components/ui-preferences-provider";
import type { UiPreferencesV1 } from "../lib/ui-preferences";

function SelectField<K extends keyof UiPreferencesV1>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: UiPreferencesV1[K];
  options: Array<{ value: UiPreferencesV1[K]; label: string }>;
  onChange: (value: UiPreferencesV1[K]) => void;
  hint?: string;
}) {
  return (
    <label className="cr23-field">
      <span>{label}</span>
      <select
        value={String(value)}
        onChange={(event) => {
          const next = options.find((option) => String(option.value) === event.target.value);
          if (next) onChange(next.value);
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <small>{hint}</small>}
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  hint,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="cr23-field cr23-check">
      <span>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function SettingsView21(
  props: ViewProps & { reconnect: () => void },
) {
  const ready = props.state.ready;
  const {
    preferences,
    resolved,
    avatarProviderAvailable,
    updatePreference,
    resetPreferences,
  } = useUiPreferences();

  return (
    <>
      <Panel title="Appearance & behavior" aside={<Badge tone="cyan">Browser-local</Badge>}>
        <div className="cr23-preference-grid">
          <section className="cr23-preference-group">
            <h3>Theme</h3>
            <SelectField
              label="Color theme"
              value={preferences.theme}
              options={[
                { value: "system", label: "System" },
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
              onChange={(value) => updatePreference("theme", value)}
              hint={`Currently resolved to ${resolved.theme}.`}
            />
            <SelectField
              label="Accent"
              value={preferences.accent}
              options={[
                { value: "cyan", label: "Cyan" },
                { value: "violet", label: "Violet" },
                { value: "emerald", label: "Emerald" },
                { value: "amber", label: "Amber" },
              ]}
              onChange={(value) => updatePreference("accent", value)}
            />
            <SelectField
              label="Contrast"
              value={preferences.contrast}
              options={[
                { value: "system", label: "System" },
                { value: "standard", label: "Standard" },
                { value: "high", label: "High" },
              ]}
              onChange={(value) => updatePreference("contrast", value)}
              hint={`Currently resolved to ${resolved.contrast}.`}
            />
          </section>

          <section className="cr23-preference-group">
            <h3>Layout</h3>
            <SelectField
              label="Density"
              value={preferences.density}
              options={[
                { value: "compact", label: "Compact" },
                { value: "comfortable", label: "Comfortable" },
                { value: "spacious", label: "Spacious" },
              ]}
              onChange={(value) => updatePreference("density", value)}
            />
            <SelectField
              label="Text scale"
              value={preferences.textScale}
              options={[
                { value: 100, label: "100%" },
                { value: 112.5, label: "112.5%" },
                { value: 125, label: "125%" },
              ]}
              onChange={(value) => updatePreference("textScale", value)}
            />
            <SelectField
              label="Mobile player rows"
              value={preferences.mobilePlayerRows}
              options={[
                { value: "cards", label: "Cards" },
                { value: "table", label: "Table" },
              ]}
              onChange={(value) => updatePreference("mobilePlayerRows", value)}
            />
          </section>

          <section className="cr23-preference-group">
            <h3>Players</h3>
            <ToggleField
              label="Show skin heads"
              checked={avatarProviderAvailable && preferences.playerHeads}
              disabled={!avatarProviderAvailable}
              onChange={(value) => updatePreference("playerHeads", value)}
              hint={
                avatarProviderAvailable
                  ? "Remote heads are optional and never block the roster."
                  : "Unavailable because no valid deployment avatar provider is configured."
              }
            />
            <SelectField
              label="Head size"
              value={preferences.playerHeadSize}
              options={[
                { value: "small", label: "Small" },
                { value: "medium", label: "Medium" },
              ]}
              onChange={(value) => updatePreference("playerHeadSize", value)}
            />
            <SelectField
              label="UUID display"
              value={preferences.playerUuid}
              options={[
                { value: "hidden", label: "Hidden" },
                { value: "short", label: "Short" },
                { value: "full", label: "Full" },
              ]}
              onChange={(value) => updatePreference("playerUuid", value)}
            />
            <ToggleField
              label="Live row highlight"
              checked={preferences.liveRowHighlight}
              onChange={(value) => updatePreference("liveRowHighlight", value)}
            />
          </section>

          <section className="cr23-preference-group">
            <h3>Graphs & time</h3>
            <SelectField
              label="Default window"
              value={preferences.chartWindowMinutes}
              options={[
                { value: 1, label: "1 minute" },
                { value: 5, label: "5 minutes" },
                { value: 15, label: "15 minutes" },
                { value: 30, label: "30 minutes" },
              ]}
              onChange={(value) => updatePreference("chartWindowMinutes", value)}
            />
            <SelectField
              label="Chart style"
              value={preferences.chartStyle}
              options={[
                { value: "line", label: "Line" },
                { value: "area", label: "Area" },
              ]}
              onChange={(value) => updatePreference("chartStyle", value)}
            />
            <ToggleField
              label="Grid"
              checked={preferences.chartGrid}
              onChange={(value) => updatePreference("chartGrid", value)}
            />
            <SelectField
              label="Chart layout"
              value={preferences.chartLayout}
              options={[
                { value: "auto", label: "Auto" },
                { value: "single", label: "Single column" },
                { value: "double", label: "Two columns" },
              ]}
              onChange={(value) => updatePreference("chartLayout", value)}
            />
            <SelectField
              label="Timestamp display"
              value={preferences.timeZone}
              options={[
                { value: "local", label: "Browser local" },
                { value: "utc", label: "UTC" },
              ]}
              onChange={(value) => updatePreference("timeZone", value)}
            />
          </section>

          <section className="cr23-preference-group">
            <h3>Motion</h3>
            <SelectField
              label="Motion profile"
              value={preferences.motion}
              options={[
                { value: "system", label: "System" },
                { value: "full", label: "Full" },
                { value: "reduced", label: "Reduced" },
                { value: "off", label: "Off" },
              ]}
              onChange={(value) => updatePreference("motion", value)}
              hint={`Currently resolved to ${resolved.motion}. OS reduced-motion remains a safety floor.`}
            />
            <ToggleField
              label="Live pulses"
              checked={preferences.livePulse}
              onChange={(value) => updatePreference("livePulse", value)}
            />
            <ToggleField
              label="Page transitions"
              checked={preferences.pageTransitions}
              onChange={(value) => updatePreference("pageTransitions", value)}
            />
          </section>
        </div>
        <div className="cr23-settings-actions">
          <button className="cr-button" onClick={resetPreferences}>
            Reset appearance settings
          </button>
          <span className="cr-hint">
            This reset changes presentation only. It does not forget credentials, revoke this device, or clear server data.
          </span>
        </div>
      </Panel>

      <div className="cr21-settings-grid">
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

        <Panel title="Data & refresh">
          <div className="cr-pad">
            <dl className="cr-details">
              <div><dt>Live telemetry</dt><dd>WebSocket pushed</dd></div>
              <div><dt>Performance history</dt><dd>Bounded browser-local rolling samples</dd></div>
              <div><dt>Query refresh</dt><dd>Per-view, only where protocol 3 provides a query</dd></div>
            </dl>
            <p className="cr-hint">Pausing a chart pauses its browser presentation, not server-side telemetry or the WebSocket.</p>
          </div>
        </Panel>

        <Panel title="Local browser storage">
          <div className="cr-pad">
            <dl className="cr-details">
              <div><dt>Workspace</dt><dd>Isolated by server identity</dd></div>
              <div><dt>Presentation</dt><dd>Strict versioned browser-local preference schema</dd></div>
              <div><dt>Telemetry</dt><dd>Bounded sanitized local history only</dd></div>
            </dl>
            <p className="cr-hint">Appearance preferences never contain player identity, credentials, history queries, console text, or action data.</p>
          </div>
        </Panel>

        <Panel title="Diagnostics">
          <div className="cr-pad">
            <p>Copy a safe support snapshot containing versions, protocol, connection state, capabilities and non-sensitive runtime state.</p>
            <button
              className="cr-button"
              onClick={() => void navigator.clipboard
                .writeText(diagnostics(props.state))
                .then(() => props.notice("Safe diagnostics copied."))}
            >
              Copy safe diagnostics
            </button>
            <p className="cr-hint">Access tokens, pairing codes, private keys and relay secrets are not included.</p>
          </div>
        </Panel>

        <Panel title="Local capabilities">
          <div className="cr-table-wrap">
            <table>
              <thead>
                <tr><th>Scope</th><th>Paper policy</th><th>Host policy</th><th>This device</th></tr>
              </thead>
              <tbody>
                {SCOPES.map((scope) => (
                  <tr key={scope}>
                    <td>{scope}</td>
                    <td><Badge tone={ready?.server.paperCapabilities[scope] ? "green" : "quiet"}>{ready?.server.paperCapabilities[scope] ? "Enabled" : "Disabled"}</Badge></td>
                    <td><Badge tone={ready?.server.hostCapabilities[scope] ? "green" : "quiet"}>{ready?.server.hostCapabilities[scope] ? "Enabled" : "Disabled"}</Badge></td>
                    <td>{ready?.device.scopes.includes(scope) ? "Granted" : "Not granted"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="cr-hint cr-pad">Security capabilities are configured locally. This browser cannot enable a disabled capability or grant itself a scope.</p>
        </Panel>

        <Panel title="About">
          <dl className="cr-details cr-pad">
            <div><dt>Dashboard</dt><dd>PlexonPanel Dashboard 2.3.0</dd></div>
            <div><dt>Wire protocol</dt><dd>3</dd></div>
            <div><dt>Paper agent</dt><dd>{ready?.server.pluginVersion ?? "Unavailable"}</dd></div>
            <div><dt>Host companion</dt><dd>{ready?.server.hostVersion ?? "Unavailable"}</dd></div>
            <div><dt>Avatar provider</dt><dd>{avatarProviderAvailable ? "Deployment configured" : "Disabled / unavailable"}</dd></div>
          </dl>
        </Panel>
      </div>
    </>
  );
}
