import { copy } from "../i18n/en";
import { useSession } from "../hooks";
import { PairingForm } from "./PairingForm";
export function PairingGate() {
  const snap = useSession();
  return (
    <main className="pairing-gate">
      <header
        className="pairing-brand"
        aria-label={copy.plexonpanel_command_center_d9cf6}
      >
        <span className="brand-mark" aria-hidden="true">
          {copy.p_51199}
        </span>
        <span className="brand-copy">
          <strong>{copy.plexonpanel_1a4a7}</strong>
          <small>{copy.command_center_8e019}</small>
        </span>
      </header>
      <div className="pairing-layout">
        <section className="pairing-intro" aria-labelledby="pairing-title">
          <span className="eyebrow">{copy.first_connection_e91b5}</span>
          <h1 id="pairing-title">{copy.bring_your_server_into_view_8dd91}</h1>
          <p>{copy.pair_this_browser_with_one_minecraft_s_2ddb9}</p>
          <ol className="pairing-steps">
            <li>
              <span>1</span>
              <div>
                <strong>{copy.create_a_fresh_code_3d9f6}</strong>
                <small>
                  {copy.use_the_plexonpanel_pairing_flow_on_yo_99526}
                </small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>{copy.name_this_browser_97740}</strong>
                <small>
                  {copy.choose_a_device_name_you_will_recogniz_13992}
                </small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>{copy.connect_with_least_privilege_a45ba}</strong>
                <small>
                  {copy.monitoring_does_not_require_owner_auth_cdb36}
                </small>
              </div>
            </li>
          </ol>
        </section>
        <section className="pairing-card" aria-labelledby="pairing-form-title">
          <div className="pairing-card-head">
            <div>
              <span className="eyebrow">
                {copy.secure_browser_authority_7dff8}
              </span>
              <h2 id="pairing-form-title">{copy.pair_a_server_fe868}</h2>
            </div>
            <span
              className={
                snap.relay.origin ? "relay-ready" : "relay-ready relay-missing"
              }
            >
              <i />
              {snap.relay.origin ? "Relay ready" : "Relay required"}
            </span>
          </div>
          <PairingForm onboarding />
          <div className="pairing-boundary">
            <span>{copy.public_relay_99d1e}</span>
            <code>{snap.relay.origin || "Not configured"}</code>
            <p>{copy.credentials_stay_in_this_browser_cloud_663c3}</p>
          </div>
        </section>
      </div>
      <footer className="pairing-footer">
        <span>{copy.protocol_3_bed81}</span>
        <span>{copy.encrypted_relay_transport_471a1}</span>
        <span>{copy.permission_aware_actions_166e9}</span>
      </footer>
    </main>
  );
}
