import type { NextConfig } from "next";
import { avatarCspOrigin } from "./lib/avatar-provider";

function relayConnectSources(): string {
  const sources = new Set(["'self'"]);
  const raw = process.env.NEXT_PUBLIC_PLEXON_RELAY_URL?.trim();
  if (raw) {
    try {
      const relay = new URL(raw);
      if (relay.protocol === "https:" || relay.protocol === "http:") {
        sources.add(relay.origin);
        const websocket = new URL(relay.origin);
        websocket.protocol = relay.protocol === "https:" ? "wss:" : "ws:";
        sources.add(websocket.origin);
      }
    } catch {
      // Invalid URLs are rejected by the client; keep the CSP closed here.
    }
  }
  if (process.env.NODE_ENV !== "production") {
    sources.add("http://localhost:*");
    sources.add("ws://localhost:*");
  }
  return [...sources].join(" ");
}

function imageSources(): string {
  const sources = new Set(["'self'", "data:"]);
  const origin = avatarCspOrigin(
    process.env.NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE,
    process.env.NODE_ENV === "production",
  );
  if (origin) sources.add(origin);
  return [...sources].join(" ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src ${imageSources()}; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}; connect-src ${relayConnectSources()};${process.env.NODE_ENV === "production" ? " upgrade-insecure-requests" : ""}`,
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
