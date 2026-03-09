import { notFound } from "next/navigation";

import { GamePlayClient } from "@/components/game-play-client";
import { getPagePlayerContext } from "@/lib/server/page-context";
import { getGameDetailPayload } from "@/lib/server/game-service";

export default async function GamePlayPage({
  params
}: {
  params: Promise<{ gameSlug: string }>;
}) {
  const { gameSlug } = await params;

  try {
    const playerContext = await getPagePlayerContext();
    const game = await getGameDetailPayload(gameSlug);

    return <GamePlayClient gameSlug={gameSlug} gameName={game.name} hasSession={Boolean(playerContext)} />;
  } catch {
    notFound();
  }
}
