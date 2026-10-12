import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(ts|tsx)$/.test(name)
        ? [path]
        : [];
  });
}

test("dashboard date/time rendering never falls back to the browser timezone", () => {
  const offenders = sourceFiles("src")
    .filter((path) => path !== join("src", "lib", "time.ts"))
    .filter((path) => {
      const source = readFileSync(path, "utf8");
      return /\.toLocale(?:Time|Date)String\s*\(/.test(source);
    });
  assert.deepEqual(
    offenders,
    [],
    `Use src/lib/time.ts so visible timestamps stay in America/Sao_Paulo: ${offenders.join(", ")}`,
  );
});
