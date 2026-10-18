import { publicRelayOrigin } from "./scripts/relay-env.ts";

/** @type {import('next').NextConfig} */
export default {
  // Only this public origin is exposed. Preserve the installed Vite public variable.
  env: {
    NEXT_PUBLIC_PLEXON_RELAY_URL:
      process.env.NEXT_PUBLIC_PLEXON_RELAY_URL?.trim() ||
      publicRelayOrigin(process.env),
  },
  poweredByHeader: false,
  devIndicators: false,
  reactStrictMode: true,
  experimental: { cpus: 2 },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};
