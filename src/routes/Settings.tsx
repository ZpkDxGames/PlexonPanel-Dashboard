import { useEffect, useState } from "react";
import { diagnostics } from "../adapter/control-state";
import { session } from "../adapter/session";
import { PairingForm } from "../components/PairingForm";
import { Button, Notice, Panel, Status } from "../components/ui";
import { useSession } from "../hooks";
import { preferences, usePreferences } from "../store/preferences";
import { toast } from "../components/toast";
import { BrandMark } from "../components/Brand";
import { Icon } from "../components/Icon";
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
  const sectionFromHash = (): Section => {
    const value = new URLSearchParams(location.hash.split("?")[1] ?? "").get(
      "section",
    );
    return ["appearance", "connection", "privacy", "diagnostics"].includes(
      value ?? "",
    )
      ? (value as Section)
      : "appearance";
  };
  const [section, setSection] = useState<Section>(sectionFromHash);
  const [saving, setSaving] = useState(false),
    [preferenceSaved, setPreferenceSaved] = useState(false);
  useEffect(() => {
    const update = () => setSection(sectionFromHash());
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  const updatePreference = (
    patch: Parameters<typeof preferences.update>[0],
  ) => {
    preferences.update(patch);
    setPreferenceSaved(true);
  };
  const snap = useSession(),
    prefs = usePreferences(),
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
    setSaving(true);
    try {
      await session.setRelayOrigin(origin);
      setMessage(
        "Relay preference saved. Connection state will confirm reachability.",
      );
      toast.push(
        "Relay preference saved",
        "Connection state will confirm reachability.",
        "success",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Relay origin rejected.",
      );
    } finally {
      setSaving(false);
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
      <div className="settings-document">
        <aside className="settings-index">
          <span className="eyebrow">SETTINGS</span>
          <nav aria-label="Settings sections">
            {sections.map(([value, label]) => (
              <a
                key={value}
                href={`#Settings?section=${value}`}
                className={section === value ? "active" : ""}
                aria-current={section === value ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setSection(value);
                  history.replaceState(null, "", `#Settings?section=${value}`);
                }}
              >
                <Icon
                  name={
                    value === "appearance"
                      ? "sun"
                      : value === "connection"
                        ? "server"
                        : value === "privacy"
                          ? "players"
                          : "performance"
                  }
                />
                {label}
              </a>
            ))}
          </nav>
          <div className="workspace-passport">
            <BrandMark />
            <strong>Browser preferences</strong>
            <p>
              Preferences stay in this browser. Server permissions come from
              your signed grant.
            </p>
            <span>{snap.state.ready?.device.name ?? "Browser device"}</span>
          </div>
        </aside>
        <div className="settings-content">
          {preferenceSaved && (
            <div className="save-feedback" role="status">
              <Icon name="check" />
              Applied in this browser
            </div>
          )}{" "}
          <section
            id="settings-appearance"
            hidden={section !== "appearance"}
            className="settings-chapter"
          >
            <Panel
              eyebrow="LOCAL WORKSPACE"
              title="Appearance"
              description="Choose a theme and tune the way your workspace feels. Changes apply immediately in this browser. Storage is optional."
              className="preferences-panel"
            >
              <div className="preferences-layout">
                <div className="preferences-controls">
                  <Options
                    label="Color theme"
                    value={prefs.theme}
                    options={[
                      {
                        value: "dark",
                        label: "Dark",
                        detail: "Dark workspace",
                      },
                      {
                        value: "light",
                        label: "Light",
                        detail: "Light workspace",
                      },
                      {
                        value: "system",
                        label: "System",
                        detail: "Follow your device",
                      },
                    ]}
                    onChange={(theme) => updatePreference({ theme })}
                  />
                  <Options
                    label="Layout density"
                    value={prefs.density}
                    options={[
                      { value: "compact", label: "Compact" },
                      { value: "comfortable", label: "Comfortable" },
                      { value: "spacious", label: "Spacious" },
                    ]}
                    onChange={(density) => updatePreference({ density })}
                  />
                  <Options
                    label="Text size"
                    value={prefs.textSize}
                    options={[
                      { value: "small", label: "Small" },
                      { value: "standard", label: "Standard" },
                      { value: "large", label: "Large" },
                    ]}
                    onChange={(textSize) => updatePreference({ textSize })}
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
                    onChange={(motion) => updatePreference({ motion })}
                  />
                  <Options
                    label="Signal accent"
                    value={prefs.accent}
                    options={[
                      { value: "teal", label: "Cyan" },
                      { value: "blue", label: "Azure" },
                      { value: "violet", label: "Violet" },
                    ]}
                    onChange={(accent) => updatePreference({ accent })}
                  />
                  <div className="settings-inline-options">
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={prefs.chartFill}
                        onChange={(e) =>
                          updatePreference({ chartFill: e.target.checked })
                        }
                      />
                      Soft plot area fill
                    </label>
                    <label className="field">
                      Time zone
                      <select
                        value={prefs.timezone}
                        onChange={(e) =>
                          updatePreference({
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
                  <span className="eyebrow">WORKSPACE PREVIEW</span>
                  <div className="type-specimen">
                    Aa<span>0123456789</span>
                  </div>
                  <strong>Clear at every scale.</strong>
                  <p>Legible labels and stable, tabular measurements.</p>
                  <div className="specimen-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                  <Status>Source state · specimen</Status>
                  <Button disabled title="Illustrative control only">
                    Unavailable action
                  </Button>
                  <p className="action-availability">
                    Specimen only; no server action.
                  </p>
                  <small>System reduced motion is always respected.</small>
                </aside>
              </div>
            </Panel>
          </section>
          <section
            id="settings-connection"
            hidden={section !== "connection"}
            className="settings-chapter"
          >
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
                    Use your public HTTPS relay endpoint. Private keys and
                    service credentials are never needed here.
                  </p>
                  <div className="button-row">
                    <Button
                      variant="primary"
                      loading={saving}
                      disabled={origin === snap.relay.origin}
                      onClick={() => void save()}
                    >
                      Save origin
                    </Button>
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
              <Panel eyebrow="PAIRING / ADD SERVER" title="Pair another server">
                <PairingForm defaultName="Operations browser" />
              </Panel>
            </div>
          </section>
          <section
            id="settings-privacy"
            hidden={section !== "privacy"}
            className="settings-chapter"
          >
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
                      updatePreference({
                        skinProvider: e.target
                          .value as typeof prefs.skinProvider,
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
                  UUID. Disable skins for local initials. The optional
                  same-origin proxy requires separate deployment.
                </Notice>
              </div>
            </Panel>
          </section>
          <section
            id="settings-diagnostics"
            hidden={section !== "diagnostics"}
            className="settings-chapter"
          >
            <Panel
              eyebrow="BUILD / CONNECTION EVIDENCE"
              title="Build & connection evidence"
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
                <dd>
                  {String(snap.state.hostSystem.capturedAt ?? "No sample")}
                </dd>
                <dt>Grant role</dt>
                <dd>{snap.state.ready?.device.role ?? "No signed grant"}</dd>
              </dl>
            </Panel>
          </section>
        </div>
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
          <Notice tone="success" title="Preference applied">
            {message}
          </Notice>
        </div>
      )}
    </>
  );
}
