import { mkdir, readFile, writeFile } from "node:fs/promises";
import ts from "typescript";
await mkdir(".test-dist/lib/copy", { recursive: true });
await mkdir(".test-dist/lib", { recursive: true });
await mkdir(".test-dist/app/ui", { recursive: true });
await mkdir(".test-dist/app/charts", { recursive: true });
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
  "lib/clock-diagnostics.ts",
  "lib/telemetry-clock.ts",
  "lib/data-source.ts",
  "lib/browser-store.ts",
  "lib/lifecycle-state.ts",
  "lib/operation-messages.ts",
  "lib/ui-preferences.ts",
  "lib/avatar-provider.ts",
  "lib/backup-readiness.ts",
  "lib/chart-geometry.ts",
  "lib/metric-reports.ts",
  "lib/tick-thresholds.ts",
  "lib/tick-pulse-model.ts",
  "lib/tick-pulse-observations.ts",
  "lib/tick-pulse-window.ts",
  "lib/visible-history.ts",
  "lib/authority-summary.ts",
  "app/charts/tick-pulse.tsx",
  "app/charts/sparkline.tsx",
  "lib/workspace-navigation.ts",
  "components/ui-preferences-provider.tsx",
  "components/player-head.tsx",
  "components/select.tsx",
  "app/control-views.tsx",
  "app/fleet-overview.tsx",
  "app/connection-summary.tsx",
  "app/telemetry-freshness.tsx",
  "app/communication-views.tsx",
  "app/console-view.tsx",
  "app/player-roster.tsx",
  "app/activity-history-modal.tsx",
  "app/players-view.tsx",
  "app/advanced-views.tsx",
  "app/dashboard.tsx",
  "app/shell.tsx",
  "app/workspaces.tsx",
  "app/ui/primitives.tsx",
  "app/ui/workspace.tsx",
  "app/ui/icons.tsx",
  "app/use-session-activity.ts",
  "lib/session-activity.ts",
  "lib/copy/shell.ts",
  "app/use-dashboard-session.ts",
  "app/use-signed-operations.ts",
  "app/use-dirty-leave.ts",
  "app/overview-view.tsx",
  "app/governance-views.tsx",
  "app/performance-view.tsx",
  "app/telemetry-chart.tsx",
  "app/server-view.tsx",
  "app/backups-view.tsx",
  "app/backup-destination.tsx",
  "app/settings-view.tsx",
  "app/client-preferences.tsx",
  "app/preferences-dialog.tsx",
  "app/configuration-view.tsx",
  "app/control-plane-build-panel.tsx",
  "lib/management-data.ts",

]) {
  let source = await readFile(file, "utf8");
  source = source.replace(/^import ["'][^"'\n]+\.css["'];\s*/gm, "");
  // Render the real lazy workspace components in the DOM harness without the Next chunk loader.
  if (["app/dashboard.tsx", "app/shell.tsx", "app/workspaces.tsx"].includes(file)) source = source.replace('"next/dynamic"', '"../../tests/support/dynamic.mjs"');
  if (file === "components/select.tsx") source = source.replace('import styles from "./select.module.css";', 'const styles = { trigger: "ui-select", menu: "ui-select-menu", option: "ui-select-option" };');
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
