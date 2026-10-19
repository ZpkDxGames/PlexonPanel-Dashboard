export const routes = ["Fleet", "Overview", "Performance", "Players", "Console", "Backups", "Access", "Settings"] as const;
export type RouteName = (typeof routes)[number];

export const routeLabels: Record<RouteName, string> = {
  Fleet: "Fleet",
  Overview: "Overview",
  Performance: "Performance",
  Players: "Players",
  Console: "Console & chat",
  Backups: "Backups",
  Access: "Access & audit",
  Settings: "Settings",
};

export function routeFromHash(): RouteName {
  const value = location.hash.slice(1).split("?")[0];
  return routes.includes(value as RouteName) ? (value as RouteName) : "Overview";
}

export function navigate(route: RouteName): void {
  if (routeFromHash() === route) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = route;
}
