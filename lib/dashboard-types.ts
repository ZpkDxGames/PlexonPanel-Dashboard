export type ServerHealth = "online" | "degraded" | "offline";

export interface ServerSummary {
  id: string;
  name: string;
  address: string;
  status: ServerHealth;
  platform: string;
  version: string;
  lastSeen: string;
}

export interface StatCard {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "neutral" | "warning";
}

export interface ResourceMetric {
  label: string;
  value: number;
  displayValue: string;
  detail: string;
  tone: "cyan" | "violet" | "green";
}

export interface TimelinePoint {
  label: string;
  value: number;
}

export interface ActivityEvent {
  id: string;
  category: "player" | "system" | "plugin" | "security";
  title: string;
  detail: string;
  time: string;
}

export interface DashboardOverview {
  server: ServerSummary;
  stats: StatCard[];
  resources: ResourceMetric[];
  tpsHistory: TimelinePoint[];
  activity: ActivityEvent[];
}

export interface DashboardWorkspace {
  overview: DashboardOverview;
  management: import("./management-data").ManagementData;
}
