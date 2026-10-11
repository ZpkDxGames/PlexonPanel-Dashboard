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
              <select
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
              </select>
            </label>
            <label className="field">
              {copy.density_f9160}
              <select
                value={prefs.density}
                onChange={(e) =>
                  preferences.update({
                    density: e.target.value as typeof prefs.density,
                  })
                }
              >
                <option value="comfortable">{copy.comfortable_23137}</option>
                <option value="compact">{copy.compact_1df39}</option>
              </select>
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
              <select
                value={prefs.timezone}
                onChange={(e) =>
                  preferences.update({
                    timezone: e.target.value as typeof prefs.timezone,
                  })
                }
              >
                <option value="browser">{copy.browser_54a2c}</option>
                <option value="UTC">{copy.utc_bdfd4}</option>
              </select>
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
              <select
                value={prefs.skinProvider}
                onChange={(e) =>
                  preferences.update({
                    skinProvider: e.target.value as typeof prefs.skinProvider,
                  })
                }
              >
                <option value="crafatar">{copy.crafatar_direct_3711e}</option>
                <option value="mc-heads">{copy.mc_heads_direct_a25f6}</option>
                <option value="minotar">{copy.minotar_direct_7ce1f}</option>
                <option value="proxy">{copy.same_origin_proxy_28cb1}</option>
                <option value="disabled">{copy.disabled_f4f44}</option>
              </select>
            </label>
            <Notice tone="warning" title={copy.third_party_disclosure_49cf4}>
              {copy.direct_providers_receive_the_viewer_s_c6939}
            </Notice>
          </div>
        </Panel>
      </div>
      <Panel
        eyebrow={copy.exact_identity_81b8d}
        title={copy.diagnostics_3af22}
        action={
          <Button onClick={copyDiagnostics}>{copy.copy_redacted_diagnostics_88fac}</Button>
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
