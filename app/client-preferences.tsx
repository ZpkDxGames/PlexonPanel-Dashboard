"use client";

import { Select } from "../components/select";
import { Badge, Panel } from "./control-views";
import { useUiPreferences } from "../components/ui-preferences-provider";
import { displayRateLabel } from "../lib/display-cadence";

function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <label className="display-field">
      <span>{label}</span>
      <Select aria-label=""
        value={String(value)}
        onValueChange={(selectedValue) => {
          const next = options.find(
            (option) => String(option.value) === selectedValue,
          );
          if (next) onChange(next.value);
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </Select>
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
    <label className="display-field display-check">
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

export function ClientPreferences() {
  const {
    preferences,
    resolved,
    avatarProviderAvailable,
    avatarProviderStatus,
    updatePreference,
    resetPreferences,
  } = useUiPreferences();
  const providerLabel = { "built-in": "Built-in provider", custom: "Custom deployment provider", disabled: "Disabled by deployment", invalid: "Invalid provider configuration" }[avatarProviderStatus];
  return (
      <Panel
        title="Interface preferences"
        aside={<Badge tone="cyan">Browser-local</Badge>}
      >
        <div className="display-preference-grid view-settings-grid">
          <section className="display-preference-group">
            <h3>Appearance</h3>
            <SelectField
              label="Theme"
              value={preferences.theme}
              options={[
                { value: "system", label: "System" },
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
              onChange={(value) => updatePreference("theme", value)}
              hint={`Currently ${resolved.theme}.`}
            />
            <SelectField
              label="Accent"
              value={preferences.accent}
              options={[
                { value: "monochrome", label: "Monochrome" },
                { value: "cyan", label: "Plexon cyan" },
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
              hint={`Currently ${resolved.contrast}.`}
            />
          </section>

          <section className="display-preference-group">
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
              label="Text size"
              value={preferences.textScale}
              options={[
                { value: 100, label: "100%" },
                { value: 112.5, label: "112.5%" },
                { value: 125, label: "125%" },
              ]}
              onChange={(value) => updatePreference("textScale", value)}
              hint="Text size is an accessibility preference, not a responsive scaling control."
            />
          </section>

          <section className="display-preference-group">
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
              hint={`Currently ${resolved.motion}. OS reduced-motion remains a safety floor.`}
            />
            <ToggleField
              label="Live pulse"
              checked={preferences.livePulse}
              onChange={(value) => updatePreference("livePulse", value)}
            />
            <ToggleField
              label="Page transitions"
              checked={preferences.pageTransitions}
              onChange={(value) => updatePreference("pageTransitions", value)}
            />
          </section>

          <section className="display-preference-group">
            <h3>Performance charts</h3>
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
                { value: "auto", label: "Adaptive" },
                { value: "single", label: "Single column" },
                { value: "double", label: "Two columns" },
              ]}
              onChange={(value) => updatePreference("chartLayout", value)}
            />
            <SelectField
              label="Timezone"
              value={preferences.timeZone}
              options={[
                { value: "local", label: "Browser local" },
                { value: "utc", label: "UTC" },
              ]}
              onChange={(value) => updatePreference("timeZone", value)}
            />
          </section>

          <section className="display-preference-group">
            <h3>Players</h3>
            <ToggleField
              label="Player skin heads"
              checked={avatarProviderAvailable && preferences.playerHeads}
              disabled={!avatarProviderAvailable}
              onChange={(value) => updatePreference("playerHeads", value)}
              hint={
                avatarProviderAvailable
                  ? `${providerLabel}. Remote heads are optional and never block the roster.`
                  : `${providerLabel}. The deterministic local fallback remains available.`
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
            <SelectField
              label="Mobile roster"
              value={preferences.mobilePlayerRows}
              options={[
                { value: "cards", label: "Cards" },
                { value: "table", label: "Table" },
              ]}
              onChange={(value) => updatePreference("mobilePlayerRows", value)}
            />
            <ToggleField
              label="Live row highlight"
              checked={preferences.liveRowHighlight}
              onChange={(value) => updatePreference("liveRowHighlight", value)}
            />
          </section>

          <section className="display-preference-group view-browser-data-group">
            <h3>Browser data behavior</h3>
            <SelectField
              label="Display update rate"
              value={preferences.displayUpdateRateMs}
              options={[
                { value: 0, label: "Realtime" },
                { value: 250, label: "Fast · 250 ms" },
                { value: 500, label: "Balanced · 500 ms" },
                { value: 1000, label: "Relaxed · 1 second" },
                { value: 2000, label: "Low activity · 2 seconds" },
              ]}
              onChange={(value) => updatePreference("displayUpdateRateMs", value)}
              hint="Controls how often accepted live telemetry is painted to this browser. Paper and Host publish fast source telemetry where supported; critical connection, authorization, lifecycle and action state is always applied immediately."
            />
            <div className="view-setting-note">
              <span>Browser display: {displayRateLabel(preferences.displayUpdateRateMs)}</span>
            </div>
          </section>
        </div>

        <div className="display-settings-actions">
          <button className="ui-button" onClick={resetPreferences}>
            Reset visual preferences
          </button>
          <span className="ui-hint">
            This changes presentation only. It does not forget credentials,
            revoke this device, change Paper/Host policy or clear server data.
          </span>
        </div>
      </Panel>

  );
}
