import { copy } from "../i18n/en";
import { useEffect, useState } from "react";
import { usePreferences } from "../store/preferences";
function source(provider: string, uuid: string, name: string) {
  const compact = uuid.replaceAll("-", "");
  if (provider === "proxy") return `/api/skin/${uuid}`;
  if (provider === "mc-heads")
    return `https://mc-heads.net/avatar/${encodeURIComponent(name || compact)}/64`;
  if (provider === "minotar")
    return `https://minotar.net/avatar/${encodeURIComponent(name || compact)}/64`;
  return `https://crafatar.com/avatars/${compact}?size=64&overlay`;
}
export function PlayerHead({
  uuid,
  name,
  large = false,
}: {
  uuid: string;
  name: string;
  large?: boolean;
}) {
  const { skinProvider } = usePreferences(),
    [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uuid, name, skinProvider]);
  const unavailable =
    skinProvider === "disabled" || failed || name.startsWith(".");
  return (
    <span
      className={`player-head ${large ? "large" : ""}`}
      title={
        unavailable ? "Local pixel head" : `${name} skin via ${skinProvider}`
      }
    >
      {!unavailable ? (
        <img
          src={source(skinProvider, uuid, name)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <svg
          className="pixel-fallback"
          viewBox="0 0 8 8"
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          <path d="M0 0h8v8H0Z" fill="var(--earth-left)" />
          <path d="M0 0h8v3H0Z" fill="var(--pixel-hair)" />
          <path d="M1 3h6v4H1Z" fill="var(--pixel-skin)" />
          <path d="M1 4h2v1H1ZM5 4h2v1H5Z" fill="var(--pixel-eye)" />
          <path d="M3 6h2v1H3Z" fill="var(--earth-right)" />
        </svg>
      )}
      <span className="sr-only">
        {name}
        {copy._head_5fa07}
      </span>
    </span>
  );
}
