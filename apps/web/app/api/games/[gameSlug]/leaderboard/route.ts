import { NextResponse } from "next/server";

import { getGameLeaderboardPayload } from "@/lib/server/game-service";
import type { LeaderboardWindow } from "@telegramplay/game-core";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameSlug: string }> }
) {
  const { gameSlug } = await params;
  const url = new URL(request.url);
  const window = (url.searchParams.get("window") ?? "daily") as LeaderboardWindow;
  return NextResponse.json(await getGameLeaderboardPayload(gameSlug, window));
}
