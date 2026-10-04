"use client";

import { useState } from "react";
import { buildPlayerHeadUrl, createAvatarProvider, resolveAvatarProviderTemplate, type PlayerHeadSize } from "../lib/avatar-provider";
import { useUiPreferences } from "./ui-preferences-provider";

const provider = createAvatarProvider(resolveAvatarProviderTemplate(process.env.NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE),
  { production: process.env.NODE_ENV === "production" });
const failed = new Map<string, number>();
const MAX_FAILURES = 512;
export function clearPlayerHeadSessionCache() { failed.clear(); }
function AvatarImage({ url, size, motion }: { url: string; size: PlayerHeadSize; motion: boolean }) {
  const [status, setStatus] = useState(() => (failed.get(url) ?? 0) > Date.now() ? "failed" : "loading");
  if (status === "failed") return null;
  // The validated template fixes one CSP origin. Avatar requests never use a browser-selected URL.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer"
    className={status === "loaded" ? "loaded" : ""}
    onLoad={() => { failed.delete(url); setStatus("loaded"); }}
    onError={() => {
      if (failed.size >= MAX_FAILURES) failed.delete(failed.keys().next().value!);
      failed.set(url, Date.now() + 60_000); setStatus("failed");
    }} style={{ transitionDuration: motion ? "150ms" : "0ms" }} />;
}

export function PlayerHead({ uuid, name, skinTextureId, size, online = true }: {
  uuid: string; name: string; skinTextureId?: string; size: PlayerHeadSize; online?: boolean;
}) {
  const { preferences, resolved, avatarProviderAvailable } = useUiPreferences();
  const url = preferences.playerHeads && avatarProviderAvailable ? buildPlayerHeadUrl(provider, uuid, size, name, skinTextureId) : null;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) | 0;
  const initials = Array.from(name.trim()).slice(0, 2).join("").toUpperCase() || "?";
  return <span className={`cr23-player-head cr23-player-head-${Math.abs(hash) % 6}${online ? " online" : ""}`}
    style={{ width: size, height: size }} aria-hidden="true">
    <span className="cr23-player-head-fallback">{initials}</span>
    {url && <AvatarImage key={url} url={url} size={size} motion={resolved.motion === "full"} />}
  </span>;
}
