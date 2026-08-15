import type { DashboardOverview } from "./dashboard-types";

export const demoOverview: DashboardOverview = {
  server: {
    id: "demo-lobby-01",
    name: "Plexon Network",
    address: "play.plexon.example",
    status: "online",
    platform: "Paper",
    version: "26.2",
    lastSeen: "Just now",
  },
  stats: [
    { label: "TPS", value: "19.98", detail: "Healthy and stable", tone: "positive" },
    { label: "MSPT", value: "31.4", detail: "8.2% below peak", tone: "positive" },
    { label: "Players", value: "84 / 250", detail: "12 joined recently", tone: "neutral" },
    { label: "Uptime", value: "6d 14h", detail: "No recent restarts", tone: "neutral" },
  ],
  resources: [
    { label: "CPU load", value: 42, displayValue: "42%", detail: "8 cores available", tone: "cyan" },
    { label: "Memory", value: 45, displayValue: "10.7 / 24 GB", detail: "13.3 GB available", tone: "violet" },
    { label: "Disk", value: 43, displayValue: "68.4 / 160 GB", detail: "91.6 GB available", tone: "green" },
  ],
  tpsHistory: [
    { label: "12:00", value: 19.92 },
    { label: "12:05", value: 19.96 },
    { label: "12:10", value: 19.89 },
    { label: "12:15", value: 19.97 },
    { label: "12:20", value: 19.99 },
    { label: "12:25", value: 19.93 },
    { label: "12:30", value: 19.98 },
    { label: "12:35", value: 19.95 },
    { label: "12:40", value: 19.99 },
    { label: "12:45", value: 19.96 },
    { label: "12:50", value: 19.98 },
    { label: "12:55", value: 19.98 },
  ],
  activity: [
    { id: "evt-01", category: "player", title: "NovaFox joined the server", detail: "Lobby · 84 players online", time: "18 sec ago" },
    { id: "evt-02", category: "plugin", title: "Plugin health check completed", detail: "31 enabled · no failures detected", time: "2 min ago" },
    { id: "evt-03", category: "system", title: "Automatic world save finished", detail: "Completed in 842 ms", time: "6 min ago" },
    { id: "evt-04", category: "security", title: "Remote console session closed", detail: "Session duration · 4 minutes", time: "19 min ago" },
  ],
};
