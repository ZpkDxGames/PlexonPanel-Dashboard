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
  Worlds: lazy(() => import('./routes/Worlds')),
  Files: lazy(() => import('./routes/Files')),
  Schedules: lazy(() => import('./routes/Schedules')),
  Plugins: lazy(() => import('./routes/Plugins')),
  Logs: lazy(() => import('./routes/Logs')),
};
const Styleguide = lazy(() => import('./routes/Styleguide'));

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
  useEffect(() => {const media=matchMedia('(prefers-color-scheme: dark)');const update=()=>{if(prefs.theme==='system')document.documentElement.dataset.theme=media.matches?'dark':'light';};media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[prefs.theme]);
  useEffect(() => {
    const update = () => setRoute(routeFromHash());
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  const experience = entryExperience(snap, minimumSplashElapsed);
  if (location.hash === '#Styleguide' && import.meta.env.DEV) return <main className="workspace boot"><Suspense fallback={<div className="route-skeleton"/>}><Styleguide/></Suspense></main>;
  if (experience === "splash") return <Splash />;
  if (experience === "pairing") return <PairingGate />;
  const View = views[route];
  return <Shell route={route}><Suspense fallback={<div className="route-skeleton" aria-label="Loading workspace" />}><View /></Suspense></Shell>;
}
