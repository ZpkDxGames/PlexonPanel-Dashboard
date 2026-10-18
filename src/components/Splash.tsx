import { Box } from "lucide-react";
export function Splash() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5">
      <span className="rounded-2xl border border-primary/30 bg-primary/10 p-5 text-primary">
        <Box size={36} strokeWidth={1.5} />
      </span>
      <p className="text-xl font-semibold tracking-tight">
        plexon<span className="text-primary">panel</span>
      </p>
      <p role="status" className="text-xs text-muted-foreground">
        Opening your workspace…
      </p>
    </main>
  );
}
