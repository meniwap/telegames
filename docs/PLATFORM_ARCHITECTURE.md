# PLATFORM_ARCHITECTURE

## High-level architecture

- `apps/web` is both the Telegram Mini App shell and the trusted backend-for-frontend.
- Route handlers validate Telegram identity, manage server-owned game sessions, accept official submissions, expose leaderboards, and serve ops metrics.
- Shared packages isolate design, UI, genre-agnostic game contracts, game-specific authoritative logic, telemetry, and game rendering.
- Supabase Postgres is the persistent system of record. The browser does not talk to it directly for sensitive workflows.

## Telegram Mini App flow

1. Telegram opens the Mini App and provides signed `initData`.
2. The client bootstrap posts `initData` to `POST /api/auth/telegram`.
3. The server validates the signature against the bot token, upserts the player, creates a server-managed session, and sets an `HttpOnly` cookie.
4. The client refreshes and the portal now renders authenticated state.

## Authentication and session flow

- Identity proof comes from Telegram Mini App init data only.
- `initDataUnsafe` is never trusted.
- The app stores a hashed opaque session token in `auth_sessions`.
- Session cookies are secure, `HttpOnly`, same-site `lax`, and rotated through server logic.
- Admin access is derived from the same Telegram identity plus allowlisted ops membership.

## Official result flow

1. `POST /api/games/[gameSlug]/sessions` creates a `game_sessions` row with authoritative config, seed, module id, and expiry.
2. The client runs the local renderer for the selected module. The racer uses Phaser via `packages/game-racer`, while the memory, hopper, signal-stacker, and vector-shift modules use lightweight touch-first renderers from their dedicated packages.
3. The client submits recorded inputs and a client summary to `POST /api/games/[gameSlug]/sessions/[sessionId]/submissions`.
4. The server resolves the module by slug and replays or validates the submission against the authoritative config.
5. The server alone writes `game_submissions`, `game_results`, `wallet_ledger`, progression updates, cheat flags, and audit events.

## Persistence model

- `players` and `telegram_accounts` store identity snapshots.
- `game_profiles` store generic per-title progression.
- `racer_player_stats` stores racer-only counters and best-result data as a module extension table.
- `memory_player_stats` stores memory-only counters and best-result data as a module extension table.
- `hopper_player_stats` stores hopper-only counters and best-result data as a module extension table.
- `signal_stacker_player_stats` stores stacking-only counters and best-result data as a module extension table.
- `vector_shift_player_stats` stores lane-dodger-only counters and best-result data as a module extension table.
- `wallets` and `wallet_ledger` provide wallet balance plus append-only reward history.
- `game_sessions`, `game_submissions`, and `game_results` form the authoritative platform lifecycle.
- `racer_tracks` stores authoritative track snapshots for the racer module only.
- `audit_events` and `cheat_flags` record lifecycle and anti-cheat visibility.

## Analytics and logging

- Structured JSON logs include request, player, game session, and module correlation where available.
- `client_error_reports` stores Mini App client failures.
- KPI views and analytics tables support the ops surface without ad hoc SQL spelunking.

## Admin and ops model

- The protected ops route uses the same Telegram session as players.
- Admin membership is allowlist-based.
- KPI cards, top players, recent sessions, suspicious runs, and client errors are first-class ops concepts.

## Theme and design architecture

- Raw tokens live in `packages/design-tokens`.
- Semantic mapping and component/HUD recipes live in `packages/theme-engine`.
- Shared UI components consume semantic recipes only.
- Future themes should be introduced by swapping manifests, not rewriting routes.

## Mobile Telegram play shell

- Portal routes may use the shared site chrome, but active `/games/[gameSlug]/play` routes are immersive shells.
- Immersive play routes hide the global nav, lock document scrolling, and consume safe-area insets so the game is comfortable inside Telegram mobile clients.
- Gameplay status, instructions, retry, and result presentation stay inside the same fullscreen surface instead of being split into long scrolled sections.
- Telegram WebApp expansion and swipe suppression are part of the play-shell behavior, not optional page-level decoration.

## Future expansion

- Add new games by implementing the registry contract in a dedicated module, then wiring a new render package and optional module-specific extension tables. The current repo demonstrates a Phaser action module (`racer-poc`), a React board module (`memory`), and three lightweight canvas modules (`skyline-hopper`, `signal-stacker`, and `vector-shift`).
- Reuse the existing auth, profile, wallet, leaderboard, analytics, and ops infrastructure.
- Keep game-specific rendering isolated from the platform shell and authoritative write flows.
