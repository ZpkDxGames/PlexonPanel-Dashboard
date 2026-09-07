"use client";

import { useMemo, useState } from "react";
import {
  buildPlayerHeadUrl,
  createAvatarProvider,
  normalizePlayerUuid,
  type PlayerHeadSize,
} from "../lib/avatar-provider";
import { useUiPreferences } from "./ui-preferences-provider";

const MAX_ROSTER = 512;
const urlMemo = new Map<string, string | null>();
const failed = new Set<string>();
const provider = createAvatarProvider(
  process.env.NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE,
  { production: process.env.NODE_ENV === "production" },
);

function boundedSet<T>(map: Map<string, T>, key: string, value: T) {
  if (!map.has(key) && map.size >= MAX_ROSTER) {
    const oldest = map.keys().next().value as string | undefined;
    if (oldest) map.delete(oldest);
  }
  map.set(key, value);
}

function initials(name: string): string {
  const glyphs = Array.from(name.trim());
  return (glyphs.length ? glyphs.slice(0, 2).join("") : "?").toUpperCase();
}

function palette(name: string): number {
  let hash = 0;
  for (const char of Array.from(name)) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) | 0;
  return Math.abs(hash) % 6;
}

export function clearPlayerHeadSessionCache() {
  urlMemo.clear();
  failed.clear();
}

export function PlayerHead({
  uuid,
  name,
  size,
  online = true,
}: {
  uuid: string;
  name: string;
  size: PlayerHeadSize;
  online?: boolean;
}) {
  const { preferences, resolved, avatarProviderAvailable } = useUiPreferences();
  const [loadFailed, setLoadFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const canonical = normalizePlayerUuid(uuid);
  const failureKey = canonical ? `${provider?.origin ?? "none"}:${canonical}:${size}` : "invalid";
  const url = useMemo(() => {
    if (!preferences.playerHeads || !avatarProviderAvailable || !provider || !canonical) {
      return null;
    }
    const cacheKey = `${provider.template}:${canonical}:${size}`;
    if (!urlMemo.has(cacheKey)) {
      boundedSet(urlMemo, cacheKey, buildPlayerHeadUrl(provider, canonical, size));
    }
    return urlMemo.get(cacheKey) ?? null;
  }, [avatarProviderAvailable, canonical, preferences.playerHeads, size]);
  const showImage = Boolean(url && !loadFailed && !failed.has(failureKey));

  return (
    <span
      className={`cr23-player-head cr23-player-head-${palette(name)}${online ? " online" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="cr23-player-head-fallback">{initials(name)}</span>
      {showImage && (
        <img
          src={url ?? undefined}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={loaded ? "loaded" : ""}
          onLoad={() => setLoaded(true)}
          onError={() => {
            failed.add(failureKey);
            setLoadFailed(true);
          }}
          style={{
            transitionDuration: resolved.motion === "full" ? "150ms" : "0ms",
          }}
        />
      )}
    </span>
  );
}
