import { useEffect, useState } from "react";
import { diagnostics } from "../adapter/control-state";
import { session } from "../adapter/session";
import { PairingForm } from "../components/PairingForm";
import { Button, Notice, Panel, Status } from "../components/ui";
import { useSession } from "../hooks";
import { preferences, usePreferences } from "../store/preferences";
import { toast } from "../components/toast";
import { BrandMark } from "../components/Brand";
type BuildInfo = {
  commit?: string;
  builtAt?: string;
  protocolVersion?: number;
  dashboard?: string;
};
type Section = "appearance" | "connection" | "privacy" | "diagnostics";
function Options<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; detail?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="option-group">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "active" : ""}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <span>{option.label}</span>
            {option.detail && <small>{option.detail}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export default function Settings() {
  const snap = useSession(),
    prefs = usePreferences(),
    [section, setSection] = useState<Section>("appearance"),
    [origin, setOrigin] = useState(snap.relay.origin),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [build, setBuild] = useState<BuildInfo>({});
  useEffect(() => setOrigin(snap.relay.origin), [snap.relay.origin]);
  useEffect(() => {
    let active = true;
    void fetch("/build.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (active) setBuild(data);
      })
      .catch(() => {
        if (active) setBuild({});
      });
    return () => {
      active = false;
    };
  }, []);
  const save = async () => {
    setError("");
    setMessage("");
    try {
      await session.setRelayOrigin(origin);
      setMessage(
        "Relay preference saved. Connection state will confirm reachability.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Relay origin rejected.",
      );
    }
  };
  const copy = () => {
    void navigator.clipboard
      .writeText(diagnostics(snap.state))
      .then(() =>
        toast.push(
          "Diagnostics copied",
          "Sensitive values are redacted.",
          "success",
        ),
      )
      .catch(() =>
        toast.push(
          "Copy unavailable",
          "Browser clipboard access was denied.",
          "warning",
        ),
      );
  };
  const sections: [Section, string][] = [
    ["appearance", "Appearance"],
    ["connection", "Connections"],
    ["privacy", "Privacy & skins"],
    ["diagnostics", "Diagnostics"],
  ];
  return (
    <>
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label="Settings sections"
      >
        {sections.map(([value, label], index) => (
          <button
            key={value}
            role="tab"
            id={`setting-${value}`}
            aria-controls={`settings-${value}`}
            aria-selected={section === value}
            tabIndex={section === value ? 0 : -1}
            className={section === value ? "active" : ""}
            onClick={() => setSection(value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next =
                  sections[(index + (e.key === "ArrowRight" ? 1 : 3)) % 4][0];
                setSection(next);
                document.getElementById(`setting-${next}`)?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`settings-${section}`}
        aria-labelledby={`setting-${section}`}
      >
        {section === "appearance" && (
          <Panel
            eyebrow="LOCAL WORKSPACE"
            title="Find your focus."
            description="Presentation preferences apply immediately on this browser."
            className="preferences-panel"
          >
            <div className="preferences-layout">
              <div className="preferences-controls">
                <Options
                  label="Color theme"
                  value={prefs.theme}
                  options={[
                    { value: "dark", label: "Ink", detail: "Dark workspace" },
                    {
                      value: "light",
                      label: "Limestone",
                      detail: "Light workspace",
                    },
                    {
                      value: "system",
                      label: "System",
                      detail: "Follow your device",
                    },
                  ]}
                  onChange={(theme) => preferences.update({ theme })}
                />
                <Options
                  label="Layout density"
                  value={prefs.density}
                  options={[
                    { value: "compact", label: "Compact" },
                    { value: "comfortable", label: "Comfortable" },
                    { value: "spacious", label: "Spacious" },
                  ]}
                  onChange={(density) => preferences.update({ density })}
                />
                <Options
                  label="Text size"
                  value={prefs.textSize}
                  options={[
                    { value: "small", label: "Small" },
                    { value: "standard", label: "Standard" },
                    { value: "large", label: "Large" },
                  ]}
                  onChange={(textSize) => preferences.update({ textSize })}
                />
                <Options
                  label="Motion"
                  value={prefs.motion}
                  options={[
                    {
                      value: "full",
                      label: "Full",
                      detail: "Subtle transitions",
                    },
                    {
                      value: "reduced",
                      label: "Reduced",
                      detail: "Less movement",
                    },
                    { value: "off", label: "Off", detail: "Instant changes" },
                  ]}
                  onChange={(motion) => preferences.update({ motion })}
                />
                <Options
                  label="Signal accent"
                  value={prefs.accent}
                  options={[
                    { value: "teal", label: "Atlas" },
                    { value: "blue", label: "Azure" },
                    { value: "violet", label: "Violet" },
                  ]}
                  onChange={(accent) => preferences.update({ accent })}
                />
                <div className="settings-inline-options">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={prefs.chartFill}
                      onChange={(e) =>
                        preferences.update({ chartFill: e.target.checked })
                      }
                    />
                    Soft plot area fill
                  </label>
                  <label className="field">
                    Time zone
                    <select
                      value={prefs.timezone}
                      onChange={(e) =>
                        preferences.update({
                          timezone: e.target.value as typeof prefs.timezone,
                        })
                      }
                    >
                      <option value="browser">Browser</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </label>
                </div>
              </div>
              <aside className="preference-preview">
                <div className="preview-window">
                  <div className="preview-rail">
                    <BrandMark />
                    <i className="active" />
                    <i />
                    <i />
                  </div>
                  <div className="preview-content">
                    <span>ILLUSTRATIVE LAYOUT</span>
                    <strong>Clarity in every detail.</strong>
                    <div className="preview-metrics">
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="preview-chart">
                      <svg viewBox="0 0 220 54" aria-hidden="true">
                        <path d="M0 41L28 34 52 37 78 20 104 25 132 14 160 22 190 8 220 16" />
                      </svg>
                    </div>
                  </div>
                </div>
                <p>
                  Local fonts, stable figures, deliberate spacing. Your
                  workspace adapts to how you prefer to work.
                </p>
                <p>System reduced motion is always respected.</p>
              </aside>
            </div>
          </Panel>
        )}
        {section === "connection" && (
          <div className="settings-grid">
            <Panel
              eyebrow="TRANSPORT / PUBLIC ENDPOINT"
              title="Relay connection"
              action={
                <Status tone={snap.phase === "live" ? "success" : "neutral"}>
                  {snap.phase}
                </Status>
              }
            >
              <div className="settings-body">
                <label className="field">
                  Relay HTTPS origin
                  <input
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="https://relay.example.com"
                    inputMode="url"
                  />
                </label>
                <p className="disclosure">
                  Use your public HTTPS relay endpoint. Private keys and service
                  credentials are never needed here.
                </p>
                <div className="button-row">
                  <Button onClick={() => void save()}>Save origin</Button>
                  <Button
                    disabled={!snap.state.serverId}
                    onClick={() => session.reconnect()}
                  >
                    Reconnect
                  </Button>
                </div>
                <dl className="settings-facts">
                  <dt>Preference source</dt>
                  <dd>{snap.relay.source}</dd>
                  <dt>Selected server</dt>
                  <dd>{snap.state.serverId || "None"}</dd>
                  <dt>Stored pairings</dt>
                  <dd>{snap.credentials.length}</dd>
                </dl>
              </div>
            </Panel>
            <Panel eyebrow="PAIRING / ADD SERVER" title="Expand your workspace">
              <PairingForm defaultName="Operations browser" />
            </Panel>
          </div>
        )}
        {section === "privacy" && (
          <Panel
            eyebrow="PLAYER IDENTITY"
            title="Skins and privacy"
            description="Choose how this browser retrieves player heads."
          >
            <div className="settings-body">
              <label className="field">
                Skin provider
                <select
                  value={prefs.skinProvider}
                  onChange={(e) =>
                    preferences.update({
                      skinProvider: e.target.value as typeof prefs.skinProvider,
                    })
                  }
                >
                  <option value="crafatar">Crafatar direct</option>
                  <option value="mc-heads">MC-Heads direct</option>
                  <option value="minotar">Minotar direct</option>
                  <option value="proxy">
                    Same-origin proxy (requires deployment)
                  </option>
                  <option value="disabled">Disabled · local initials</option>
                </select>
              </label>
              <Notice tone="warning" title="Direct provider requests">
                Direct providers receive the viewer’s IP address and requested
                UUID. Disable skins for local initials. The optional same-origin
                proxy requires separate deployment.
              </Notice>
            </div>
          </Panel>
        )}
        {section === "diagnostics" && (
          <Panel
            eyebrow="BUILD / CONNECTION EVIDENCE"
            title="Know this workspace"
            action={<Button onClick={copy}>Copy redacted diagnostics</Button>}
          >
            <dl className="diagnostic-grid">
              <dt>Dashboard</dt>
              <dd>{build.dashboard ?? "Unavailable in development"}</dd>
              <dt>Commit</dt>
              <dd>
                <code>{build.commit ?? "Unavailable"}</code>
              </dd>
              <dt>Build time</dt>
              <dd>{build.builtAt ?? "Unavailable"}</dd>
              <dt>Wire protocol</dt>
              <dd>{build.protocolVersion ?? 3}</dd>
              <dt>Paper capture</dt>
              <dd>{String(snap.state.server.capturedAt ?? "No sample")}</dd>
              <dt>Host capture</dt>
              <dd>{String(snap.state.hostSystem.capturedAt ?? "No sample")}</dd>
              <dt>Grant role</dt>
              <dd>{snap.state.ready?.device.role ?? "No signed grant"}</dd>
            </dl>
          </Panel>
        )}
      </div>
      {error && (
        <div className="page-notice">
          <Notice tone="error" title="Connection configuration">
            {error}
          </Notice>
        </div>
      )}
      {message && (
        <div className="page-notice">
          <Notice tone="success" title="Preference saved">
            {message}
          </Notice>
        </div>
      )}
    </>
  );
}
