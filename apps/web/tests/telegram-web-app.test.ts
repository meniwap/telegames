import { describe, expect, it } from "vitest";

import { enterTelegramImmersiveMode, resolveTelegramInitData } from "../lib/client/telegram-web-app";

describe("Telegram WebApp init data resolution", () => {
  it("returns Telegram init data immediately when available", async () => {
    await expect(
      resolveTelegramInitData({
        getWebApp: () => ({
          initData: "telegram-init-data",
          ready: () => undefined,
          expand: () => undefined
        }),
        maxAttempts: 1,
        intervalMs: 0
      })
    ).resolves.toBe("telegram-init-data");
  });

  it("waits briefly for the bridge to expose init data", async () => {
    let attempts = 0;

    await expect(
      resolveTelegramInitData({
        getWebApp: () => {
          attempts += 1;
          return attempts >= 3
            ? {
                initData: "delayed-init-data",
                ready: () => undefined,
                expand: () => undefined
              }
            : {
                initData: "",
                ready: () => undefined,
                expand: () => undefined
              };
        },
        maxAttempts: 4,
        intervalMs: 0
      })
    ).resolves.toBe("delayed-init-data");
  });

  it("falls back to local dev init data only after Telegram init data stays unavailable", async () => {
    await expect(
      resolveTelegramInitData({
        getWebApp: () => null,
        devInitData: "local-dev-init-data",
        maxAttempts: 2,
        intervalMs: 0
      })
    ).resolves.toBe("local-dev-init-data");
  });

  it("throws a stable error when neither Telegram nor local init data exists", async () => {
    await expect(
      resolveTelegramInitData({
        getWebApp: () => null,
        devInitData: undefined,
        maxAttempts: 2,
        intervalMs: 0
      })
    ).rejects.toThrowError("telegram_init_data_unavailable");
  });

  it("expands the Telegram viewport and disables vertical swipes for immersive play", () => {
    const calls: string[] = [];

    const teardown = enterTelegramImmersiveMode({
      getWebApp: () => ({
        ready: () => calls.push("ready"),
        expand: () => calls.push("expand"),
        disableVerticalSwipes: () => calls.push("disable"),
        enableVerticalSwipes: () => calls.push("enable")
      })
    });

    expect(calls).toEqual(["ready", "expand", "disable"]);

    teardown();

    expect(calls).toEqual(["ready", "expand", "disable", "enable"]);
  });
});
