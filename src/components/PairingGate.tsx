import { useSession } from "../hooks";
import { PairingForm } from "./PairingForm";

export function PairingGate() {
  const snap = useSession();
  return <main className="pairing-gate">
    <header className="pairing-brand" aria-label="PlexonPanel Command Center">
      <span className="brand-mark" aria-hidden="true">P</span>
      <span className="brand-copy"><strong>PlexonPanel</strong><small>Command center</small></span>
    </header>
    <div className="pairing-layout">
      <section className="pairing-intro" aria-labelledby="pairing-title">
        <span className="eyebrow">First connection</span>
        <h1 id="pairing-title">Bring your server into view.</h1>
        <p>Pair this browser with one Minecraft server to unlock live telemetry, operational controls and audit-aware workflows.</p>
        <ol className="pairing-steps">
          <li><span>1</span><div><strong>Create a fresh code</strong><small>Use the PlexonPanel pairing flow on your server. Codes are single-use and short-lived.</small></div></li>
          <li><span>2</span><div><strong>Name this browser</strong><small>Choose a device name you will recognize later in Access &amp; Audit.</small></div></li>
          <li><span>3</span><div><strong>Connect with least privilege</strong><small>Monitoring does not require owner authority. The signed grant controls every available action.</small></div></li>
        </ol>
      </section>
      <section className="pairing-card" aria-labelledby="pairing-form-title">
        <div className="pairing-card-head">
          <div><span className="eyebrow">Secure browser authority</span><h2 id="pairing-form-title">Pair a server</h2></div>
          <span className={snap.relay.origin ? "relay-ready" : "relay-ready relay-missing"}><i />{snap.relay.origin ? "Relay ready" : "Relay required"}</span>
        </div>
        <PairingForm onboarding />
        <div className="pairing-boundary">
          <span>Public relay</span><code>{snap.relay.origin || "Not configured"}</code>
          <p>Credentials stay in this browser. Cloudflare tokens, signing keys and pairing secrets never enter the dashboard bundle.</p>
        </div>
      </section>
    </div>
    <footer className="pairing-footer"><span>Protocol 3</span><span>Encrypted relay transport</span><span>Permission-aware actions</span></footer>
  </main>;
}
