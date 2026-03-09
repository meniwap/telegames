import { NextResponse } from "next/server";

import { getSessionCookieValue } from "@/lib/auth/session";
import { getOpsDashboardPayload } from "@/lib/server/game-service";
import { getPlayerContextFromToken } from "@/lib/server/store";

export async function GET(request: Request) {
  try {
    const playerContext = await getPlayerContextFromToken(await getSessionCookieValue());
    return NextResponse.json(await getOpsDashboardPayload(playerContext, new URL(request.url).searchParams.get("game")));
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
}
