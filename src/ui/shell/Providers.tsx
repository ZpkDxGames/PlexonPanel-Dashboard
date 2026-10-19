"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PreferencesBridge, useControl } from "../bindings";
import { startSession } from "../bindings/startup";
import { ReviewProvider } from "../primitives/ReviewProvider";
import { AppShell } from "./AppShell";
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    void startSession();
  }, []);
  return (
    <>
      <PreferencesBridge />
      {children}
    </>
  );
}
export function AuthBoundary({ children }: { children: ReactNode }) {
  const snap = useControl(),
    router = useRouter(),
    pathname = usePathname();
  useEffect(() => {
    if (snap.initialized && !snap.fixture && !snap.state.serverId)
      router.replace("/pair");
  }, [snap.initialized, snap.fixture, snap.state.serverId, router]);
  if (!snap.initialized || (!snap.fixture && !snap.state.serverId))
    return (
      <main className="pp-pair">
        <div className="muted" role="status">
          Initializing secure workspace…
        </div>
      </main>
    );
  return (
    <ReviewProvider key={`${snap.revision}:${snap.state.serverId}`}>
      <AppShell>{children}</AppShell>
    </ReviewProvider>
  );
}
