import type { Metadata } from "next";
import Script from "next/script";
import "./styles/foundation.css";
import { hankenLatin, hankenExtended, commitMono } from "./fonts";
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
      <body className={`${hankenLatin.variable} ${hankenExtended.variable} ${commitMono.variable}`}>
        <Script src="/ui-preferences-init.js" strategy="beforeInteractive" />
        <UiPreferencesProvider>{children}</UiPreferencesProvider>
      </body>
    </html>
  );
}
