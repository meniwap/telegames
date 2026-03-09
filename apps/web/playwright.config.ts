import { defineConfig } from "@playwright/test";

import { buildTelegramInitData } from "./lib/auth/dev-init-data";

const botToken = "playwright-bot-token";
const initData = buildTelegramInitData({
  botToken,
  user: {
    id: 515151,
    username: "pw_runner",
    first_name: "Playwright",
    last_name: "Runner"
  }
});

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true
  },
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: true,
    env: {
      ...process.env,
      APP_URL: "http://127.0.0.1:3000",
      TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_BOT_USERNAME: "graphite_bot",
      NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: "graphite_bot",
      NEXT_PUBLIC_APP_THEME: "graphite-racer",
      ALLOW_DEV_AUTH: "true",
      NEXT_PUBLIC_DEV_INIT_DATA: initData,
      USE_MEMORY_STORE: "true"
    }
  }
});
