import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
export const project = fileURLToPath(new URL("..", import.meta.url));
export async function harness(
  run,
  { tag = "v5-browser", port = 4310, production = false, env = {} } = {},
) {
  const output = `${project}/quality/${tag}`;
  mkdirSync(output, { recursive: true });
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      ...(production ? ["start"] : ["dev", "--webpack"]),
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: project,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ...env },
      stdio: ["ignore", openSync(`${output}/server.log`, "w"), "inherit"],
    },
  );
  let browser;
  try {
    const origin = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 240; i++) {
      if (server.exitCode !== null) throw Error("Next exited before readiness");
      try {
        if ((await fetch(origin)).ok) break;
      } catch {}
      if (i === 239) throw Error("Next readiness timeout");
      await new Promise((r) => setTimeout(r, 250));
    }
    browser = await chromium.launch({
      executablePath: process.env.PLEXON_CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    return await run({ browser, origin, output });
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
  }
}
