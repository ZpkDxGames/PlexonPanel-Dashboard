import { useState } from "react";
import { usePreferences } from "../store/preferences";

function source(provider: string, uuid: string) {
  const compact = uuid.replaceAll("-", "");
  if (provider === "proxy") return `/api/skin/${uuid}`;
  if (provider === "mc-heads") return `https://mc-heads.net/avatar/${compact}/64`;
  if (provider === "minotar") return `https://minotar.net/avatar/${compact}/64`;
  return `https://crafatar.com/avatars/${compact}?size=64&overlay`;
}

export function PlayerHead({ uuid, name, large = false }: { uuid: string; name: string; large?: boolean }) {
  const { skinProvider } = usePreferences();
  const [failed, setFailed] = useState(false);
  const unverified = skinProvider === "disabled" || failed || name.startsWith(".");
  return <span className={`player-head ${large ? "large" : ""}`} title={unverified ? "Default head · skin unverified" : `${name} skin via ${skinProvider}`}>
    {!unverified && <img src={source(skinProvider, uuid)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    {unverified && <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
    <span className="sr-only">{unverified ? "Skin unverified" : `${name} skin head`}</span>
  </span>;
}
