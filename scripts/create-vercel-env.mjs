import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } from "node:crypto";
import { access, chmod, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const usage = `Create coordinated Vercel and Cloud Run environment files without printing secrets.

Usage:
  npm run env:vercel -- \\
    --service-account /secure/path/firebase-adminsdk.json \\
    --web-config /secure/path/firebase-web-config.json \\
    [--gateway-url https://gateway.example.com] \\
    [--dashboard-origin https://panel.example.com] \\
    [--output .env.vercel] \\
    [--gateway-output .env.gateway] [--force]

The service-account file is used only to verify the Firebase project. Its email
and private key are never copied into either output. Cloud Run uses Application
Default Credentials from its runtime service account.`;

function parseArguments(argv) {
  const parsed = {
    serviceAccount: "",
    webConfig: "",
    gatewayUrl: "",
    dashboardOrigin: "",
    output: ".env.vercel",
    gatewayOutput: ".env.gateway",
    force: false,
    help: false,
  };
  const valueOptions = new Map([
    ["--service-account", "serviceAccount"],
    ["--web-config", "webConfig"],
    ["--gateway-url", "gatewayUrl"],
    ["--dashboard-origin", "dashboardOrigin"],
    ["--output", "output"],
    ["--gateway-output", "gatewayOutput"],
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
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
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
  if (typeof value !== "string") throw new Error(`${label} field ${key} must be a string when provided`);
  return value.trim();
}

function normalizeHttpsUrl(value, option, allowEmpty) {
  if (!value && allowEmpty) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${option} must be an absolute HTTPS URL`);
  }
  if (url.protocol !== "https:") throw new Error(`${option} must use HTTPS`);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return url.toString().replace(/\/$/, "");
}

function normalizeOrigin(value) {
  if (!value) return "";
  const normalized = normalizeHttpsUrl(value, "--dashboard-origin", false);
  const url = new URL(normalized);
  if (url.origin !== normalized) throw new Error("--dashboard-origin must not contain a path");
  return url.origin;
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

async function readExistingEnvironment(path) {
  if (!await outputExists(path)) return {};
  const source = await readFile(path, "utf8");
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    try {
      const value = JSON.parse(line.slice(separator + 1));
      if (typeof value === "string") values[key] = value;
    } catch {
      throw new Error(`Existing environment file contains an invalid value for ${key}`);
    }
  }
  return values;
}

function existingSecret(values, key, fallback) {
  const value = values[key];
  return typeof value === "string" && value.length >= 32 ? value : fallback;
}

async function writeProtected(path, lines) {
  await writeFile(path, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600);
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

  const outputPath = resolve(options.output);
  const gatewayOutputPath = resolve(options.gatewayOutput);
  if (outputPath === gatewayOutputPath) throw new Error("Vercel and gateway outputs must use different paths");
  const vercelExists = await outputExists(outputPath);
  const gatewayExists = await outputExists(gatewayOutputPath);
  if (!options.force && (vercelExists || gatewayExists)) {
    throw new Error("Refusing to overwrite an existing output; pass --force to replace both files");
  }
  const existingVercel = options.force ? await readExistingEnvironment(outputPath) : {};
  const existingGateway = options.force ? await readExistingEnvironment(gatewayOutputPath) : {};

  const serviceAccount = await readJson(resolve(options.serviceAccount), "service-account");
  const rawWebConfig = await readJson(resolve(options.webConfig), "Firebase Web configuration");
  const webConfig = rawWebConfig.firebaseConfig ?? rawWebConfig;
  const adminProjectId = requireString(serviceAccount, "project_id", "Service account");
  const client = {
    apiKey: requireString(webConfig, "apiKey", "Firebase Web configuration"),
    authDomain: requireString(webConfig, "authDomain", "Firebase Web configuration"),
    projectId: requireString(webConfig, "projectId", "Firebase Web configuration"),
    storageBucket: requireString(webConfig, "storageBucket", "Firebase Web configuration"),
    messagingSenderId: requireString(webConfig, "messagingSenderId", "Firebase Web configuration"),
    appId: requireString(webConfig, "appId", "Firebase Web configuration"),
    measurementId: optionalString(webConfig, "measurementId", "Firebase Web configuration"),
  };
  if (client.projectId !== adminProjectId) {
    throw new Error("The Firebase Web configuration and service account belong to different projects");
  }

  const gatewayUrl = normalizeHttpsUrl(options.gatewayUrl, "--gateway-url", true);
  const dashboardOrigin = normalizeOrigin(options.dashboardOrigin);
  const generatedIdentity = generateKeyPairSync("ed25519");
  const generatedPrivateKey = generatedIdentity.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  const generatedPublicKey = generatedIdentity.publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const internalKey = existingSecret(existingGateway, "PLEXON_GATEWAY_INTERNAL_KEY", randomBytes(48).toString("base64url"));
  const dashboardTokenSecret = existingSecret(existingGateway, "GATEWAY_DASHBOARD_TOKEN_SECRET", randomBytes(48).toString("base64url"));
  const pairingPepper = existingSecret(existingGateway, "PAIRING_CODE_PEPPER", randomBytes(48).toString("base64url"));
  const sessionSecret = existingSecret(existingVercel, "SESSION_COOKIE_SECRET", randomBytes(64).toString("base64url"));
  const gatewayPrivateKey = existingSecret(existingGateway, "GATEWAY_ED25519_PRIVATE_KEY", generatedPrivateKey);
  let gatewayPublicKey = generatedPublicKey;
  try {
    const privateKey = createPrivateKey({ key: Buffer.from(gatewayPrivateKey, "base64"), format: "der", type: "pkcs8" });
    if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("not Ed25519");
    gatewayPublicKey = createPublicKey(privateKey).export({ format: "der", type: "spki" }).toString("base64");
  } catch {
    throw new Error("Existing GATEWAY_ED25519_PRIVATE_KEY is not a valid Ed25519 key");
  }

  const vercelLines = [
    "# Vercel import for PlexonPanel protocol v2. Never commit this file.",
    dotenvLine("NEXT_PUBLIC_PLEXON_GATEWAY_URL", gatewayUrl),
    dotenvLine("PLEXON_GATEWAY_HTTP_URL", gatewayUrl),
    dotenvLine("PLEXON_GATEWAY_INTERNAL_KEY", internalKey),
    dotenvLine("GATEWAY_DASHBOARD_TOKEN_SECRET", dashboardTokenSecret),
    dotenvLine("SESSION_COOKIE_SECRET", sessionSecret),
    dotenvLine("NEXT_PUBLIC_FIREBASE_API_KEY", client.apiKey),
    dotenvLine("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", client.authDomain),
    dotenvLine("NEXT_PUBLIC_FIREBASE_PROJECT_ID", client.projectId),
    dotenvLine("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", client.storageBucket),
    dotenvLine("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", client.messagingSenderId),
    dotenvLine("NEXT_PUBLIC_FIREBASE_APP_ID", client.appId),
    ...(client.measurementId ? [dotenvLine("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", client.measurementId)] : []),
    "",
  ];
  const gatewayLines = [
    "# Cloud Run gateway secrets/config for PlexonPanel protocol v2. Never commit this file.",
    dotenvLine("FIREBASE_ADMIN_PROJECT_ID", adminProjectId),
    dotenvLine("PAIRING_CODE_PEPPER", pairingPepper),
    dotenvLine("PLEXON_GATEWAY_INTERNAL_KEY", internalKey),
    dotenvLine("GATEWAY_DASHBOARD_TOKEN_SECRET", dashboardTokenSecret),
    dotenvLine("GATEWAY_ED25519_PRIVATE_KEY", gatewayPrivateKey),
    dotenvLine("GATEWAY_ED25519_PUBLIC_KEY", gatewayPublicKey),
    dotenvLine("ALLOWED_DASHBOARD_ORIGINS", dashboardOrigin),
    "",
  ];

  await writeProtected(outputPath, vercelLines);
  await writeProtected(gatewayOutputPath, gatewayLines);
  console.log(`Created ${outputPath} and ${gatewayOutputPath} with restrictive permissions.`);
  console.log("The gateway public key is in the gateway file for config.yml; no credential value was printed.");
  if (!gatewayUrl || !dashboardOrigin) {
    console.log("Complete the blank deployment URL/origin before importing the files.");
  }
}

main().catch((error) => {
  console.error(`Environment generation failed: ${error.message}`);
  process.exitCode = 1;
});
