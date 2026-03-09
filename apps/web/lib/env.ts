import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  APP_NAME: z.string().default("Telegramplay"),
  TELEGRAM_BOT_TOKEN: z.string().min(1).default("dev-bot-token"),
  TELEGRAM_BOT_USERNAME: z.string().min(1).default("graphite_bot"),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().min(1).default("graphite_bot"),
  NEXT_PUBLIC_APP_THEME: z.string().default("graphite-racer"),
  NEXT_PUBLIC_GAME_TITLE_SLUG: z.string().default("racer-poc"),
  DATABASE_URL: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().default("tg_session"),
  SESSION_TTL_HOURS: z.coerce.number().default(24),
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().default(300),
  ALLOW_DEV_AUTH: z.stringbool().default(false),
  NEXT_PUBLIC_DEV_INIT_DATA: z.string().optional(),
  DEV_AUTH_SECRET: z.string().optional(),
  OPS_ADMIN_TELEGRAM_IDS: z.string().default(""),
  LOG_LEVEL: z.string().default("info"),
  DEPLOYMENT_VERSION: z.string().default("dev"),
  VERCEL_GIT_COMMIT_SHA: z.string().default("local"),
  USE_MEMORY_STORE: z.stringbool().default(true)
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}

export type AppEnv = ReturnType<typeof getEnv>;
