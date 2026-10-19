import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import {
  Box,
  Activity,
  Network,
  ChartNoAxesCombined,
  Users,
  Terminal,
  ArchiveRestore,
  ShieldCheck,
  Settings,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useControl, session } from "../hooks/useControl";
import { IconBadge } from "../primitives/IconBadge";
import { Pill } from "../primitives/Pill";
export const navigation = [
  { id: "fleet", label: "Fleet", icon: Network, group: "Monitoring" },
  { id: "overview", label: "Overview", icon: Activity, group: "Monitoring" },
  {
    id: "performance",
    label: "Performance",
    icon: ChartNoAxesCombined,
    group: "Monitoring",
  },
  { id: "players", label: "Players", icon: Users, group: "Management" },
  {
    id: "console",
    label: "Console & chat",
    icon: Terminal,
    group: "Management",
  },
  {
    id: "backups",
    label: "Backups",
    icon: ArchiveRestore,
    group: "Management",
  },
  { id: "access", label: "Access & audit", icon: ShieldCheck, group: "System" },
  { id: "settings", label: "Settings", icon: Settings, group: "System" },
];
export function Sidebar({
  route,
  collapsed,
  onCollapse,
  onNavigate,
  onPair,
}: {
  route: string;
  collapsed: boolean;
  onCollapse: () => void;
  onNavigate?: () => void;
  onPair: () => void;
}) {
  const snap = useControl(),
    s = snap.state;
  return (
    <aside className={`sidebar pp-shell ${collapsed ? "collapsed" : ""}`}>
      <div className="brand">
        <IconBadge icon={Box} />
        {!collapsed && (
          <>
            <strong>plexonpanel</strong>
            <small className="pp-well mono">5.0</small>
          </>
        )}
      </div>
      <Popover.Root>
        <Popover.Trigger
          className="pp-well server-switch"
          aria-label="Select server"
        >
          <IconBadge icon={Box} />
          {!collapsed && (
            <span>
              <strong>{s.ready?.server.serverName ?? "Select server"}</strong>
              <small>Server workspace</small>
            </span>
          )}
          <ChevronsUpDown size={14} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="pp-glass server-popover" sideOffset={8}>
            {snap.credentials.map((c) => (
              <button
                key={c.serverId}
                onClick={() => void session.select(c.serverId)}
              >
                {snap.labels[c.serverId] ?? c.name ?? c.serverId}
              </button>
            ))}
            <button onClick={onPair}>Pair a server</button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <nav aria-label="Primary">
        {["Monitoring", "Management", "System"].map((group) => (
          <div className="nav-group" key={group}>
            {!collapsed && <p className="eyebrow">{group}</p>}
            {navigation
              .filter((n) => n.group === group)
              .map((n) => (
                <Link
                  key={n.id}
                  href={`/${n.id}`}
                  aria-current={route === n.id ? "page" : undefined}
                  aria-label={n.label}
                  onClick={onNavigate}
                  className={`nav-link ${route === n.id ? "pp-glow-active" : ""}`}
                >
                  <n.icon size={18} />
                  {!collapsed && <span>{n.label}</span>}
                  {!collapsed && n.id === "players" && (
                    <Pill tone="emerald" className="ml-auto">
                      {String(s.server.onlinePlayers ?? "—")}
                    </Pill>
                  )}
                  {!collapsed && n.id === "console" && (
                    <Pill tone="amber" className="ml-auto">
                      {
                        s.console.filter((l) =>
                          ["WARN", "ERROR", "FATAL"].includes(String(l.level)),
                        ).length
                      }
                    </Pill>
                  )}
                  {n.id === "backups" &&
                    s.maintenancePhase?.kind === "FULL_RESTORE_POINT" &&
                    !!s.maintenancePhase?.phase &&
                    ![
                      "COMPLETED",
                      "DEGRADED",
                      "FAILED",
                      "RECOVERY_REQUIRED",
                    ].includes(String(s.maintenancePhase.phase)) && (
                      <span
                        className="backup-running-dot ml-auto"
                        data-tone="indigo"
                        role="img"
                        aria-label="Backup running"
                      />
                    )}
                  {collapsed && (
                    <span className="pp-glass nav-tooltip">{n.label}</span>
                  )}
                </Link>
              ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div
          className="pp-well relay-card"
          data-tone={snap.phase === "live" ? "emerald" : "rose"}
        >
          <strong>
            <span
              role="img"
              className={`relay-signal ${snap.phase === "live" ? "connected" : ""}`}
              aria-label={
                snap.phase === "live" ? "Relay connected" : "Relay disconnected"
              }
              title="Relay connectivity; round-trip latency is not reported"
            >
              <i />
              <i />
              <i />
            </span>
            {!collapsed &&
              (snap.phase === "live" ? "Relay connected" : "Relay unavailable")}
          </strong>
          {!collapsed && (
            <>
              <p>Signed Protocol 3 connection</p>
              <Pill tone="emerald">{s.ready?.device.role ?? "No"} access</Pill>
              {snap.phase !== "live" && (
                <button
                  className="btn mt-2"
                  onClick={() => session.reconnect()}
                >
                  Reconnect
                </button>
              )}
            </>
          )}
        </div>
        <footer>
          <button
            className="icon-btn"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onCollapse}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          {!collapsed && <span>PlexonPanel · Minecraft operations</span>}
        </footer>
      </div>
    </aside>
  );
}
