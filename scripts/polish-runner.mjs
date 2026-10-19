import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
export async function runPolish(polishChecks) {
  const out = process.env.EVIDENCE_DIR ?? "../evidence-v53",
    base = "http://127.0.0.1:4182";
  await fs.mkdir(out + "/states", { recursive: true });
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
    { stdio: "ignore" },
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
      out + "/polish-v53-receipt.json",
      JSON.stringify(receipt, null, 2),
    );
    console.log(
      "PASS v5.3 selected signals, shared workbench, player events, selectors and persistence",
    );
  } finally {
    await browser?.close();
    server.kill();
  }
}
