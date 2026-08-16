import { generateKeyPairSync, randomBytes } from "node:crypto";
import { access, chmod, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const argumentsList = process.argv.slice(2);
const force = argumentsList.includes("--force");
const outputArgument = argumentsList.indexOf("--output");
const publicArgument = argumentsList.indexOf("--public-output");
const secretsArgument = argumentsList.indexOf("--secrets-output");
const outputPath = resolve(outputArgument >= 0 ? argumentsList[outputArgument + 1] : "relay/.dev.vars");
const publicPath = resolve(publicArgument >= 0 ? argumentsList[publicArgument + 1] : "relay/.relay-public.json");
const secretsPath = resolve(secretsArgument >= 0 ? argumentsList[secretsArgument + 1] : "relay/.relay-secrets.json");

if ((outputArgument >= 0 && !argumentsList[outputArgument + 1])
    || (publicArgument >= 0 && !argumentsList[publicArgument + 1])
    || (secretsArgument >= 0 && !argumentsList[secretsArgument + 1])) {
  throw new Error("Missing output path");
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

if (!force && (await exists(outputPath) || await exists(publicPath) || await exists(secretsPath))) {
  throw new Error("Refusing to overwrite an existing relay identity; pass --force to rotate it intentionally");
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateKeyBase64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const publicKeyBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const secrets = {
  PAIRING_CODE_PEPPER: randomBytes(48).toString("base64url"),
  ACCESS_TOKEN_SECRET: randomBytes(64).toString("base64url"),
  GATEWAY_ED25519_PRIVATE_KEY: privateKeyBase64,
  GATEWAY_ED25519_PUBLIC_KEY: publicKeyBase64,
};
const dotenv = [
  "# Local Cloudflare relay secrets. Never commit this file.",
  `PAIRING_CODE_PEPPER=${JSON.stringify(secrets.PAIRING_CODE_PEPPER)}`,
  `ACCESS_TOKEN_SECRET=${JSON.stringify(secrets.ACCESS_TOKEN_SECRET)}`,
  `GATEWAY_ED25519_PRIVATE_KEY=${JSON.stringify(secrets.GATEWAY_ED25519_PRIVATE_KEY)}`,
  `GATEWAY_ED25519_PUBLIC_KEY=${JSON.stringify(secrets.GATEWAY_ED25519_PUBLIC_KEY)}`,
  "",
].join("\n");
await writeFile(outputPath, dotenv, { encoding: "utf8", mode: 0o600 });
await chmod(outputPath, 0o600);
await writeFile(secretsPath, JSON.stringify(secrets, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
await chmod(secretsPath, 0o600);
await writeFile(publicPath, JSON.stringify({ GATEWAY_ED25519_PUBLIC_KEY: publicKeyBase64 }, null, 2) + "\n", {
  encoding: "utf8",
  mode: 0o600,
});
await chmod(publicPath, 0o600);

console.log(`Created protected relay files at ${outputPath}, ${secretsPath}, and ${publicPath}.`);
console.log("No credential value was printed. Copy the public key into wrangler.jsonc and the Paper plugin config.");
