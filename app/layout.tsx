import type { Metadata } from "next";
import "./globals.css";
import "./control-room.css";
import "./control-room-2-1.css";
import "./management-2-1.css";
import "./visual-motion.css";
import "./player-head.css";
import { UiPreferencesProvider } from "../components/ui-preferences-provider";

export const metadata: Metadata = {
  title: "PlexonPanel Dashboard",
  description: "Securely monitor and manage your Paper servers from anywhere.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="/ui-preferences-init.js" />
      </head>
      <body>
        <UiPreferencesProvider>{children}</UiPreferencesProvider>
      </body>
    </html>
  );
}
