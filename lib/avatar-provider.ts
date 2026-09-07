export type PlayerHeadSize = 32 | 40 | 64;

export type AvatarProvider = {
  template: string;
  origin: string;
  hasSizePlaceholder: boolean;
};

const UUID_DASHED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_PLAIN = /^[0-9a-f]{32}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
const ALLOWED_SIZES = new Set<PlayerHeadSize>([32, 40, 64]);

function count(value: string, token: string): number {
  return value.split(token).length - 1;
}

function loopback(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function normalizePlayerUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (UUID_PLAIN.test(trimmed)) return trimmed.toLowerCase();
  if (!UUID_DASHED.test(trimmed)) return null;
  return trimmed.replaceAll("-", "").toLowerCase();
}

export function createAvatarProvider(
  value: unknown,
  options: { production?: boolean } = {},
): AvatarProvider | null {
  if (typeof value !== "string") return null;
  const template = value.trim();
  if (!template || template.length > 2048 || CONTROL.test(template)) return null;
  if (template.startsWith("//")) return null;
  if (count(template, "{uuid}") !== 1 || count(template, "{size}") > 1) return null;

  const placeholders = template.match(/\{[^{}]*\}/g) ?? [];
  if (placeholders.some((token) => token !== "{uuid}" && token !== "{size}")) {
    return null;
  }
  const stripped = template.replace("{uuid}", "0".repeat(32)).replace("{size}", "40");
  if (stripped.includes("{") || stripped.includes("}")) return null;

  try {
    const url = new URL(stripped);
    const production = options.production ?? process.env.NODE_ENV === "production";
    if (url.username || url.password || url.hash) return null;
    if (url.protocol !== "https:") {
      if (production || url.protocol !== "http:" || !loopback(url.hostname)) return null;
    }
    return {
      template,
      origin: url.origin,
      hasSizePlaceholder: template.includes("{size}"),
    };
  } catch {
    return null;
  }
}

export function buildPlayerHeadUrl(
  provider: AvatarProvider | null,
  uuid: unknown,
  size: PlayerHeadSize,
): string | null {
  if (!provider || !ALLOWED_SIZES.has(size)) return null;
  const canonical = normalizePlayerUuid(uuid);
  if (!canonical) return null;
  try {
    const rendered = provider.template
      .replace("{uuid}", canonical)
      .replace("{size}", String(size));
    const url = new URL(rendered);
    if (url.origin !== provider.origin || url.username || url.password || url.hash) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function avatarCspOrigin(
  value: unknown,
  production = process.env.NODE_ENV === "production",
): string | null {
  return createAvatarProvider(value, { production })?.origin ?? null;
}
