import { NextResponse } from "next/server";

import { getSessionCookieValue } from "@/lib/auth/session";
import { getBootstrapPayload, getPlayerContextFromToken } from "@/lib/server/store";

export async function GET() {
  const playerContext = await getPlayerContextFromToken(await getSessionCookieValue());
  return NextResponse.json(await getBootstrapPayload(playerContext));
}
