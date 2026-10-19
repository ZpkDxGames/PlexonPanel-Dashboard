import type { ReactNode } from "react";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { Providers } from "../src/ui/shell/Providers";
import "../src/ui/styles/globals.css";
const sans = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-sans",
  display: "swap",
});
const mono = localFont({
  src: "../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-mono",
  display: "swap",
});
export const metadata = {
  title: "PlexonPanel · Mission Deck",
  description: "A signed, scoped Minecraft operations instrument.",
};
export default async function Layout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{let p=JSON.parse(localStorage.getItem('plexon:preferences')||'{}'),r=document.documentElement;r.dataset.theme=p.theme==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p.theme==='light'?'light':'dark';r.dataset.accent=['teal','blue','violet'].includes(p.accent)?p.accent:'teal';r.dataset.density=['compact','comfortable','spacious'].includes(p.density)?p.density:'comfortable';r.dataset.textSize=['small','standard','large'].includes(p.textSize)?p.textSize:'standard';r.dataset.motion=['full','reduced','off'].includes(p.motion)?p.motion:'full';r.dataset.chartFill=String(p.chartFill!==false)}catch{}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
