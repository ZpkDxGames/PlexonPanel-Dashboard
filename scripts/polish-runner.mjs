import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
export async function runPolish(
  polishChecks,
  receiptName = "polish-v53-receipt.json",
) {
  const out = process.env.EVIDENCE_DIR ?? "../evidence-v60",
    base = "http://127.0.0.1:4182";
  await fs.mkdir(out + "/states", { recursive: true });
  const log = await fs.open(out + "/polish-development-server.log", "w");
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "-H",
      "127.0.0.1",
      "-p",
      "4182",
    ],
    { stdio: ["ignore", log.fd, log.fd], detached: true },
  );
  let browser;
  try {
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(base + "/pair")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH ?? chromium.executablePath(),
      args: ["--no-sandbox"],
    });
    const receipt = await polishChecks(browser, base, out);
    await fs.writeFile(
      out + "/" + receiptName,
      JSON.stringify(receipt, null, 2),
    );
    console.log(
      "PASS selected signals, workbench, player events, persistence and v6 durability checks",
    );
  } finally {
    await browser?.close();
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
    await log.close();
  }
}
