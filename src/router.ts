export const routes = [
  "Fleet",
  "Overview",
  "Performance",
  "Players",
  "Console",
  "Backups",
  "Access",
  "Settings",
] as const;
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
  if (typeof location === "undefined") return "Overview";
  return (
    routes.find((route) => location.pathname === `/${route.toLowerCase()}`) ??
    "Overview"
  );
}
let navigator: ((route: RouteName) => void) | undefined;
export function registerNavigator(next: (route: RouteName) => void) {
  navigator = next;
  return () => {
    if (navigator === next) navigator = undefined;
  };
}
export function navigate(route: RouteName): void {
  if (navigator) navigator(route);
  else if (typeof location !== "undefined")
    location.assign(`/${route.toLowerCase()}`);
}
