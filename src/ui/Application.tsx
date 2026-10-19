"use client";
import { useEffect, useState, lazy, Suspense } from "react";
import { usePathname } from "next/navigation";
import { useControl, session } from "./hooks/useControl";
import { PreferencesBridge } from "./hooks/PreferencesBridge";
import { RouteSkeleton } from "./primitives/Skeleton";
import { AppShell } from "./chrome/AppShell";
import { ReviewProvider } from "./review/ActionReviewModal";
import { PairingGate, PairingContext } from "./pairing/PairingGate";
import { Gallery } from "./development/Galleries";
import { RouteBoundary } from "./RouteBoundary";
const views = {
  fleet: lazy(() => import("./routes/fleet")),
  overview: lazy(() => import("./routes/overview")),
  performance: lazy(() => import("./routes/performance")),
  players: lazy(() => import("./routes/players")),
  console: lazy(() => import("./routes/console")),
  backups: lazy(() => import("./routes/backups")),
  access: lazy(() => import("./routes/access")),
  settings: lazy(() => import("./routes/settings")),
};
let initialized = false;
export default function Application() {
  const pathname = usePathname();
  const route = (pathname.split("/").filter(Boolean)[0] ??
      "overview") as keyof typeof views,
    snap = useControl(),
    [pair, setPair] = useState(false);
  useEffect(() => {
    if (initialized) return;
    initialized = true;
    async function start() {
      if (process.env.NODE_ENV === "development") {
        const mode = new URL(location.href).searchParams.get("fixture");
        if (
          mode &&
          [
            "healthy",
            "stale",
            "skew",
            "partial",
            "stopped",
            "offline",
            "denied",
          ].includes(mode)
        ) {
          const { makeFixture, fixtureAction, setFixtureMode } =
            await import("../development/fixtures");
          setFixtureMode(mode);
          session.installFixture(mode, makeFixture(mode), fixtureAction);
          return;
        }
      }
      await session.start();
    }
    void start();
  }, []);
  const View = views[route] ?? views.overview;
  if (process.env.NODE_ENV === "development" && pathname.startsWith("/dev/"))
    return (
      <>
        <PreferencesBridge />
        <Gallery />
      </>
    );
  return (
    <>
      <PreferencesBridge />
      {!snap.initialized ? (
        <div className="pp-canvas p-8">
          <RouteSkeleton />
        </div>
      ) : pair || (!snap.state.serverId && !snap.fixture) ? (
        <PairingGate
          onBack={snap.state.serverId ? () => setPair(false) : undefined}
        />
      ) : (
        <PairingContext.Provider value={() => setPair(true)}>
          <ReviewProvider>
            <AppShell route={route} onPair={() => setPair(true)}>
              <RouteBoundary key={route}>
                <Suspense fallback={<RouteSkeleton />}>
                  <View
                    key={JSON.stringify([
                      snap.revision,
                      snap.phase,
                      snap.state.serverId,
                      snap.state.ready?.server.paperSession,
                      snap.state.ready?.server.hostSession,
                      snap.state.service.invocationId,
                      snap.state.ready?.device.role,
                      snap.state.ready?.device.scopes,
                      snap.grant?.role,
                      snap.grant?.scopes,
                    ])}
                  />
                </Suspense>
              </RouteBoundary>
            </AppShell>
          </ReviewProvider>
        </PairingContext.Provider>
      )}
    </>
  );
}
