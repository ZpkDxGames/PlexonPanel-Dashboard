import type { SVGProps } from "react";

export const iconPaths = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  performance: "M3 19h18 M4 14l4-5 4 3 4-8 4 3",
  players: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a7 7 0 0 1 14 0v3 M17 4a4 4 0 0 1 0 7 M19 14a6 6 0 0 1 3 5v2",
  console: "M4 6l6 6-6 6 M13 18h7",
  chat: "M3 4h18v13H9l-6 4V4z",
  plugins: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z",
  server: "M3 3h18v7H3z M3 14h18v7H3z M6 6h.01 M6 17h.01 M10 6h7 M10 17h7",
  backups: "M3 8h18v13H3z M2 3h20v5H2z M9 12h6",
  configuration: "M4 7h16 M4 17h16 M8 3v8 M16 13v8",
  access: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3",
  audit: "M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4",
  settings: "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1 M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0",
  fleet: "M3 3h7v6H3z M14 3h7v6h-7z M8 15h8v6H8z M6.5 9v3H12v3 M17.5 9v3H12",
  check: "M4 12l5 5L20 6", close: "M5 5l14 14 M19 5L5 19",
  warning: "M12 3l10 18H2L12 3z M12 9v5 M12 17h.01",
  failure: "M4 4h16v16H4z M8 8l8 8 M16 8l-8 8",
  unknown: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 11v6 M12 7h.01",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6",
  chevron: "M6 9l6 6 6-6", arrow: "M4 12h16 M13 5l7 7-7 7",
  menu: "M3 6h18 M3 12h18 M3 18h18", more: "M5 12h.01 M12 12h.01 M19 12h.01",
  copy: "M8 8h13v13H8z M16 8V3H3v13h5",
  download: "M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4",
  upload: "M12 15V3 M7 8l5-5 5 5 M4 17v4h16v-4",
  folder: "M3 5h7l2 3h9v13H3V5z", file: "M5 3h9l5 5v13H5z M14 3v5h5",
  refresh: "M20 8a8 8 0 1 0 0 8 M20 3v5h-5",
  sun: "M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5 M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0",
  moon: "M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11z",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v6l4 2",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0",
  trash: "M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  power: "M12 2v10 M7 5a9 9 0 1 0 10 0",
} as const;
export type IconName = keyof typeof iconPaths;

export function Icon({ name, label, size = "normal", ...props }: Omit<SVGProps<SVGSVGElement>, "name"> & { name: IconName; label?: string; size?: "small" | "normal" }) {
  return <svg {...props} className={`pp-icon pp-icon-${size} ${props.className ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false"><path d={iconPaths[name]} /></svg>;
}
