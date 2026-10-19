import type { ReactNode } from "react";
import { AuthBoundary } from "../../src/ui/shell/Providers";
export default function Workspace({ children }: { children: ReactNode }) {
  return <AuthBoundary>{children}</AuthBoundary>;
}
