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
  const [failedSource, setFailedSource] = useState("");
  const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid) && !/^0{8}-0{4}-4000-8000-0{12}$/.test(uuid);
  const url = validUuid ? source(skinProvider, uuid) : "";
  const unverified = skinProvider === "disabled" || failedSource === url || !validUuid || name.startsWith(".");
  return <span className={`player-head ${large ? "large" : ""}`} title={unverified ? "Default head · skin unverified" : `${name} skin via ${skinProvider}`}>
    {!unverified && <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSource(url)} />}
    {unverified && <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
    <span className="sr-only">{unverified ? "Skin unverified" : `${name} skin head`}</span>
  </span>;
}
