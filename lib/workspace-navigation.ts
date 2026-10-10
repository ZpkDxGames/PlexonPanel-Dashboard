export const sections = [
  "Fleet",
  "Overview",
  "Performance",
  "Players",
  "Console",
  "Chat",
  "Plugins",
  "Server",
  "Backups",
  "Configuration",
  "Audit",
  "Access",
  "Settings",
] as const;
export type Section = (typeof sections)[number];
