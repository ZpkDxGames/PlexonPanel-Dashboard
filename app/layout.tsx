import type { Metadata } from "next";
import "./globals.css";
import "./control-room.css";
import "./control-room-2-1.css";
import "./management-2-1.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
