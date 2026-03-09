import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Oxanium, Space_Grotesk } from "next/font/google";
import Script from "next/script";

import { getThemeCssVariables } from "@telegramplay/theme-engine";

import { AppChrome } from "@/components/app-chrome";
import { AuthBootstrap } from "@/components/auth-bootstrap";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import { getEnv } from "@/lib/env";
import { getPagePlayerContext } from "@/lib/server/page-context";

import "./globals.css";

const displayFont = Oxanium({
  subsets: ["latin"],
  variable: "--font-display"
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body"
});

const monoFont = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono"
});

export function generateMetadata(): Metadata {
  const env = getEnv();

  return {
    title: env.APP_NAME,
    description: "Telegram Mini App game platform with server-validated official results."
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const env = getEnv();
  const playerContext = await getPagePlayerContext();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} min-h-screen bg-[var(--surface-primary)] text-[var(--text-primary)]`}
        style={getThemeCssVariables(env.NEXT_PUBLIC_APP_THEME)}
      >
        <Script src="https://telegram.org/js/telegram-web-app.js?59" strategy="beforeInteractive" />
        <AuthBootstrap hasSession={Boolean(playerContext)} />
        <ClientErrorReporter />
        <AppChrome appName={env.APP_NAME} player={playerContext?.player ?? null} isAdmin={playerContext?.isAdmin ?? false}>
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
