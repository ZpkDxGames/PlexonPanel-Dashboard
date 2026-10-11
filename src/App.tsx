import { lazy, Suspense, useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import { routeFromHash, type RouteName } from "./router";

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
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => {
    const update = () => setRoute(routeFromHash());
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  const View = views[route];
  return <Shell route={route}><Suspense fallback={<div className="route-skeleton" aria-label="Loading workspace" />}><View /></Suspense></Shell>;
}
