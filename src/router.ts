export const workspaceRoutes = [
  "Overview",
  "Console",
  "Players",
  "Performance",
  "Worlds",
  "Backups",
  "Schedules",
  "Logs",
  "Access",
  "Settings",
] as const;

export const routes = ["Fleet", ...workspaceRoutes] as const;
export type RouteName = (typeof routes)[number];
export type WorkspaceRouteName = (typeof workspaceRoutes)[number];

export const routeLabels: Record<RouteName, string> = {
  Fleet: "Fleet",
  Overview: "Overview",
  Performance: "Performance",
  Players: "Players",
  Console: "Console",
  Backups: "Backups",
  Access: "Access & audit",
  Settings: "Settings",
  Worlds: "Worlds",
  Schedules: "Schedules",
  Logs: "Activity",
};

export function routeFromHash(): RouteName {
  const value = location.hash.slice(1).split("?")[0];
  return routes.includes(value as RouteName)
    ? (value as RouteName)
    : "Overview";
}

export function navigate(route: RouteName): void {
  if (
    !window.dispatchEvent(
      new Event("plexon:beforeNavigate", { cancelable: true }),
    )
  )
    return;
  if (routeFromHash() === route)
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = route;
}
