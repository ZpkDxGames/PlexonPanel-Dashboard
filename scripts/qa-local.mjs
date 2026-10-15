import { spawn } from "node:child_process";
const target = process.argv[2] ?? "scripts/browser-check.mjs";
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4173"],
  { stdio: "ignore" },
);
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try {
      await fetch("http://127.0.0.1:4173");
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!ready) throw Error("Vite did not become ready.");
  const run = spawn(process.execPath, [target], {
    stdio: "inherit",
    env: { ...process.env, MOZ_DISABLE_CONTENT_SANDBOX: "1" },
  });
  process.exitCode =
    (await new Promise((resolve) => run.on("exit", resolve))) ?? 1;
} finally {
  server.kill("SIGTERM");
}
