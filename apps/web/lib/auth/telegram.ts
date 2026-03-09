import { createHmac, timingSafeEqual } from "node:crypto";

import { getEnv } from "../env";
import type { TelegramIdentity } from "../types";

type TelegramWebAppUser = {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
};

export function validateTelegramInitData(initData: string): TelegramIdentity {
  const env = getEnv();
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    throw new Error("missing_hash");
  }

  const authDate = Number(params.get("auth_date") ?? "0");

  if (!Number.isFinite(authDate) || authDate <= 0) {
    throw new Error("invalid_auth_date");
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS && !(env.ALLOW_DEV_AUTH && env.NODE_ENV !== "production")) {
    throw new Error("stale_init_data");
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(env.TELEGRAM_BOT_TOKEN).digest();
  const computed = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (!timingSafeEqual(Buffer.from(computed), Buffer.from(hash))) {
    throw new Error("invalid_hash");
  }

  const rawUser = params.get("user");
  if (!rawUser) {
    throw new Error("missing_user");
  }

  const user = JSON.parse(rawUser) as TelegramWebAppUser;
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  return {
    telegramUserId: String(user.id),
    username: user.username ?? null,
    displayName,
    avatarUrl: user.photo_url ?? null,
    authDate
  };
}
