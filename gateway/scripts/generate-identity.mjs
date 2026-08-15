import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");

process.stdout.write(`${JSON.stringify({
  GATEWAY_ED25519_PRIVATE_KEY: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  gatewayPublicKey: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
}, null, 2)}\n`);
