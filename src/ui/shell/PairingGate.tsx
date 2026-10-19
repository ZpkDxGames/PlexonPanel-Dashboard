"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers3, ArrowRight, LoaderCircle } from "lucide-react";
import { session, useControl } from "../bindings";
export function PairingGate() {
  const snap = useControl(),
    router = useRouter(),
    [code, setCode] = useState(Array(6).fill("") as string[]),
    [name, setName] = useState("My browser"),
    [origin, setOrigin] = useState(snap.relay.origin),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    refs = useRef<(HTMLInputElement | null)[]>([]);
  function paste(value: string) {
    const chars = value.replace(/\D/g, "").slice(0, 6).split("");
    setCode(Array.from({ length: 6 }, (_, i) => chars[i] ?? ""));
    refs.current[Math.min(chars.length, 5)]?.focus();
  }
  return (
    <main className="pp-pair">
      <form
        className="pp-glass pp-pair-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || code.some((v) => !v) || !name.trim()) return;
          setBusy(true);
          setError("");
          try {
            await session.pair(origin, code.join(""), name);
            router.replace("/overview");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <section>
          <div className="row tone" style={{ marginBottom: 20 }}>
            <Layers3 size={25} />
            <strong style={{ fontSize: 16 }}>plexonpanel</strong>
            <span className="pp-tag push">Protocol 3</span>
          </div>
          <span className="pp-kicker">Secure browser pairing</span>
          <h1 style={{ marginTop: 7 }}>Pair this browser.</h1>
        </section>
        <section>
          <label className="pp-pair-field">
            Device name
            <input
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              readOnly={busy}
            />
          </label>
          <label className="pp-pair-field">
            Relay HTTPS endpoint
            <input
              type="url"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="https://your-relay.example"
              required
              readOnly={busy}
            />
          </label>
          <div
            className="pp-otp"
            aria-label="Six digit pairing code"
            onPaste={(e) => {
              e.preventDefault();
              paste(e.clipboardData.getData("text"));
            }}
          >
            {code.map((v, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                aria-label={`Pairing code digit ${i + 1}`}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                pattern="[0-9]"
                maxLength={1}
                value={v}
                readOnly={busy}
                required
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(-1);
                  setCode((old) => old.map((v, n) => (n === i ? next : v)));
                  if (next) refs.current[Math.min(5, i + 1)]?.focus();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !code[i] && i)
                    refs.current[i - 1]?.focus();
                  if (e.key === "ArrowLeft")
                    refs.current[Math.max(0, i - 1)]?.focus();
                  if (e.key === "ArrowRight")
                    refs.current[Math.min(5, i + 1)]?.focus();
                }}
              />
            ))}
          </div>
          <small className="muted">
            Enter the current code issued by your server.
          </small>
        </section>
        <section>
          <div
            role="status"
            className={error ? "pp-error" : "muted"}
            style={{
              fontSize: 11,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginBottom: 14,
            }}
          >
            {error ||
              snap.error ||
              "A separate signed identity is created for this browser."}
          </div>
          {/expir/i.test(error) && (
            <button
              type="button"
              className="muted"
              style={{ fontSize: 11, marginBottom: 12 }}
              onClick={() => {
                setCode(Array(6).fill(""));
                setError("Request a new pairing code from the server.");
                refs.current[0]?.focus();
              }}
            >
              Request new code
            </button>
          )}
          <button
            className="pp-ctl"
            data-primary="true"
            style={{ width: "100%", height: 38 }}
            aria-disabled={busy || code.some((v) => !v) || undefined}
          >
            {busy ? <LoaderCircle size={14} /> : <ArrowRight size={14} />}
            {busy ? "Claiming device…" : "Claim device"}
          </button>
        </section>
      </form>
    </main>
  );
}
