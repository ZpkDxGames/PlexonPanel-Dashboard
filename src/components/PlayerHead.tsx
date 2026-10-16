import { useState } from "react";
import { usePreferences } from "../store/preferences";

function source(provider: string, uuid: string) {
  const compact = uuid.replaceAll("-", "");
  if (provider === "proxy") return `/api/skin/${uuid}`;
  if (provider === "mc-heads")
    return `https://mc-heads.net/avatar/${compact}/64`;
  if (provider === "minotar") return `https://minotar.net/avatar/${compact}/64`;
  return `https://crafatar.com/avatars/${compact}?size=64&overlay`;
}

export function PlayerHead(props: {
  uuid: string;
  name: string;
  large?: boolean;
}) {
  const { skinProvider } = usePreferences();
  return (
    <Head
      key={`${skinProvider}:${props.uuid}:${props.name}`}
      {...props}
      skinProvider={skinProvider}
    />
  );
}
function Head({
  uuid,
  name,
  large = false,
  skinProvider,
}: {
  uuid: string;
  name: string;
  large?: boolean;
  skinProvider: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const unverified =
    skinProvider === "disabled" || failed || name.startsWith(".");
  return (
    <span
      className={`player-head ${large ? "large" : ""}`}
      title={
        unverified
          ? "Default head · skin unverified"
          : `${name} skin via ${skinProvider}`
      }
    >
      {!unverified && (
        <img
          className={loaded ? "loaded" : ""}
          src={source(skinProvider, uuid)}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      {unverified && (
        <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      )}
      <span className="sr-only">
        {unverified ? "Skin unverified" : `${name} skin head`}
      </span>
    </span>
  );
}
