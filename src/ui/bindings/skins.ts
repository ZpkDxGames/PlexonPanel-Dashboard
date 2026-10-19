/** Pure, bounded identities shared by avatar rendering and the same-origin proxy. */
export type SkinProvider =
  "proxy" | "crafatar" | "mc-heads" | "minotar" | "disabled";
export const validUsername = (s: string) => /^[A-Za-z0-9_]{1,16}$/.test(s);
export const validTexture = (s: string) => /^[0-9a-f]{56,64}$/i.test(s);
export const validUuid = (s: string) =>
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(
    s,
  );
export const isOfflineUuid = (s: string) =>
  validUuid(s) && s.replaceAll("-", "")[12].toLowerCase() === "3";
export function skinProxyTargets(
  identity: string,
  name = "",
  texture = "",
  size = 64,
): string[] {
  const clean = identity.replaceAll("-", "").toLowerCase(),
    username = validUsername(identity) ? identity : name,
    hash = texture || (validTexture(identity) ? identity : ""),
    targets: string[] = [];
  if (hash)
    targets.push(`https://mc-heads.net/avatar/${hash.toLowerCase()}/${size}`);
  if (validUuid(identity) && !isOfflineUuid(identity))
    targets.push(`https://crafatar.com/avatars/${clean}?size=${size}&overlay`);
  const fallback = username || (validUuid(identity) ? clean : "");
  if (fallback)
    targets.push(
      `https://mc-heads.net/avatar/${encodeURIComponent(fallback)}/${size}`,
      `https://minotar.net/helm/${encodeURIComponent(fallback)}/${size}`,
    );
  return [...new Set(targets)];
}
export function skinCandidates({
  uuid,
  name,
  skinTexture,
  provider,
  size = 20,
}: {
  uuid: string;
  name: string;
  skinTexture?: string | null;
  provider: SkinProvider;
  size?: number;
}): string[] {
  if (provider === "disabled") return [];
  const n = validUsername(name) ? name : "",
    u = validUuid(uuid) ? uuid : "",
    hash =
      skinTexture && validTexture(skinTexture) ? skinTexture.toLowerCase() : "",
    dimension = Math.max(
      8,
      Math.min(256, Math.round(Number.isFinite(size) ? size : 20)),
    ),
    offline = isOfflineUuid(uuid),
    candidates: string[] = [],
    proxy = (id: string) =>
      `/api/skins/${encodeURIComponent(id)}?${new URLSearchParams({ ...(n ? { name: n } : {}), size: String(dimension) })}`,
    heads = (id: string) =>
      `https://mc-heads.net/avatar/${encodeURIComponent(id)}/${dimension}`;
  if (hash) candidates.push(provider === "proxy" ? proxy(hash) : heads(hash));
  const identity = offline && n ? n : u || n;
  if (provider === "proxy" && identity) candidates.push(proxy(identity));
  if (provider === "crafatar") {
    if (u && !offline)
      candidates.push(
        `https://crafatar.com/avatars/${u}?size=${dimension}&overlay`,
      );
    if (n) candidates.push(heads(n));
  }
  if (provider === "mc-heads") {
    if (identity) candidates.push(heads(identity));
    if (n) candidates.push(heads(n));
  }
  if (provider === "minotar" && (n || u))
    candidates.push(
      `https://minotar.net/helm/${encodeURIComponent(n || u)}/${dimension}`,
    );
  if (n) candidates.push(proxy(n));
  return [...new Set(candidates)];
}
