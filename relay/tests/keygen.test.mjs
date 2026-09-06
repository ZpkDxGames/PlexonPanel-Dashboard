import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const keygen = join(projectRoot, "relay", "scripts", "generate-secrets.mjs");

function run(argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [keygen, ...argumentsList], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

test("generates matching protected relay bindings without printing them", async () => {
  const directory = await mkdtemp(join(tmpdir(), "plexonpanel-relay-keygen-"));
  const developmentPath = join(directory, ".dev.vars");
  const secretsPath = join(directory, ".relay-secrets.json");
  const publicPath = join(directory, ".relay-public.json");
  const result = await run([
    "--output", developmentPath,
    "--secrets-output", secretsPath,
    "--public-output", publicPath,
  ]);
  assert.equal(result.code, 0, result.stderr);

  const secrets = JSON.parse(await readFile(secretsPath, "utf8"));
  const publicValues = JSON.parse(await readFile(publicPath, "utf8"));
  assert.deepEqual(Object.keys(secrets).sort(), [
    "ACCESS_TOKEN_SECRET",
    "GATEWAY_ED25519_PRIVATE_KEY",
    "GATEWAY_ED25519_PUBLIC_KEY",
    "PAIRING_CODE_PEPPER",
  ]);
  assert.equal(secrets.GATEWAY_ED25519_PUBLIC_KEY, publicValues.GATEWAY_ED25519_PUBLIC_KEY);

  const privateKey = createPrivateKey({
    key: Buffer.from(secrets.GATEWAY_ED25519_PRIVATE_KEY, "base64"),
    format: "der",
    type: "pkcs8",
  });
  const derivedPublic = createPublicKey(privateKey).export({ format: "der", type: "spki" }).toString("base64");
  assert.equal(derivedPublic, publicValues.GATEWAY_ED25519_PUBLIC_KEY);
  assert.doesNotMatch(result.stdout, new RegExp(secrets.ACCESS_TOKEN_SECRET));
  assert.doesNotMatch(result.stdout, new RegExp(secrets.PAIRING_CODE_PEPPER));
  assert.match(await readFile(developmentPath, "utf8"), /GATEWAY_ED25519_PUBLIC_KEY=/);

  if (process.platform !== "win32") {
    for (const path of [developmentPath, secretsPath, publicPath]) {
      assert.equal((await stat(path)).mode & 0o777, 0o600);
    }
  }

  const overwrite = await run([
    "--output", developmentPath,
    "--secrets-output", secretsPath,
    "--public-output", publicPath,
  ]);
  assert.equal(overwrite.code, 1);
  assert.match(overwrite.stderr, /Refusing to overwrite/);
});
