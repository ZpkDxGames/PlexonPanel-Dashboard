export function contentSecurityPolicy(
  nonce: string,
  relay: string,
  development = false,
): string {
  let connect = "";
  try {
    const u = new URL(relay);
    if (
      u.origin === relay &&
      (u.protocol === "https:" ||
        (development &&
          u.protocol === "http:" &&
          ["127.0.0.1", "localhost"].includes(u.hostname)))
    )
      connect = ` ${u.origin} ${u.origin.replace(/^http/, "ws")}`;
  } catch {}
  return `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://crafatar.com https://mc-heads.net https://minotar.net; font-src 'self'; connect-src 'self'${connect}${development ? " ws://127.0.0.1:* ws://localhost:*" : ""}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';`;
}
