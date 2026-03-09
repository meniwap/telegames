import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSessionCookieValue } from "@/lib/auth/session";
import { submitGameSessionForPlayer } from "@/lib/server/game-service";
import { getPlayerContextFromToken } from "@/lib/server/store";

const SAFE_ERROR_CODES = new Set([
  "invalid_submission_payload",
  "session_mismatch",
  "session_not_found",
  "unauthorized"
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameSlug: string; sessionId: string }> }
) {
  try {
    const { gameSlug, sessionId } = await params;
    const rawPayload = (await request.json()) as { sessionId?: string };
    if (rawPayload.sessionId !== sessionId) {
      return NextResponse.json({ error: "session_mismatch" }, { status: 400 });
    }

    const playerContext = await getPlayerContextFromToken(await getSessionCookieValue());
    const result = await submitGameSessionForPlayer(playerContext, gameSlug, rawPayload);
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "invalid_submission_payload" }, { status: 400 });
    }

    const code = error instanceof Error ? error.message : "submit_session_failed";

    return NextResponse.json(
      { error: SAFE_ERROR_CODES.has(code) ? code : "submit_session_failed" },
      { status: code === "unauthorized" ? 401 : 400 }
    );
  }
}
