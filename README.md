# Telegramplay Platform

Telegramplay is a Telegram Mini App game platform built for long-term expansion. The repository now ships seven playable modules today: a racer, a 4x4 memory game, a toy-bird endless hopper, a precision stacking challenge, a neon lane-dodger, an orbital survival run, and a prism-break chamber, plus the platform shell needed for future games: shared identity, server-authoritative results, progression, wallet ledger, leaderboards, analytics, ops visibility, centralized theming, and repo-native documentation.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Phaser 3.90
- Supabase Postgres with SQL migrations and RLS
- Vercel deployment target
- GitHub Actions CI
- Pino structured logging
- Vitest + Playwright

## Repository layout

```text
apps/web                 Telegram Mini App shell and trusted BFF
packages/design-tokens   Raw design primitives
packages/theme-engine    Semantic token mapping and theme manifests
packages/ui              Reusable platform UI
packages/game-core       Genre-agnostic game contracts and official-result types
packages/game-racer-core Deterministic racer simulation and official verification
packages/game-racer      Phaser renderer for the racer POC
packages/game-memory-core Deterministic memory-game verification and reward logic
packages/game-memory     Memory game board renderer
packages/game-hopper-core Deterministic hopper simulation and official verification
packages/game-hopper     Canvas renderer for Skyline Hopper
packages/game-signal-stacker-core Deterministic stacking verification and reward logic
packages/game-signal-stacker Canvas renderer for Signal Stacker
packages/game-vector-shift-core Deterministic lane-dodger verification and reward logic
packages/game-vector-shift Canvas renderer for Vector Shift
packages/game-orbit-forge-core Deterministic orbital survival verification and reward logic
packages/game-orbit-forge Canvas renderer for Orbit Forge
packages/game-prism-break-core Deterministic prism-break verification and reward logic
packages/game-prism-break Canvas renderer for Prism Break
packages/telemetry       Structured logger helpers
docs/                    Architecture, style canon, data model, operations
supabase/migrations      Schema and RLS source of truth
scripts/                 Bot setup and local dev helpers
```

## Quick start

1. `cp .env.example .env.local`
2. Fill at least:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_BOT_USERNAME`
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
   - `APP_URL`
3. For local development without Postgres, keep `USE_MEMORY_STORE=true`.
4. Generate dev Mini App init data:

```bash
pnpm tsx scripts/generate-dev-initdata.ts
```

5. Put the output into `NEXT_PUBLIC_DEV_INIT_DATA` in `.env.local`.
6. Install and run:

```bash
pnpm install
pnpm dev
```

7. Open [http://localhost:3000](http://localhost:3000).

## Local secrets source of truth

- Machine-only secrets for this workspace are stored in `/Users/meniwap/telegramplay/.local/SECRETS.local.md`.
- Machine-only operational runbook notes for git push, Vercel deploys, and Supabase targeting are stored in `/Users/meniwap/telegramplay/.local/AGENT_RUNBOOK.local.md`.
- That file is gitignored and must never be committed.
- When credentials rotate, update that file first so future work does not depend on shell history or memory.

## Core commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @telegramplay/web test:e2e
pnpm build
```

## Telegram BotFather setup

1. Create a bot with BotFather and capture the token.
2. Set the Mini App domain to your deployed `APP_URL`.
3. Set a menu button pointing to the Mini App URL.
4. Configure the bot automatically:

```bash
pnpm tsx scripts/configure-bot.ts
```

The script sets:

- webhook: `APP_URL/api/bot/webhook`
- commands: `/start`, `/help`
- menu button: `Open Mini App`

## Supabase setup

1. Create a Supabase project.
2. In the Supabase dashboard, open `Connect`, then copy the pooled Postgres connection string for serverless workloads. Set that value as `DATABASE_URL`.
3. If you need API keys for future Supabase Data API / `supabase-js` work, keep the project env names aligned with the deployed app:
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - if you later migrate to the newer Supabase naming scheme, update the repo docs and `turbo.json` in the same change
4. Apply the SQL migrations in `supabase/migrations` in order.
5. Apply `supabase/seed.sql`.
6. Set `USE_MEMORY_STORE=false` in production.

For the current architecture, only `DATABASE_URL` is required for the production runtime and migrations. The platform talks to Postgres directly from the server; it does not currently use Supabase API keys at runtime.

## Deployment notes

- Vercel hosts the Next.js app.
- Production Vercel functions are pinned to the Frankfurt region (`fra1`) to stay close to the Supabase `eu-central-1` project.
- Supabase hosts Postgres and RLS policies.
- The app is configured for Supabase transaction pooling on serverless, so prepared statements are disabled in the Postgres client.
- The browser never receives database admin credentials.
- In production, route handlers use trusted server env only.

## Further docs

- [Style Canon](/Users/meniwap/telegramplay/docs/STYLE_CANON.md)
- [Platform Architecture](/Users/meniwap/telegramplay/docs/PLATFORM_ARCHITECTURE.md)
- [Game Platform Guide](/Users/meniwap/telegramplay/docs/GAME_PLATFORM_GUIDE.md)
- [Data Model](/Users/meniwap/telegramplay/docs/DATA_MODEL.md)
- [Operations Guide](/Users/meniwap/telegramplay/docs/OPERATIONS_GUIDE.md)
