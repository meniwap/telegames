import { NextResponse } from "next/server";

import { shouldPersistClientErrorReport } from "@/lib/client-error-filter";
import { getSessionCookieValue } from "@/lib/auth/session";
import { getPlayerContextFromToken, reportClientError } from "@/lib/server/store";

export async function POST(request: Request) {
  try {
    const playerContext = await getPlayerContextFromToken(await getSessionCookieValue());
    const payload = (await request.json()) as {
      route: string;
      message: string;
      stack?: string | null;
      userAgent?: string | null;
    };
    if (!shouldPersistClientErrorReport(payload)) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    await reportClientError(playerContext, {
      route: payload.route,
      message: payload.message,
      stack: payload.stack ?? null,
      userAgent: payload.userAgent ?? null
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
