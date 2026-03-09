import { NextResponse } from "next/server";

import { getSessionCookieValue } from "@/lib/auth/session";
import { createGameSessionForPlayer } from "@/lib/server/game-service";
import { getPlayerContextFromToken } from "@/lib/server/store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameSlug: string }> }
) {
  try {
    const { gameSlug } = await params;
    const playerContext = await getPlayerContextFromToken(await getSessionCookieValue());
    const gameSession = await createGameSessionForPlayer(playerContext, gameSlug);
    return NextResponse.json({ gameSession: gameSession.config });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "create_session_failed" }, { status: 401 });
  }
}
