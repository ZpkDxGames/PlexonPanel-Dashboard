"use client";

import dynamic from "next/dynamic";
import { useCallback, type ReactNode } from "react";
import { reconcileDeviceGrant } from "../lib/device-grant";
import { WorkspaceBoundary } from "./ui/workspace";
import type { ViewProps } from "./control-views";
import type { DashboardModel } from "./use-dashboard-session";

const Overview = dynamic(() => import("./overview-view").then(m => m.OverviewView));
const Performance = dynamic(() => import("./performance-view").then(m => m.PerformanceView));
const Players = dynamic(() => import("./players-view").then(m => m.PlayersView));
const Console = dynamic(() => import("./console-view").then(m => m.ConsoleView));
const Chat = dynamic(() => import("./communication-views").then(m => m.ChatView));
const Plugins = dynamic(() => import("./communication-views").then(m => m.PluginsView));
const Server = dynamic(() => import("./server-view").then(m => m.ServerView));
const Backups = dynamic(() => import("./backups-view").then(m => m.BackupsView));
const Configuration = dynamic(() => import("./configuration-view").then(m => m.ConfigurationView));
const Access = dynamic(() => import("./governance-views").then(m => m.AccessView));
const Audit = dynamic(() => import("./governance-views").then(m => m.AuditView));
const Settings = dynamic(() => import("./settings-view").then(m => m.SettingsView));
const Fleet = dynamic(() => import("./fleet-overview").then(m => m.FleetOverview));

/** Workspaces share one lazy owner and the existing error boundary. */
export function Workspaces({ model: m, pulseWindowEndAt }: { model: DashboardModel; pulseWindowEndAt?: number }) {
  const { observeActivity, state: { serverId } } = m;
  const observeBackupPhase = useCallback((jobId: string, phase: string) => {
    observeActivity({ kind: "backup-phase", serverId, jobId, phase });
  }, [observeActivity, serverId]);
  const deviceGrant = reconcileDeviceGrant(m.sessionGrant, m.state.ready?.device);
  const props: ViewProps = { state: m.state, pulseWindowEndAt, navigate: m.navigate, can: m.can, run: m.run, notice: m.setNotice, connected: m.phase === "live", setUnsaved: m.setUnsaved, observeBackupPhase, ...(deviceGrant ? { deviceGrant } : {}) };
  let view: ReactNode;
  switch (m.section) {
    case "Fleet": view = <Fleet credentials={m.credentials} selected={m.state} connected={m.phase === "live"} phase={m.phase} labels={m.serverLabels} rememberName={m.rememberServerName} openServer={m.switchServer} pair={() => m.setPairing(true)} />; break;
    case "Overview": view = <Overview {...props} />; break;
    case "Performance": view = <Performance props={props} resetHistory={m.resetHistory} />; break;
    case "Players": view = <Players {...props} />; break;
    case "Console": view = <Console {...props} />; break;
    case "Chat": view = <Chat {...props} />; break;
    case "Plugins": view = <Plugins {...props} />; break;
    case "Server": view = <Server {...props} />; break;
    case "Backups": view = <Backups {...props} />; break;
    case "Configuration": view = <Configuration {...props} />; break;
    case "Access": view = <Access {...props} forget={m.forget} pair={() => m.setPairing(true)} />; break;
    case "Audit": view = <Audit {...props} />; break;
    case "Settings": view = <Settings {...props} clearLocalChatCache={m.clearLocalChatCache} clearLocalCache={m.clearLocalCache} reconnect={() => m.setReconnect(v => v + 1)} />; break;
  }
  return <div data-ui6-workspace-mounted="PLEXON_UI6_WORKSPACE_CHUNK"><WorkspaceBoundary name={m.section} key={`${m.state.serverId}:${m.section}:${m.refreshRevision}`}>{view}</WorkspaceBoundary></div>;
}
