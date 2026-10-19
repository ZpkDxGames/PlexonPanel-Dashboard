import { createContext, useContext, useRef, useState } from "react";
import { Box, KeyRound, Check, ArrowRight } from "lucide-react";
import { session, useControl, useNow } from "../hooks/useControl";
import { IconBadge } from "../primitives/IconBadge";
import { Pill } from "../primitives/Pill";
export const PairingContext = createContext<() => void>(() => {});
export const usePairing = () => useContext(PairingContext);
export function PairingGate({ onBack }: { onBack?: () => void }) {
  const snap = useControl(),
    [origin, setOrigin] = useState(snap.relay.origin),
    [name, setName] = useState("My browser"),
    [cells, setCells] = useState(Array(6).fill("") as string[]),
    [busy, setBusy] = useState(false),
    [claimed, setClaimed] = useState(false),
    [error, setError] = useState(""),
    start = useRef(Date.now()),
    inputs = useRef<(HTMLInputElement | null)[]>([]),
    left = Math.max(0, 300 - Math.floor((useNow() - start.current) / 1000));
  async function claim() {
    setBusy(true);
    setError("");
    try {
      await session.pair(origin, cells.join(""), name);
      setClaimed(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pp-canvas pairing-canvas">
      <section className="pp-glass pairing-card">
        <header className="card-header">
          <IconBadge icon={Box} />
          <strong>plexonpanel</strong>
          <Pill>5.0</Pill>
          <div
            className="countdown-ring ml-auto mono"
            aria-label="Pairing countdown"
          >
            <svg viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="rgb(var(--line)/.1)"
                strokeWidth="2"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="rgb(var(--accent))"
                strokeWidth="2"
                strokeDasharray={`${(left / 300) * 126} 126`}
                transform="rotate(-90 24 24)"
              />
            </svg>
            <span>
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
            </span>
          </div>
        </header>
        <h1 className="mt-8">Connect your server</h1>
        <p className="text-secondary leading-6 my-4">
          Generate a fresh pairing code on your server. Your browser receives
          its own scoped Protocol 3 credentials.
        </p>
        <label className="block mb-4">
          Relay HTTPS origin
          <input
            className="field w-full mt-2"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="https://relay.example.com"
          />
        </label>
        <label className="block mb-5">
          Device label
          <input
            className="field w-full mt-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="otp-cells" role="group" aria-label="Pairing code">
          {cells.map((v, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              aria-label={`Pairing code character ${i + 1}`}
              value={v}
              maxLength={1}
              className="pp-well"
              autoComplete="one-time-code"
              onPaste={(e) => {
                e.preventDefault();
                const chars = e.clipboardData
                  .getData("text")
                  .replace(/[^a-z0-9]/gi, "")
                  .slice(0, 6)
                  .toUpperCase()
                  .split("");
                setCells(Array.from({ length: 6 }, (_, i) => chars[i] ?? ""));
                inputs.current[Math.min(chars.length, 5)]?.focus();
              }}
              onChange={(e) => {
                const value = e.target.value
                  .replace(/[^a-z0-9]/gi, "")
                  .slice(-1)
                  .toUpperCase();
                setCells((c) => c.map((v, k) => (k === i ? value : v)));
                if (value) inputs.current[i + 1]?.focus();
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !v) inputs.current[i - 1]?.focus();
              }}
            />
          ))}
        </div>
        <button
          className="btn primary w-full mt-5"
          disabled={busy || cells.some((c) => !c) || !origin || !name}
          onClick={() => void claim()}
        >
          {busy ? "Claiming…" : "Claim pairing"}
          <ArrowRight size={14} />
        </button>
        {cells.some((c) => !c) || !origin || !name ? (
          <p className="gate-reason">
            Enter your relay origin, device label and six-character pairing code
            to continue.
          </p>
        ) : null}
        {(error || snap.error) && (
          <p role="alert" className="error-banner mt-4">
            {error || snap.error}
          </p>
        )}
        <div className="pp-hairline my-6" />
        <ol className="pairing-steps">
          {[
            "Generate device credentials",
            "Claim pairing · 5-minute code",
            "Open signed relay connection",
          ].map((v, i) => (
            <li key={v}>
              {claimed ? (
                <Check size={16} />
              ) : i === 0 ? (
                <KeyRound size={16} />
              ) : (
                <span className="source-chip">{i + 1}</span>
              )}
              {v}
            </li>
          ))}
        </ol>
        {onBack && (
          <button className="btn w-full mt-5" onClick={onBack}>
            Back to workspace
          </button>
        )}
        <p className="text-secondary text-center text-xs mt-5">
          Code expiry is enforced by the relay that issued it.
        </p>
      </section>
    </div>
  );
}
