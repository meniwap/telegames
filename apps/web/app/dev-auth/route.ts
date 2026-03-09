import { NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth/session";
import { validateTelegramInitData } from "@/lib/auth/telegram";
import { getEnv } from "@/lib/env";
import { authenticateTelegram } from "@/lib/server/store";

export async function GET(request: Request) {
  const env = getEnv();

  if (!env.ALLOW_DEV_AUTH || !env.NEXT_PUBLIC_DEV_INIT_DATA) {
    return NextResponse.json({ error: "dev_auth_disabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  const nextPath = url.searchParams.get("next") ?? "/";
  const identity = validateTelegramInitData(env.NEXT_PUBLIC_DEV_INIT_DATA);
  const authResult = await authenticateTelegram(identity);
  await setSessionCookie(authResult.sessionToken);

  return NextResponse.redirect(new URL(nextPath, env.APP_URL));
}
