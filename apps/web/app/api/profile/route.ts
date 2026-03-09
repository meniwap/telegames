import { NextResponse } from "next/server";

import { getSessionCookieValue } from "@/lib/auth/session";
import { getProfilePayload } from "@/lib/server/game-service";
import { getPlayerContextFromToken } from "@/lib/server/store";

export async function GET(request: Request) {
  const playerContext = await getPlayerContextFromToken(await getSessionCookieValue());
  const payload = await getProfilePayload(playerContext, new URL(request.url).searchParams.get("game"));

  if (!payload) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json(payload);
}
