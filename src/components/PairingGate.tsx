import { Box, Activity, ShieldCheck } from "lucide-react";
import { PairingForm } from "./PairingForm";
import { useSession } from "../hooks";
export function PairingGate() {
  const snap = useSession();
  return (
    <main className="flex min-h-dvh items-center justify-center p-5">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-black/10 md:grid-cols-2">
        <section className="flex flex-col justify-between gap-12 border-b bg-primary/[.035] p-8 md:border-b-0 md:border-r md:p-10">
          <div className="flex items-center gap-3">
            <Box className="text-primary" size={25} />
            <span className="text-xl font-bold tracking-tight">
              plexon<span className="text-primary">panel</span>
            </span>
          </div>
          <div>
            <div className="mb-6 inline-flex rounded-lg border bg-primary/5 p-3 text-primary">
              <Activity size={25} />
            </div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              Your worlds.
              <br />
              One clear view.
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Live performance, players, and server operations. A focused
              workspace for everything you run.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck size={15} />
            Scoped access · Signed Protocol 3
          </div>
        </section>
        <section className="p-8 md:p-10">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
            Welcome to your workspace
          </span>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">
            Connect a server
          </h2>
          <p className="mb-8 mt-3 text-xs leading-6 text-muted-foreground">
            Create a one-time code with{" "}
            <code className="rounded bg-muted px-1.5 py-1">
              /plexonpanel pair &lt;Role&gt;
            </code>
            , then enter it below.
          </p>
          <PairingForm />
          <p className="mt-7 break-all border-t pt-5 font-mono text-[9px] leading-5 text-muted-foreground">
            {snap.relay.origin || "Configure your HTTPS relay to begin"}
          </p>
        </section>
      </div>
    </main>
  );
}
