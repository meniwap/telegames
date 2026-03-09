"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { enterTelegramImmersiveMode } from "@/lib/client/telegram-web-app";
import type { PlayerRecord } from "@/lib/types";

import { SiteNav } from "./site-nav";

function isImmersivePlayPath(pathname: string | null) {
  return pathname ? /^\/games\/[^/]+\/play$/.test(pathname) : false;
}

export function AppChrome({
  appName,
  player,
  isAdmin,
  children
}: {
  appName: string;
  player: PlayerRecord | null;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isImmersivePlay = isImmersivePlayPath(pathname);

  useEffect(() => {
    document.documentElement.classList.toggle("immersive-play-route", isImmersivePlay);
    document.body.classList.toggle("immersive-play-route", isImmersivePlay);

    const teardown = isImmersivePlay ? enterTelegramImmersiveMode() : undefined;

    return () => {
      teardown?.();
      document.documentElement.classList.remove("immersive-play-route");
      document.body.classList.remove("immersive-play-route");
    };
  }, [isImmersivePlay]);

  return (
    <>
      {isImmersivePlay ? null : <SiteNav appName={appName} player={player} isAdmin={isAdmin} />}
      <main
        data-route-shell={isImmersivePlay ? "immersive-play" : "default"}
        className={isImmersivePlay ? "h-[100dvh] min-h-[100dvh] overflow-hidden" : undefined}
      >
        {children}
      </main>
    </>
  );
}
