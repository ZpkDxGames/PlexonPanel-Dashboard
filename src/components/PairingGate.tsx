import { useSession } from "../hooks";
import { PairingForm } from "./PairingForm";
import { BrandMark } from "./Brand";
import { Icon } from "./Icon";
export function PairingGate() {
  const snap = useSession();
  return (
    <main className="pairing-gate">
      <header className="pairing-brand">
        <BrandMark />
        <strong>PlexonPanel</strong>
        <span>CONTROL PLANE</span>
      </header>
      <div className="pairing-layout">
        <section className="pairing-intro">
          <span className="eyebrow">YOUR WORLDS. ONE WORKSPACE.</span>
          <h1>
            Great worlds
            <br />
            start with
            <br />
            <em>clear signals.</em>
          </h1>
          <p>
            Live Minecraft telemetry. Thoughtful controls.
            <br />A complete picture of your server.
          </p>
          <div
            className="pairing-architecture"
            aria-label="Paper and Host connect securely to this browser"
          >
            <span>
              <Icon name="server" />
              Paper <small>Game runtime</small>
            </span>
            <b>+</b>
            <span>
              <Icon name="performance" />
              Host <small>Infrastructure</small>
            </span>
            <Icon name="arrow" />
            <span>
              <BrandMark />
              You <small>In control</small>
            </span>
          </div>
        </section>
        <section className="pairing-card" aria-labelledby="pairing-form-title">
          <div className="pairing-card-head">
            <span className="eyebrow">01 / CONNECT YOUR SERVER</span>
            <h2 id="pairing-form-title">Make the connection.</h2>
            <p>
              Use a fresh, single-use pairing code from your Minecraft server.
            </p>
          </div>
          <PairingForm onboarding />
          <div className="pairing-help">
            <Icon name="access" />
            <p>
              This browser receives only the access granted by your server. You
              can review or revoke devices later.
            </p>
          </div>
          <div className="pairing-boundary">
            <span>Relay endpoint</span>
            <code>
              {snap.relay.origin || "Enter your public HTTPS relay above"}
            </code>
          </div>
        </section>
      </div>
      <footer className="pairing-footer">
        <span>Encrypted transport</span>
        <span>Scoped access</span>
        <span>Protocol 3</span>
      </footer>
    </main>
  );
}
