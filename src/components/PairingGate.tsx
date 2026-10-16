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
        <strong>
          plexon<span>panel</span>
        </strong>
        <small>MINECRAFT OPERATIONS</small>
      </header>
      <section className="provisioning">
        <span className="eyebrow">SECURE SERVER ACCESS</span>
        <h1>
          Your server, within reach.
        </h1>
        <p className="pairing-lead">
          Live telemetry, players and server controls in one place. Use a one-time code to connect this browser.
        </p>
        <div className="provisioning-form">
          <div className="provisioning-heading">
            <span className="setup-index">01</span>
            <div>
              <h2 id="pairing-form-title">Connect a server</h2>
              <p>
                A fresh pairing code gives this browser its own scoped access.
              </p>
            </div>
          </div>
          <PairingForm onboarding />
        </div>
        <div className="pairing-trust">
          <div>
            <Icon name="server" />
            <strong>Paper</strong>
            <span>Game & player telemetry</span>
          </div>
          <div>
            <Icon name="performance" />
            <strong>Host</strong>
            <span>Infrastructure & backups</span>
          </div>
          <div>
            <Icon name="access" />
            <strong>Your browser</strong>
            <span>Only the access you grant</span>
          </div>
        </div>
        <p className="pairing-boundary">
          Relay <code>{snap.relay.origin || "Your public HTTPS endpoint"}</code>
          <span>Protocol 3 · Encrypted transport</span>
        </p>
      </section>
      <footer className="pairing-footer">Built for the worlds you run.</footer>
    </main>
  );
}
