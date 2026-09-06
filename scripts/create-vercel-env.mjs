import { access, chmod, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const usage = `Create the one-variable Vercel import file for PlexonPanel.

Usage:
  npm run env:vercel -- \\
    --relay-url https://YOUR-RELAY.workers.dev \\
    [--output .env.vercel] [--force]

The relay URL is public. Firebase and server-side Vercel credentials are not used.`;

function parseArguments(argumentsList) {
  const parsed = { relayUrl: "", output: ".env.vercel", force: false, help: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--force") parsed.force = true;
    else if (argument === "--help" || argument === "-h") parsed.help = true;
    else if (argument === "--relay-url" || argument === "--output") {
      const value = argumentsList[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      if (argument === "--relay-url") parsed.relayUrl = value;
      else parsed.output = value;
      index += 1;
    } else throw new Error(`Unknown option: ${argument}`);
  }
  return parsed;
}

function normalizeRelayUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("--relay-url must be an absolute HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
      || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("--relay-url must be a clean HTTPS origin without credentials, path, query, or fragment");
  }
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  return url.toString().replace(/\/$/, "");
}

async function exists(path) {
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
  if (!options.relayUrl) throw new Error("--relay-url is required.\n\n" + usage);
  const outputPath = resolve(options.output);
  if (!options.force && await exists(outputPath)) {
    throw new Error("Refusing to overwrite an existing output; pass --force to replace it");
  }
  const relayUrl = normalizeRelayUrl(options.relayUrl);
  const contents = [
    "# Import into Vercel for PlexonPanel rc.2.",
    `NEXT_PUBLIC_PLEXON_RELAY_URL=${JSON.stringify(relayUrl)}`,
    "",
  ].join("\n");
  await writeFile(outputPath, contents, { encoding: "utf8", mode: 0o600 });
  await chmod(outputPath, 0o600);
  console.log(`Created ${outputPath}. No secret or Firebase credential is required.`);
}

main().catch((error) => {
  console.error(`Environment generation failed: ${error.message}`);
  process.exitCode = 1;
});
