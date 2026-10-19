import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useControl, useSource, session } from "../hooks/useControl";
import { usePreferences } from "../../store/preferences";
export function AppShell({
  route,
  onPair,
  children,
}: {
  route: string;
  onPair: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [drawer, setDrawer] = useState(false),
    snap = useControl(),
    source = useSource("paperHealth"),
    p = usePreferences(),
    reduced = useReducedMotion();
  return (
    <div className="pp-canvas app-shell">
      <motion.div
        className="desktop-sidebar"
        animate={{ width: collapsed ? 72 : 264 }}
        transition={{ duration: reduced || p.motion !== "full" ? 0 : 0.2 }}
      >
        <Sidebar
          route={route}
          collapsed={collapsed}
          onCollapse={() => setCollapsed(!collapsed)}
          onPair={onPair}
        />
      </motion.div>
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="mobile-nav">
            <Dialog.Title className="sr-only">
              Workspace navigation
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Navigate the server workspace.
            </Dialog.Description>
            <Dialog.Close
              className="icon-btn nav-close"
              aria-label="Close navigation"
            >
              <X size={16} />
            </Dialog.Close>
            <Sidebar
              route={route}
              collapsed={false}
              onCollapse={() => setDrawer(false)}
              onNavigate={() => setDrawer(false)}
              onPair={() => {
                setDrawer(false);
                onPair();
              }}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="workspace">
        <TopBar route={route} onMenu={() => setDrawer(true)} />
        <main className="page-content">
          <div className="page-inner">
            {snap.fixture && (
              <div className="fixture-banner">
                Development fixture · no server operations
              </div>
            )}
            {source.kind !== "live" && (
              <div className="state-banner">
                Paper: {source.kind} · source values retain their capture time.{" "}
                {snap.error}
                <button className="btn" onClick={() => session.reconnect()}>
                  Reconnect
                </button>
              </div>
            )}
            {children}
          </div>
        </main>
        <footer className="app-footer">
          <span>
            plexonpanel <span className="mono">5.0</span>
          </span>
          <span>Protocol 3 · Signed & scoped</span>
        </footer>
      </div>
    </div>
  );
}
