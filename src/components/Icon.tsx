import type { SVGProps } from "react";

const paths: Record<string, string[]> = {
  fleet: ["M4 6.5h16v11H4z", "M8 17.5v2M16 17.5v2", "M7 10h.01M10 10h7"],
  overview: ["M4 13h6V4H4z", "M14 20h6V11h-6z", "M4 20h6v-3H4z", "M14 7h6V4h-6z"],
  performance: ["M3 17l4-5 4 2 5-8 5 3", "M3 21h18"],
  players: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  console: ["M4 17l6-5-6-5", "M12 19h8"],
  backups: ["M4 7h16v13H4z", "M8 7V4h8v3", "M8 12h8"],
  access: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10", "M9 12l2 2 4-4"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2 3.46-.08-.03a1.7 1.7 0 0 0-1.8.26l-.82.48a1.7 1.7 0 0 0-.84 1.67V23h-4v-.1a1.7 1.7 0 0 0-.84-1.67l-.82-.48a1.7 1.7 0 0 0-1.8-.26l-.08.03-2-3.46.06-.06A1.7 1.7 0 0 0 4.6 15l-.02-.96a1.7 1.7 0 0 0-1-1.56l-.08-.04 2-3.46.08.03a1.7 1.7 0 0 0 1.8-.26l.82-.48A1.7 1.7 0 0 0 9.04 6.6V6.5h4v.1a1.7 1.7 0 0 0 .84 1.67l.82.48a1.7 1.7 0 0 0 1.8.26l.08-.03 2 3.46-.08.04a1.7 1.7 0 0 0-1 1.56z"],
  search: ["M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16", "M21 21l-4.35-4.35"],
  chevron: ["M9 18l6-6-6-6"],
  menu: ["M4 7h16M4 12h16M4 17h16"],
  sun: ["M12 4V2M12 22v-2M4.93 4.93 3.51 3.51M20.49 20.49l-1.42-1.42M4 12H2M22 12h-2M4.93 19.07l-1.42 1.42M20.49 3.51l-1.42 1.42", "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8"],
  alert: ["M12 3 2.7 20h18.6z", "M12 9v4M12 17h.01"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20", "M12 6v6l4 2"],
  close: ["M6 6l12 12M18 6 6 18"],
  check: ["M5 12l4 4L19 6"],
  server: ["M4 4h16v6H4zM4 14h16v6H4z", "M8 7h.01M8 17h.01M12 7h5M12 17h5"],
  copy: ["M8 8h11v11H8z", "M5 16H4V5h11v1"],
  download: ["M12 3v12M7 10l5 5 5-5", "M5 21h14"],
  pause: ["M8 5v14M16 5v14"],
  play: ["M8 5l11 7-11 7z"],
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  sparkle: ["M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4z", "M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"],
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{(paths[name] ?? paths.overview).map((path, index) => <path d={path} key={index} />)}</svg>;
}
