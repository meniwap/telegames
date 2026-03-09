import { NextResponse } from "next/server";

import { getGameDetailPayload } from "@/lib/server/game-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameSlug: string }> }
) {
  try {
    return NextResponse.json(await getGameDetailPayload((await params).gameSlug));
  } catch {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
}
