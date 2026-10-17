"use client";
import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { session } from "../../adapter/session";
import {
  preferences,
  applyPreferencesToDocument,
  usePreferences,
} from "../../store/preferences";
let initialized: Promise<void> | undefined;
async function initialize() {
  if (process.env.NODE_ENV !== "production") {
    const mode = new URL(location.href).searchParams.get("fixture");
    if (
      mode &&
      [
        "healthy",
        "skew",
        "stale",
        "partial",
        "stopped",
        "offline",
        "denied",
      ].includes(mode)
    ) {
      const { makeFixture, fixtureAction, setFixtureMode } =
        await import("../../development/fixtures");
      setFixtureMode(mode);
      session.installFixture(mode, makeFixture(mode), fixtureAction);
      Object.assign(window, {
        __PLEXON_TEST__: {
          snapshot: session.getSnapshot,
          receive: session.receiveFixture,
          install: (state: ReturnType<typeof makeFixture>) =>
            session.installFixture("load-test", state, fixtureAction),
        },
      });
      if (mode === "healthy") {
        const timer = setInterval(() => {
          const state = session.getSnapshot().state,
            at = new Date().toISOString(),
            send = (
              eventType: string,
              body: Record<string, unknown>,
              kind: "HOST" | "PAPER",
            ) =>
              session.receiveFixture({
                type: "server.event",
                serverId: state.serverId,
                agentKind: kind,
                agentSession:
                  kind === "HOST"
                    ? state.ready?.server.hostSession
                    : state.ready?.server.paperSession,
                eventType,
                body,
              });
          send(
            "telemetry.server",
            { ...state.server, capturedAt: at },
            "PAPER",
          );
          send(
            "telemetry.system",
            { ...state.hostSystem, capturedAt: at },
            "HOST",
          );
          if (Date.now() % 1000 < 260) {
            send(
              "telemetry.system",
              { ...state.system, capturedAt: at },
              "PAPER",
            );
            send(
              "service.status",
              {
                ...state.service,
                resources: {
                  ...(state.service.resources as Record<string, unknown>),
                  capturedAt: at,
                },
              },
              "HOST",
            );
          }
        }, 250);
        addEventListener("pagehide", () => clearInterval(timer), {
          once: true,
        });
      }
      return;
    }
  }
  await session.start();
}
export function Providers({ children }: { children: ReactNode }) {
  const prefs = usePreferences();
  useEffect(() => {
    preferences.hydrate();
    initialized ??= initialize();
    const close = () => session.close();
    const resume = (e: PageTransitionEvent) => {
      if (e.persisted) session.reconnect();
    };
    addEventListener("pagehide", close);
    addEventListener("pageshow", resume);
    return () => {
      removeEventListener("pagehide", close);
      removeEventListener("pageshow", resume);
    };
  }, []);
  useLayoutEffect(() => {
    applyPreferencesToDocument(prefs);
    const q = matchMedia("(prefers-color-scheme: light)"),
      update = () => applyPreferencesToDocument(prefs);
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, [prefs]);
  return (
    <>
      {children}
      <Toaster position="bottom-right" closeButton richColors />
    </>
  );
}
