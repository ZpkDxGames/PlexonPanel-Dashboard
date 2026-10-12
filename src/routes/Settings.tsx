import { saveServerIcon } from "../lib/server-icon";
import { readVerifiedTransfer } from "../adapter/transfers";
import { ServerIcon } from "../components/ServerIcon";
import { Select } from "../components/Select";
import { copy } from "../i18n/en";
import { useEffect, useState } from "react";
import { diagnostics } from "../adapter/control-state";
import { session } from "../adapter/session";
import { PairingForm } from "../components/PairingForm";
import { Button, Notice, Panel, Status } from "../components/ui";
import { useSession } from "../hooks";
import { preferences, usePreferences } from "../store/preferences";
type BuildInfo = {
  commit?: string;
  builtAt?: string;
  protocolVersion?: number;
  dashboard?: string;
};
export default function Settings() {
  const snap = useSession();
  const prefs = usePreferences();
  const [origin, setOrigin] = useState(snap.relay.origin);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [iconBusy, setIconBusy] = useState(false);
  const [build, setBuild] = useState<BuildInfo>({});
  useEffect(() => setOrigin(snap.relay.origin), [snap.relay.origin]);
  useEffect(() => {
    void fetch("/build.json", { cache: "no-store" })
      .then((r) =>
        r.ok
          ? r.json()
          : Promise.reject(new Error("Build identity unavailable")),
      )
      .then(setBuild)
      .catch(() => setBuild({}));
  }, []);
  const saveOrigin = async () => {
    setError("");
    setMessage("");
    try {
      await session.setRelayOrigin(origin);
      setMessage(
        "Relay preference saved. Connection state will confirm whether the origin is reachable.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Relay origin rejected.",
      );
    }
  };
  const copyDiagnostics = () =>
    void navigator.clipboard.writeText(diagnostics(snap.state));
  const saveIcon = async (blob: Blob, serverId: string) => {
    await saveServerIcon(blob, serverId);
    setMessage("Icon saved for this server in this browser.");
  };
  const loadIcon = async () => {
    setError("");
    setIconBusy(true);
    const serverId = snap.state.serverId;
    try {
      const kind = snap.state.ready?.server.hostCapabilities["files.download"]
        ? "HOST"
        : "PAPER";
      const blob = await readVerifiedTransfer(
        "files.download",
        { root: "server", path: "server-icon.png" },
        kind,
        new AbortController().signal,
        () => {},
        256 * 1024,
      );
      await saveIcon(blob, serverId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Icon unavailable.");
    } finally {
      setIconBusy(false);
    }
  };
  return (
    <>
      <div className="settings-grid">
        <Panel
          eyebrow={copy.public_endpoint_b9f8d}
          title={copy.relay_connection_ae627}
          action={
            <Status
              tone={
                snap.phase === "live"
                  ? "success"
                  : snap.error
                    ? "error"
                    : "neutral"
              }
            >
              {snap.phase}
            </Status>
          }
        >
          <div className="settings-body">
            <label className="field">
              {copy.relay_https_origin_27e44}
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder={copy.https_relay_example_com_0178a}
                inputMode="url"
              />
            </label>
            <p className="disclosure">
              {copy.only_an_https_relay_origin_belongs_in_8a03b}
            </p>
            <div className="button-row">
              <Button onClick={() => void saveOrigin()}>
                {copy.save_origin_af70c}
              </Button>
              <Button
                onClick={() => session.reconnect()}
                disabled={!snap.state.serverId}
              >
                {copy.reconnect_6988b}
              </Button>
            </div>
            <dl className="settings-facts">
              <dt>{copy.configuration_source_41e24}</dt>
              <dd>{snap.relay.source}</dd>
              <dt>{copy.selected_server_3d8c3}</dt>
              <dd>{snap.state.serverId || "None"}</dd>
              <dt>{copy.stored_pairings_bdf84}</dt>
              <dd>{snap.credentials.length}</dd>
            </dl>
          </div>
        </Panel>
        <Panel
          eyebrow={copy.new_browser_authority_ef501}
          title={copy.pair_another_server_0a8c0}
        >
          <PairingForm defaultName="Operations browser" />
        </Panel>
        <Panel
          eyebrow={copy.local_presentation_bae1e}
          title={copy.interface_preferences_b82b3}
        >
          <div className="settings-body settings-options">
            <label className="field">
              {copy.theme_a797e}
              <Select
                value={prefs.theme}
                onChange={(e) =>
                  preferences.update({
                    theme: e.target.value as typeof prefs.theme,
                  })
                }
              >
                <option value="dark">{copy.dark_ae1ef}</option>
                <option value="light">{copy.light_a36ef}</option>
                <option value="system">{copy.system_bc079}</option>
              </Select>
            </label>
            <label className="field">
              {copy.density_f9160}
              <Select
                value={prefs.density}
                onChange={(e) =>
                  preferences.update({
                    density: e.target.value as typeof prefs.density,
                  })
                }
              >
                <option value="comfortable">{copy.comfortable_23137}</option>
                <option value="compact">{copy.compact_1df39}</option>
              </Select>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={prefs.reduceMotion}
                onChange={(e) =>
                  preferences.update({ reduceMotion: e.target.checked })
                }
              />
              {copy._reduce_motion_7bdb5}
            </label>
            <label className="field">
              {copy.time_zone_eea79}
              <Select value={prefs.timezone} disabled>
                <option value="America/Sao_Paulo">
                  Brazil / São Paulo (America/Sao_Paulo)
                </option>
              </Select>
            </label>
          </div>
        </Panel>
        <Panel
          eyebrow={copy.privacy_choice_a4d7a}
          title={copy.player_skin_provider_75f46}
        >
          <div className="settings-body">
            <label className="field">
              {copy.provider_7ceee}
              <Select
                value={prefs.skinProvider}
                onChange={(e) =>
                  preferences.update({
                    skinProvider: e.target.value as typeof prefs.skinProvider,
                  })
                }
              >
                <option value="auto">{copy.refine_954eb892}</option>
                <option value="crafatar">{copy.crafatar_direct_3711e}</option>
                <option value="mc-heads">{copy.mc_heads_direct_a25f6}</option>
                <option value="minotar">{copy.minotar_direct_7ce1f}</option>
                <option value="proxy">{copy.same_origin_proxy_28cb1}</option>
                <option value="disabled">{copy.disabled_f4f44}</option>
              </Select>
            </label>
            <Notice tone="warning" title={copy.third_party_disclosure_49cf4}>
              {copy.direct_providers_receive_the_viewer_s_c6939}
            </Notice>
          </div>
        </Panel>
      </div>
      <div className="settings-grid">
        <Panel title={copy.refine_fab49b90} eyebrow={copy.refine_a5b5e4cc}>
          <div className="settings-body settings-options">
            <label className="field">
              {copy.refine_d026c5a1}
              <Select
                value={prefs.telemetryInterval}
                onChange={(e) =>
                  preferences.update({
                    telemetryInterval: Number(
                      e.target.value,
                    ) as typeof prefs.telemetryInterval,
                  })
                }
              >
                {[50, 100, 250, 500, 1000].map((n) => (
                  <option key={n} value={n}>
                    {n} {copy.refine_26cc3217}
                    {n === 100 ? " · recommended" : ""}
                  </option>
                ))}
              </Select>
            </label>
            <p className="subtle">{copy.refine_87df9bb2}</p>
            <label className="field">
              Default graph window
              <Select
                value={prefs.chartWindowMs}
                onChange={(e) =>
                  preferences.update({
                    chartWindowMs: Number(
                      e.target.value,
                    ) as typeof prefs.chartWindowMs,
                  })
                }
              >
                <option value={30_000}>30 seconds</option>
                <option value={60_000}>1 minute · default</option>
                <option value={300_000}>5 minutes</option>
                <option value={600_000}>10 minutes</option>
              </Select>
            </label>
            <p className="subtle">
              Stored locally and shared by telemetry charts. Retained source
              history remains longer than the visible window.
            </p>
            <label className="field">
              {copy.refine_cbcf5f2f}
              <Select
                value={prefs.chartStyle}
                onChange={(e) =>
                  preferences.update({
                    chartStyle: e.target.value as typeof prefs.chartStyle,
                  })
                }
              >
                <option value="area">{copy.refine_e32761ab}</option>
                <option value="line">{copy.refine_dca2ce94}</option>
              </Select>
            </label>
            <label className="field">
              {copy.refine_2711f5fb}
              <Select
                value={prefs.chartCurve}
                onChange={(e) =>
                  preferences.update({
                    chartCurve: e.target.value as typeof prefs.chartCurve,
                  })
                }
              >
                <option value="smooth">{copy.refine_51184aa9}</option>
                <option value="straight">{copy.refine_2a4b06fb}</option>
                <option value="step">{copy.refine_cdde4f20}</option>
              </Select>
            </label>
            <label className="field">
              {copy.refine_501fd5e4}
              <Select
                value={prefs.chartDensity}
                onChange={(e) =>
                  preferences.update({
                    chartDensity: e.target.value as typeof prefs.chartDensity,
                  })
                }
              >
                <option value="rich">{copy.refine_6ed159c4}</option>
                <option value="compact">{copy.refine_7ef56157}</option>
              </Select>
            </label>
            <label className="field">
              {copy.refine_9f7c7a40}
              <Select
                value={prefs.accent}
                onChange={(e) =>
                  preferences.update({
                    accent: e.target.value as typeof prefs.accent,
                  })
                }
              >
                <option value="indigo">{copy.refine_8adac45b}</option>
                <option value="teal">{copy.refine_df0ad373}</option>
                <option value="sky">{copy.refine_b3d97fd6}</option>
                <option value="rose">{copy.refine_51ad0eae}</option>
              </Select>
            </label>
            <p className="subtle">{copy.refine_5009208c}</p>
          </div>
        </Panel>
        <Panel title={copy.refine_b02c300f} eyebrow={copy.refine_4aaac95c}>
          <div className="settings-body">
            <div className="server-icon">
              <ServerIcon />
            </div>
            <p className="subtle">{copy.refine_ccf454d0}</p>
            <div className="button-row">
              <Button
                disabled={iconBusy || !snap.state.serverId}
                onClick={() => void loadIcon()}
              >
                {iconBusy ? "Loading icon…" : "Load server-icon.png"}
              </Button>
              <Button
                disabled={!prefs.serverIcons[snap.state.serverId]}
                onClick={() => {
                  const icons = { ...prefs.serverIcons };
                  delete icons[snap.state.serverId];
                  preferences.update({ serverIcons: icons });
                }}
              >
                {copy.refine_24c377ea}
              </Button>
            </div>
            <label className="field">
              {copy.refine_a06120e3}
              <input
                type="file"
                accept="image/png"
                disabled={!snap.state.serverId}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void saveIcon(file, snap.state.serverId).catch((c) =>
                      setError(
                        c instanceof Error ? c.message : "Icon unavailable.",
                      ),
                    );
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </Panel>
      </div>
      <Panel
        eyebrow={copy.exact_identity_81b8d}
        title={copy.diagnostics_3af22}
        action={
          <Button onClick={copyDiagnostics}>
            {copy.copy_redacted_diagnostics_88fac}
          </Button>
        }
      >
        <dl className="diagnostic-grid">
          <dt>{copy.dashboard_d87f4}</dt>
          <dd>{build.dashboard ?? "Unavailable"}</dd>
          <dt>{copy.commit_1a187}</dt>
          <dd>
            <code>{build.commit ?? "Unavailable"}</code>
          </dd>
          <dt>{copy.built_a6ad3}</dt>
          <dd>{build.builtAt ?? "Unavailable"}</dd>
          <dt>{copy.protocol_1ed77}</dt>
          <dd>{build.protocolVersion ?? 3}</dd>
          <dt>{copy.paper_clock_37d6c}</dt>
          <dd>
            {snap.state.server.capturedAt
              ? String(snap.state.server.capturedAt)
              : "No sample"}
          </dd>
          <dt>{copy.grant_role_d9dd7}</dt>
          <dd>{snap.state.ready?.device.role ?? "No signed grant"}</dd>
        </dl>
      </Panel>
      {(error || snap.error) && (
        <div className="page-notice">
          <Notice tone="error" title={copy.connection_configuration_38798}>
            {error || snap.error}
          </Notice>
        </div>
      )}
      {message && (
        <div className="page-notice">
          <Notice tone="success" title={copy.preference_updated_9c54e}>
            {message}
          </Notice>
        </div>
      )}
    </>
  );
}
