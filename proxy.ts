import { NextRequest, NextResponse } from "next/server";

function developmentRelaySources() {
  if (process.env.NODE_ENV !== "development") return "";
  const configured = process.env.NEXT_PUBLIC_PLEXON_RELAY_URL;
  if (!configured) return "";
  let relay: URL;
  try {
    relay = new URL(configured);
  } catch {
    return "";
  }
  if (
    relay.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(relay.hostname) ||
    relay.username ||
    relay.password ||
    relay.pathname !== "/" ||
    relay.search ||
    relay.hash
  )
    return "";
  return ` ${relay.origin} ws://${relay.host}`;
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID()),
    headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://crafatar.com https://mc-heads.net https://minotar.net; connect-src 'self' https://tonimserver.ddns.net wss://tonimserver.ddns.net${developmentRelaySources()}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
  headers.set("Content-Security-Policy", csp);
  const r = NextResponse.next({ request: { headers } });
  r.headers.set("Content-Security-Policy", csp);
  r.headers.set("X-Content-Type-Options", "nosniff");
  r.headers.set("Referrer-Policy", "no-referrer");
  r.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  return r;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
