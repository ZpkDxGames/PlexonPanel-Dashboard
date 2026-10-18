import Link from "next/link";
import { ArrowLeft, Box } from "lucide-react";
import { Button } from "../components/ui/button";
export default function Page() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="text-center">
        <Box
          className="mx-auto mb-6 text-primary"
          size={36}
          strokeWidth={1.5}
        />
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="mb-3 mt-2 text-2xl font-semibold tracking-tight">
          Workspace not found
        </h1>
        <p className="mb-6 text-xs text-muted-foreground">
          Return to your server overview.
        </p>
        <Button asChild>
          <Link href="/overview">
            <ArrowLeft />
            Open overview
          </Link>
        </Button>
      </section>
    </main>
  );
}
