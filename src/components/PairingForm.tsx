import { copy } from "../i18n/en";
import { useEffect, useId, useState, type FormEvent } from "react";
import { session } from "../adapter/session";
import { useSession } from "../hooks";
import { Button, Notice } from "./ui";
export function PairingForm({
  defaultName = "",
  onboarding = false,
}: {
  defaultName?: string;
  onboarding?: boolean;
}) {
  const snap = useSession();
  const id = useId();
  const [origin, setOrigin] = useState(snap.relay.origin);
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pairing = snap.phase === "pairing";
  useEffect(() => {
    if (snap.relay.origin) setOrigin(snap.relay.origin);
  }, [snap.relay.origin]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const deviceName = name.trim();
    if (!origin || !deviceName || !code) return;
    setError("");
    setMessage("");
    try {
      await session.pair(origin, code, deviceName);
      setCode("");
      setMessage("Pairing accepted. Establishing the signed server session.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pairing failed.");
    }
  }
  const visibleError =
    error || (snap.credentials.length === 0 ? snap.error : "");
  return (
    <form
      className={
        onboarding
          ? "pairing-form pairing-form-onboarding"
          : "settings-body pairing-form"
      }
      onSubmit={(event) => void submit(event)}
    >
      {!snap.relay.origin && (
        <label className="field" htmlFor={`${id}-origin`}>
          {copy.relay_https_origin_27e44}
          <input
            id={`${id}-origin`}
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            placeholder={copy.https_relay_example_com_0178a}
            inputMode="url"
            autoComplete="url"
          />
        </label>
      )}
      <label className="field" htmlFor={`${id}-name`}>
        {copy.device_name_79d7a}
        <input
          id={`${id}-name`}
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, 80))}
          placeholder={copy.my_desktop_3e871}
          autoComplete="off"
        />
      </label>
      <label className="field" htmlFor={`${id}-code`}>
        {copy.pairing_code_309e3}
        <input
          id={`${id}-code`}
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\s/g, "").slice(0, 128))
          }
          placeholder={copy.enter_the_one_time_code_9ad02}
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          type="password"
        />
      </label>
      <Button
        variant="primary"
        type="submit"
        disabled={pairing || !origin || !code || !name.trim()}
      >
        {pairing ? "Pairing securely…" : "Pair server"}
      </Button>
      {visibleError && (
        <Notice tone="error" title={copy.pairing_not_completed_64f90}>
          {visibleError}
        </Notice>
      )}
      {message && (
        <Notice tone="success" title={copy.pairing_accepted_ae109}>
          {message}
        </Notice>
      )}
    </form>
  );
}
