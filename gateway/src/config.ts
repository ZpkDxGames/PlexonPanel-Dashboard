export interface GatewayConfig {
  port: number;
  firebaseProjectId?: string;
  pairingCodePepper: string;
  internalApiKey: string;
  dashboardTokenSecret: string;
  gatewayPrivateKeyBase64: string;
  allowedDashboardOrigins: Set<string>;
}

function required(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (value.length < 32) {
    throw new Error(`${name} must contain at least 32 characters`);
  }
  return value;
}

function parsePort(): number {
  const value = Number.parseInt(process.env.PORT ?? "8080", 10);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error("PORT must be a valid TCP port");
  }
  return value;
}

function parseOrigins(): Set<string> {
  const values = (process.env.ALLOWED_DASHBOARD_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error("ALLOWED_DASHBOARD_ORIGINS must contain at least one HTTPS dashboard origin");
  }
  const origins = new Set<string>();
  for (const value of values) {
    const url = new URL(value);
    const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.origin !== value || (url.protocol !== "https:" && !local)) {
      throw new Error(`Invalid dashboard origin: ${value}`);
    }
    origins.add(url.origin);
  }
  return origins;
}

export function loadGatewayConfig(): GatewayConfig {
  const firebaseProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  return {
    port: parsePort(),
    ...(firebaseProjectId ? { firebaseProjectId } : {}),
    pairingCodePepper: required("PAIRING_CODE_PEPPER"),
    internalApiKey: required("PLEXON_GATEWAY_INTERNAL_KEY"),
    dashboardTokenSecret: required("GATEWAY_DASHBOARD_TOKEN_SECRET"),
    gatewayPrivateKeyBase64: required("GATEWAY_ED25519_PRIVATE_KEY"),
    allowedDashboardOrigins: parseOrigins(),
  };
}
