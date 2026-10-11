import { lazy, Suspense, useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import { PairingGate } from "./components/PairingGate";
import { Splash } from "./components/Splash";
import { useSession } from "./hooks";
import { routeFromHash, type RouteName } from "./router";
import { entryExperience } from "./entry-state";
import { usePreferences } from "./store/preferences";

const views: Record<RouteName, React.LazyExoticComponent<React.ComponentType>> = {
  Fleet: lazy(() => import("./routes/Fleet")),
  Overview: lazy(() => import("./routes/Overview")),
  Performance: lazy(() => import("./routes/Performance")),
  Players: lazy(() => import("./routes/Players")),
  Console: lazy(() => import("./routes/Console")),
  Backups: lazy(() => import("./routes/Backups")),
  Access: lazy(() => import("./routes/Access")),
  Settings: lazy(() => import("./routes/Settings")),
};

export default function App() {
  const snap = useSession();
  const prefs = usePreferences();
  const [route, setRoute] = useState(routeFromHash);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinimumSplashElapsed(true), 2800);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const resolved = prefs.theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : prefs.theme;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.density = prefs.density;
    document.documentElement.dataset.reduceMotion = String(prefs.reduceMotion);
  }, [prefs]);
  useEffect(() => {
    const update = () => setRoute(routeFromHash());
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  const experience = entryExperience(snap, minimumSplashElapsed);
  if (experience === "splash") return <Splash />;
  if (experience === "pairing") return <PairingGate />;
  const View = views[route];
  return <Shell route={route}><Suspense fallback={<div className="route-skeleton" aria-label="Loading workspace" />}><View /></Suspense></Shell>;
}
