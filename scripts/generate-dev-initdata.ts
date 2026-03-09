import { getEnv } from "../apps/web/lib/env";
import { buildTelegramInitData } from "../apps/web/lib/auth/dev-init-data";

const env = getEnv();

const initData = buildTelegramInitData({
  botToken: env.TELEGRAM_BOT_TOKEN,
  user: {
    id: 424242,
    username: "graphite_dev",
    first_name: "Graphite",
    last_name: "Dev"
  }
});

process.stdout.write(initData);
