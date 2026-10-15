import { useEffect, useState, type ReactNode } from "react";
import { diagnostics } from "../adapter/control-state";
import { session } from "../adapter/session";
import { PairingForm } from "../components/PairingForm";
import { Button, Notice, Panel, Status } from "../components/ui";
import { useSession } from "../hooks";
import { preferences, usePreferences } from "../store/preferences";
import { toast } from "../components/toast";

type BuildInfo = { commit?: string; builtAt?: string; protocolVersion?: number; dashboard?: string };

function OptionGroup<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; detail?: string }[];
  onChange: (value: T) => void;
}) {
  return <fieldset className="option-group">
    <legend>{label}</legend>
    <div>{options.map((option) => <button type="button" key={option.value} className={value === option.value ? "active" : ""} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      <span>{option.label}</span>{option.detail && <small>{option.detail}</small>}
    </button>)}</div>
  </fieldset>;
}

function PreferencePreview({ children }: { children?: ReactNode }) {
  return <div className="preference-preview" aria-label="Live interface preview">
    <div className="preview-window">
      <div className="preview-rail"><i /><i className="active" /><i /><i /></div>
      <div className="preview-content">
        <span>Live preview</span>
        <strong>Operational clarity</strong>
        <div className="preview-metrics"><i /><i /><i /></div>
        <div className="preview-chart"><svg viewBox="0 0 220 54" preserveAspectRatio="none" aria-hidden="true"><path d="M0 41 L28 34 L52 37 L78 20 L104 25 L132 14 L160 22 L190 8 L220 16" /></svg></div>
      </div>
    </div>
    {children}
  </div>;
}

export default function Settings() {
  const snap = useSession();
  const prefs = usePreferences();
  const [origin, setOrigin] = useState(snap.relay.origin);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [build, setBuild] = useState<BuildInfo>({});

  useEffect(() => setOrigin(snap.relay.origin), [snap.relay.origin]);
  useEffect(() => {
    void fetch("/build.json", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Build identity unavailable")))
      .then(setBuild)
      .catch(() => setBuild({}));
  }, []);

  const saveOrigin = async () => {
    setError(""); setMessage("");
    try {
      await session.setRelayOrigin(origin);
      setMessage("Relay preference saved. Connection state will confirm whether the origin is reachable.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Relay origin rejected.");
    }
  };
  const copy = () => { void navigator.clipboard.writeText(diagnostics(snap.state)); toast.push("Diagnostics copied", "Sensitive values remain redacted.", "success"); };

  return <>
    <div className="settings-grid">
      <Panel eyebrow="Public endpoint" title="Relay connection" action={<Status tone={snap.phase === "live" ? "success" : snap.error ? "error" : "neutral"}>{snap.phase}</Status>}>
        <div className="settings-body">
          <label className="field">Relay HTTPS origin<input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="https://relay.example.com" inputMode="url" /></label>
          <p className="disclosure">Only an HTTPS relay origin belongs in the frontend. Cloudflare tokens, pairing peppers, signing keys and access-token secrets never enter this browser build.</p>
          <div className="button-row"><Button onClick={() => void saveOrigin()}>Save origin</Button><Button onClick={() => session.reconnect()} disabled={!snap.state.serverId}>Reconnect</Button></div>
          <dl className="settings-facts"><dt>Configuration source</dt><dd>{snap.relay.source}</dd><dt>Selected server</dt><dd>{snap.state.serverId || "None"}</dd><dt>Stored pairings</dt><dd>{snap.credentials.length}</dd></dl>
        </div>
      </Panel>
      <Panel eyebrow="New browser authority" title="Pair another server"><PairingForm defaultName="Operations browser" /></Panel>
    </div>

    <Panel eyebrow="Local presentation" title="Interface preferences" className="preferences-panel">
      <div className="preferences-layout">
        <div className="preferences-controls">
          <OptionGroup label="Theme" value={prefs.theme} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]} onChange={(theme) => preferences.update({ theme })} />
          <OptionGroup label="Density" value={prefs.density} options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }, { value: "spacious", label: "Spacious" }]} onChange={(density) => preferences.update({ density })} />
          <OptionGroup label="Text size" value={prefs.textSize} options={[{ value: "small", label: "Small" }, { value: "standard", label: "Standard" }, { value: "large", label: "Large" }]} onChange={(textSize) => preferences.update({ textSize })} />
          <OptionGroup label="Motion" value={prefs.motion} options={[{ value: "full", label: "Full", detail: "Purposeful movement" }, { value: "reduced", label: "Reduced", detail: "Opacity only" }, { value: "off", label: "Off", detail: "Instant changes" }]} onChange={(motion) => preferences.update({ motion })} />
          <OptionGroup label="Accent" value={prefs.accent} options={[{ value: "teal", label: "Signal teal" }, { value: "blue", label: "Azure" }, { value: "violet", label: "Violet" }]} onChange={(accent) => preferences.update({ accent })} />
          <div className="settings-inline-options">
            <label className="check-row"><input type="checkbox" checked={prefs.chartFill} onChange={(event) => preferences.update({ chartFill: event.target.checked })} /> Soft chart area fill</label>
            <label className="field">Time zone<select value={prefs.timezone} onChange={(event) => preferences.update({ timezone: event.target.value as typeof prefs.timezone })}><option value="browser">Browser</option><option value="UTC">UTC</option></select></label>
          </div>
        </div>
        <PreferencePreview><p>Changes apply locally and immediately. Operational data, authority and transport remain unchanged.</p></PreferencePreview>
      </div>
    </Panel>

    <div className="settings-grid settings-grid-lower">
      <Panel eyebrow="Privacy choice" title="Player skin provider"><div className="settings-body"><label className="field">Provider<select value={prefs.skinProvider} onChange={(event) => preferences.update({ skinProvider: event.target.value as typeof prefs.skinProvider })}><option value="crafatar">Crafatar direct</option><option value="mc-heads">MC-Heads direct</option><option value="minotar">Minotar direct</option><option value="proxy">Same-origin proxy</option><option value="disabled">Disabled</option></select></label><Notice tone="warning" title="Third-party disclosure">Direct providers receive the viewer’s IP address and requested player UUIDs. Disable skins or deploy the documented same-origin proxy to avoid direct browser requests.</Notice></div></Panel>
      <Panel eyebrow="Exact identity" title="Diagnostics" action={<Button onClick={copy}>Copy redacted diagnostics</Button>}><dl className="diagnostic-grid"><dt>Dashboard</dt><dd>{build.dashboard ?? "Unavailable"}</dd><dt>Commit</dt><dd><code>{build.commit ?? "Unavailable"}</code></dd><dt>Built</dt><dd>{build.builtAt ?? "Unavailable"}</dd><dt>Protocol</dt><dd>{build.protocolVersion ?? 3}</dd><dt>Paper clock</dt><dd>{snap.state.server.capturedAt ? String(snap.state.server.capturedAt) : "No sample"}</dd><dt>Grant role</dt><dd>{snap.state.ready?.device.role ?? "No signed grant"}</dd></dl></Panel>
    </div>
    {(error || snap.error) && <div className="page-notice"><Notice tone="error" title="Connection configuration">{error || snap.error}</Notice></div>}
    {message && <div className="page-notice"><Notice tone="success" title="Preference updated">{message}</Notice></div>}
  </>;
}
