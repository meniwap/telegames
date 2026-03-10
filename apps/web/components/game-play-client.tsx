"use client";

import { Card } from "@telegramplay/ui";

import { HopperPlayClient } from "./hopper-play-client";
import { RacerPlayClient } from "./racer-play-client";
import { MemoryPlayClient } from "./memory-play-client";

export function GamePlayClient({
  gameSlug,
  gameName,
  hasSession
}: {
  gameSlug: string;
  gameName: string;
  hasSession: boolean;
}) {
  if (gameSlug === "racer-poc") {
    return <RacerPlayClient gameSlug={gameSlug} gameName={gameName} hasSession={hasSession} />;
  }

  if (gameSlug === "memory") {
    return <MemoryPlayClient gameSlug={gameSlug} gameName={gameName} hasSession={hasSession} />;
  }

  if (gameSlug === "skyline-hopper") {
    return <HopperPlayClient gameSlug={gameSlug} gameName={gameName} hasSession={hasSession} />;
  }

  return <Card className="m-4 text-sm text-[var(--text-muted)]">This game module does not expose a playable surface yet.</Card>;
}
