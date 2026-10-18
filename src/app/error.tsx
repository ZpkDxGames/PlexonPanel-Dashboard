"use client";
import { TriangleAlert } from "lucide-react";
import { Button } from "../components/ui/button";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center">
        <TriangleAlert className="mx-auto mb-5 text-amber-500" size={30} />
        <h1 className="text-xl font-semibold tracking-tight">
          Workspace unavailable
        </h1>
        <p className="mb-6 mt-3 text-xs leading-6 text-muted-foreground">
          Reconnect and inspect agent state before repeating an operation.
        </p>
        <Button onClick={reset}>Reload workspace</Button>
      </section>
    </main>
  );
}
