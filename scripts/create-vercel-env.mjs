import { randomBytes } from "node:crypto";
import { access, chmod, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const usage = `Create a Vercel-importable environment file without printing secrets.

Usage:
  npm run env:vercel -- \\
    --service-account /secure/path/firebase-adminsdk.json \\
    --web-config /secure/path/firebase-web-config.json \\
    [--gateway-url https://gateway.example.com] \\
    [--gateway-audience plexonpanel-gateway] \\
    [--output .env.vercel] [--force]

The Web config file must be JSON containing apiKey, authDomain, projectId,
storageBucket, messagingSenderId, and appId. measurementId is optional. Secret
values are read only from the service-account file or generated locally; never
pass them as arguments.`;

function parseArguments(argv) {
  const parsed = {
    serviceAccount: "",
    webConfig: "",
    gatewayUrl: "",
    gatewayAudience: "",
    output: ".env.vercel",
    force: false,
    help: false,
  };

  const valueOptions = new Map([
    ["--service-account", "serviceAccount"],
    ["--web-config", "webConfig"],
    ["--gateway-url", "gatewayUrl"],
    ["--gateway-audience", "gatewayAudience"],
    ["--output", "output"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--force") {
      parsed.force = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      parsed.help = true;
      continue;
    }

    const property = valueOptions.get(argument);
    if (!property) throw new Error(`Unknown option: ${argument}`);

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${argument}`);
    }

    parsed[property] = value;
    index += 1;
  }

  return parsed;
}

async function readJson(path, label) {
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch {
    throw new Error(`Could not read the ${label} file at ${path}`);
  }

  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`The ${label} file is not valid JSON: ${path}`);
  }
}

function requireString(record, key, label) {
  const value = record?.[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is missing the required field ${key}`);
  }
  return value.trim();
}

function optionalString(record, key, label) {
  const value = record?.[key];
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    throw new Error(`${label} field ${key} must be a string when provided`);
  }
  return value.trim();
}

function normalizeGatewayUrl(value) {
  if (!value) return "";

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("--gateway-url must be an absolute HTTPS URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("--gateway-url must use HTTPS");
  }

  return url.toString().replace(/\/$/, "");
}

function dotenvLine(key, value) {
  return `${key}=${JSON.stringify(value)}`;
}

async function outputExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    return;
  }

  if (!options.serviceAccount || !options.webConfig) {
    throw new Error("Both --service-account and --web-config are required.\n\n" + usage);
  }

  const serviceAccountPath = resolve(options.serviceAccount);
  const webConfigPath = resolve(options.webConfig);
  const outputPath = resolve(options.output);

  if (!options.force && (await outputExists(outputPath))) {
    throw new Error(`Refusing to overwrite ${outputPath}; pass --force to replace it`);
  }

  const serviceAccount = await readJson(serviceAccountPath, "service-account");
  const rawWebConfig = await readJson(webConfigPath, "Firebase Web configuration");
  const webConfig = rawWebConfig.firebaseConfig ?? rawWebConfig;

  const adminProjectId = requireString(serviceAccount, "project_id", "Service account");
  const adminClientEmail = requireString(serviceAccount, "client_email", "Service account");
  const adminPrivateKey = requireString(serviceAccount, "private_key", "Service account");

  if (
    !adminPrivateKey.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !adminPrivateKey.includes("-----END PRIVATE KEY-----")
  ) {
    throw new Error("The service-account private_key does not have the expected PEM format");
  }

  const client = {
    apiKey: requireString(webConfig, "apiKey", "Firebase Web configuration"),
    authDomain: requireString(webConfig, "authDomain", "Firebase Web configuration"),
    projectId: requireString(webConfig, "projectId", "Firebase Web configuration"),
    storageBucket: requireString(webConfig, "storageBucket", "Firebase Web configuration"),
    messagingSenderId: requireString(
      webConfig,
      "messagingSenderId",
      "Firebase Web configuration",
    ),
    appId: requireString(webConfig, "appId", "Firebase Web configuration"),
    measurementId: optionalString(
      webConfig,
      "measurementId",
      "Firebase Web configuration",
    ),
  };

  if (client.projectId !== adminProjectId) {
    throw new Error(
      "The Firebase Web configuration and service account belong to different projects",
    );
  }

  const lines = [
    "# Generated locally for Vercel import. Do not commit, share, or upload with source.",
    dotenvLine("NEXT_PUBLIC_FIREBASE_API_KEY", client.apiKey),
    dotenvLine("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", client.authDomain),
    dotenvLine("NEXT_PUBLIC_FIREBASE_PROJECT_ID", client.projectId),
    dotenvLine("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", client.storageBucket),
    dotenvLine("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", client.messagingSenderId),
    dotenvLine("NEXT_PUBLIC_FIREBASE_APP_ID", client.appId),
  ];

  if (client.measurementId) {
    lines.push(dotenvLine("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", client.measurementId));
  }

  const gatewayUrl = normalizeGatewayUrl(options.gatewayUrl);
  if (gatewayUrl) lines.push(dotenvLine("NEXT_PUBLIC_PLEXON_GATEWAY_URL", gatewayUrl));

  lines.push(
    dotenvLine("FIREBASE_ADMIN_PROJECT_ID", adminProjectId),
    dotenvLine("FIREBASE_ADMIN_CLIENT_EMAIL", adminClientEmail),
    dotenvLine("FIREBASE_ADMIN_PRIVATE_KEY", adminPrivateKey.replace(/\r\n/g, "\n")),
  );

  if (options.gatewayAudience) {
    lines.push(dotenvLine("PLEXON_GATEWAY_AUDIENCE", options.gatewayAudience.trim()));
  }

  lines.push(
    dotenvLine("PAIRING_CODE_PEPPER", randomBytes(48).toString("base64url")),
    dotenvLine("SESSION_COOKIE_SECRET", randomBytes(64).toString("base64url")),
    "",
  );

  await writeFile(outputPath, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
  await chmod(outputPath, 0o600);

  console.log(`Created ${outputPath} with restrictive permissions.`);
  console.log("Import it into Vercel, verify the keys, then securely delete the local file.");
  console.log("No credential values were printed.");
}

main().catch((error) => {
  console.error(`Environment generation failed: ${error.message}`);
  process.exitCode = 1;
});
