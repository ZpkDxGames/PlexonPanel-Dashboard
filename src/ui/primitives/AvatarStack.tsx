import { useState, useEffect } from "react";
import { usePreferences, type Preferences } from "../../store/preferences";
export function PlayerHead({
  provider,
  uuid,
  name,
  size = 32,
}: {
  provider: Preferences["skinProvider"];
  uuid: string;
  name: string;
  size?: number;
}) {
  const [failed, set] = useState(false);
  useEffect(() => set(false), [uuid, provider]);
  const id = encodeURIComponent(uuid),
    src = {
      proxy: `/api/skins/${id}`,
      crafatar: `https://crafatar.com/avatars/${id}?size=64&overlay`,
      "mc-heads": `https://mc-heads.net/avatar/${id}/64`,
      minotar: `https://minotar.net/helm/${id}/64.png`,
      disabled: "",
    }[provider];
  return failed || !src ? (
    <span
      className="player-head initial"
      style={{ width: size, height: size }}
      aria-label={name}
    >
      {name.slice(0, 1)}
    </span>
  ) : (
    <img
      className="player-head"
      src={src}
      alt={`${name} head`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => set(true)}
    />
  );
}
export function AvatarStack({
  players,
  max = 6,
  size = 26,
  emptyLabel = "Nobody online",
}: {
  players: { uuid: string; name: string }[];
  max?: number;
  size?: number;
  emptyLabel?: string;
}) {
  const p = usePreferences();
  return (
    <div className="flex items-center">
      {players.slice(0, max).map((v, i) => (
        <span
          className="avatar"
          key={v.uuid}
          title={v.name}
          style={{
            width: size,
            height: size,
            marginLeft: i ? -8 : 0,
            zIndex: max - i,
          }}
        >
          <PlayerHead
            provider={p.skinProvider}
            uuid={v.uuid}
            name={v.name}
            size={size}
          />
        </span>
      ))}
      {players.length > max && (
        <span className="source-chip ml-2">+{players.length - max}</span>
      )}
      {!players.length && (
        <span className="text-secondary text-xs">{emptyLabel}</span>
      )}
    </div>
  );
}
