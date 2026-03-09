import { NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth/session";
import { validateTelegramInitData } from "@/lib/auth/telegram";
import { appendAuditEvent, authenticateTelegram } from "@/lib/server/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { initData?: string };
    if (!body.initData) {
      return NextResponse.json({ error: "missing_init_data" }, { status: 400 });
    }

    const identity = validateTelegramInitData(body.initData);
    const authResult = await authenticateTelegram(identity);
    await setSessionCookie(authResult.sessionToken);
    await appendAuditEvent({
      playerId: authResult.player.id,
      sessionId: authResult.session.id,
      eventType: "telegram_auth",
      payload: {
        telegramUserId: identity.telegramUserId
      }
    });

    return NextResponse.json({
      ok: true,
      playerId: authResult.player.id,
      isAdmin: authResult.isAdmin
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "telegram_auth_failed" },
      { status: 401 }
    );
  }
}
