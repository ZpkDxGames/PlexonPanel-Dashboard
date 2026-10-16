import { firefox, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("dist"),
  types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
  };
const server = createServer(async (req, res) => {
  try {
    const path = resolve(
      root,
      "." + new URL(req.url, "http://localhost").pathname,
    );
    if (path !== root && !path.startsWith(root + "/")) throw Error("path");
    const file =
      path === root || path === root + "/" ? root + "/index.html" : path;
    res.setHeader(
      "content-type",
      types[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await firefox.launch();
  const context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route("**/*", (r) =>
    new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
  );
  await page.goto(`${base}/?fixture=healthy#Overview`);
  await expect(
    page.getByRole("main", { name: "Initializing PlexonPanel" }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Connect a server", exact: true })
    .waitFor();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect(page.locator(".fixture-banner")).toHaveCount(0);
  const assets = (await readdir("dist/assets")).filter((f) =>
      f.endsWith(".js"),
    ),
    forbidden = [];
  for (const file of assets) {
    const body = await readFile(`dist/assets/${file}`, "utf8");
    if (/fixture-paper|fixture-device|LumaCraft|makeFixture/.test(body))
      forbidden.push(file);
  }
  expect(forbidden).toEqual([]);
  expect(errors).toEqual([]);
  const build = JSON.parse(await readFile("dist/build.json", "utf8"));
  expect(build.protocolVersion).toBe(3);
  expect(build.commit).toMatch(/^[a-f0-9]{40}$/);
  await mkdir("artifacts/acceptance", { recursive: true });
  await writeFile(
    "artifacts/acceptance/production.json",
    JSON.stringify(
      {
        fixtureExcluded: true,
        unpairedProductionShowsPairing: true,
        forbiddenAssets: forbidden,
        errors,
        build,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: production bundle excludes fixture data; fixture query cannot bypass pairing; build identity retained.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
