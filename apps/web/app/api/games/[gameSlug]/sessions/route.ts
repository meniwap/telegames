import { NextResponse } from "next/server";

import { getSessionCookieValue } from "@/lib/auth/session";
import { createGameSessionForPlayer } from "@/lib/server/game-service";
import { getPlayerContextFromToken } from "@/lib/server/store";

const SAFE_ERROR_CODES = new Set(["unauthorized", "game_not_found"]);

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
    const code = error instanceof Error ? error.message : "create_session_failed";

    return NextResponse.json(
      { error: SAFE_ERROR_CODES.has(code) ? code : "create_session_failed" },
      { status: code === "unauthorized" ? 401 : 400 }
    );
  }
}
