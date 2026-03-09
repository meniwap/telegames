import { beforeEach, describe, expect, it } from "vitest";

import { buildTelegramInitData } from "../lib/auth/dev-init-data";
import { validateTelegramInitData } from "../lib/auth/telegram";

describe("Telegram init data validation", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_BOT_USERNAME = "graphite_bot";
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "graphite_bot";
    process.env.ALLOW_DEV_AUTH = "true";
  });

  it("accepts a valid init data payload", () => {
    const initData = buildTelegramInitData({
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      user: {
        id: 10101,
        username: "racer_dev",
        first_name: "Racer",
        last_name: "Dev"
      }
    });

    const identity = validateTelegramInitData(initData);

    expect(identity.telegramUserId).toBe("10101");
    expect(identity.displayName).toBe("Racer Dev");
  });

  it("rejects tampered init data", () => {
    const initData = `${buildTelegramInitData({
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      user: {
        id: 20202,
        first_name: "Tamper"
      }
    })}&extra=bad`;

    expect(() => validateTelegramInitData(initData)).toThrowError("invalid_hash");
  });
});
