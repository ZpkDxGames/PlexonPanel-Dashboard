import { mkdir, readFile, writeFile } from "node:fs/promises";
import ts from "typescript";
await mkdir(".test-dist/lib", { recursive: true });
await mkdir(".test-dist/app", { recursive: true });
for (const file of [
  "lib/control-state.ts",
  "lib/scopes.ts",
  "lib/data-source.ts",
  "lib/browser-store.ts",
  "app/control-views.tsx",
  "app/advanced-views.tsx",
]) {
  const source = await readFile(file, "utf8");
  const output = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: file,
    })
    .outputText.replace(
      /from (["'])(\.{1,2}\/[^"']+)\1/g,
      (all, q, p) => `from ${q}${/\.\w+$/.test(p) ? p : p + ".js"}${q}`,
    );
  await writeFile(`.test-dist/${file.replace(/\.tsx?$/, ".js")}`, output);
}
