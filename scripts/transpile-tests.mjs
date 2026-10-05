import { mkdir, readFile, writeFile } from "node:fs/promises";
import ts from "typescript";
await mkdir(".test-dist/lib", { recursive: true });
await mkdir(".test-dist/app", { recursive: true });
await mkdir(".test-dist/components", { recursive: true });
for (const file of [
  "lib/control-state.ts",
  "lib/dashboard-version.ts",
  "lib/build-identity.ts",
  "lib/activity-history.ts",
  "lib/durable-activity.ts",
  "lib/display-cadence.ts",
  "lib/device-grant.ts",
  "lib/scopes.ts",
  "lib/fleet-contract.ts",
  "lib/fleet-feed.ts",
  "lib/fleet-model.ts",
  "lib/connection-state.ts",
  "lib/telemetry-freshness.ts",
  "lib/telemetry-clock.ts",
  "lib/data-source.ts",
  "lib/browser-store.ts",
  "lib/lifecycle-state.ts",
  "lib/operation-messages.ts",
  "lib/ui-preferences.ts",
  "lib/avatar-provider.ts",
  "lib/backup-readiness.ts",
  "lib/chart-geometry.ts",
  "components/ui-preferences-provider.tsx",
  "components/player-head.tsx",
  "components/select.tsx",
  "app/control-views.tsx",
  "app/fleet-overview.tsx",
  "app/connection-summary.tsx",
  "app/telemetry-freshness.tsx",
  "app/communication-views.tsx",
  "app/console-view-3-0.tsx",
  "app/players-view-2-3.tsx",
  "app/activity-history-modal.tsx",
  "app/players-view-3-0.tsx",
  "app/management-views-2-1.tsx",
  "app/advanced-views.tsx",
  "app/dashboard.tsx",
  "app/overview-view-3-0.tsx",
  "app/infrastructure-views-2-1.tsx",
  "app/monitoring-views-2-1.tsx",
  "app/server-view-2-1.tsx",
  "app/backups-view.tsx",
  "app/backup-destination.tsx",
  "app/settings-view-2-1.tsx",
  "app/client-preferences.tsx",
  "app/preferences-dialog.tsx",
  "app/configuration-view.tsx",
  "app/control-plane-build-panel.tsx",
  "lib/management-data.ts",

]) {
  let source = await readFile(file, "utf8");
  // Render the real lazy workspace components in the DOM harness without the Next chunk loader.
  if (file === "app/dashboard.tsx") source = source.replace('"next/dynamic"', '"../../tests/support/dynamic.mjs"');
  if (file === "components/select.tsx") source = source.replace('import styles from "./select.module.css";', 'const styles = { trigger: "cr-select", menu: "cr-select-menu", option: "cr-select-option" };');
  source = source.replace(/import\((["'])(\.{1,2}\/[^"']+)\1\)/g,
    (all, q, p) => `import(${q}${/\.\w+$/.test(p) ? p : p + ".js"}${q})`);
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
