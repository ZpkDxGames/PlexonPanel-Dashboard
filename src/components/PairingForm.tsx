import { useEffect, useId, useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { session } from "../adapter/session";
import { useSession } from "../hooks";
import { Button } from "./ui/button";
import { Input, Field } from "./ui/input";
import { Notice } from "./ui/empty";
export function PairingForm() {
  const snap = useSession(),
    id = useId();
  const [origin, setOrigin] = useState(snap.relay.origin),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (snap.relay.origin) setOrigin(snap.relay.origin);
  }, [snap.relay.origin]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await session.pair(origin, code, name.trim());
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pairing failed");
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-5">
      {!snap.relay.origin && (
        <Field label="Relay HTTPS origin">
          <Input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="https://relay.example.com"
            inputMode="url"
          />
        </Field>
      )}
      <Field label="Device name">
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          placeholder="My desktop"
          autoComplete="off"
        />
      </Field>
      <Field label="Pairing code">
        <Input
          id={`${id}-code`}
          type="password"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\s/g, "").slice(0, 128))
          }
          placeholder="Your one-time code"
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
        />
      </Field>
      <Button
        className="w-full"
        type="submit"
        disabled={!origin || !name.trim() || !code || snap.phase === "pairing"}
      >
        {snap.phase === "pairing" ? (
          <>
            <Loader2 className="animate-spin" />
            Pairing securely…
          </>
        ) : (
          <>
            Connect server
            <ArrowRight />
          </>
        )}
      </Button>
      {(error || (!snap.credentials.length && snap.error)) && (
        <Notice danger>{error || snap.error}</Notice>
      )}
    </form>
  );
}
