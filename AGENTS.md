# Repository Discipline

This repository is a Telegram Mini App game platform, not a single-page demo. All contributors, human or LLM, must preserve the platform boundaries below.

## Architectural boundaries

- `apps/web` owns the Telegram Mini App shell, route handlers, server sessions, bot webhook entrypoints, and page composition.
- `packages/design-tokens` is the raw source of truth for palette, spacing, radii, typography, motion, borders, depth, and semantic slot names.
- `packages/theme-engine` maps raw tokens into semantic roles, component recipes, HUD recipes, and theme manifests.
- `packages/ui` contains reusable platform components only. Feature code may compose them, not restyle them with raw design primitives.
- `packages/game-core` owns shared platform-level game contracts, leaderboard windows, official-result types, and module interfaces. It must stay genre-agnostic.
- `packages/game-racer-core` owns deterministic racer simulation, replay verification, reward tuning, and racer-specific authoritative logic.
- `packages/game-racer` owns Phaser rendering and player input capture only. It must never mint rewards or decide an official result.
- `packages/game-memory-core` owns deterministic memory-game verification, board generation, and reward logic.
- `packages/game-memory` owns the memory board renderer and touch interaction surface only. It must never mint rewards or decide an official result.
- `packages/game-hopper-core` owns deterministic hopper simulation, obstacle stream generation, replay verification, and reward tuning.
- `packages/game-hopper` owns the lightweight Canvas renderer and tap-input surface only. It must never mint rewards or decide an official result.
- `packages/game-signal-stacker-core` owns deterministic stacking verification, timing windows, replay verification, and reward tuning.
- `packages/game-signal-stacker` owns the Signal Stacker canvas renderer and tap-input surface only. It must never mint rewards or decide an official result.
- `packages/game-vector-shift-core` owns deterministic lane streams, replay verification, and reward tuning.
- `packages/game-vector-shift` owns the Vector Shift canvas renderer and touch-input surface only. It must never mint rewards or decide an official result.
- `supabase/migrations` is the source of truth for schema changes. Never ship uncommitted database changes.

## Security red lines

- Never trust the browser for final score, rewards, progression, unlocks, or leaderboard position.
- Never expose bot tokens, service keys, or database admin credentials to the client.
- Never let the browser write directly to sensitive tables.
- All official progression changes must happen through trusted server code.
- Session cookies must remain `HttpOnly`, scoped, and short-lived enough to rotate safely.
- Local machine-only credentials for this repo live in `/Users/meniwap/telegramplay/.local/SECRETS.local.md`. Keep that file out of git, update it when credentials change, and check it before searching shell history or external dashboards.
- Local machine-only operational handoff notes live in `/Users/meniwap/telegramplay/.local/AGENT_RUNBOOK.local.md`. Check that file before doing git push, Vercel deploys, or Supabase operations so you use the correct project targets and release flow.

## Design system rules

- Do not hardcode colors, shadows, spacing, radii, typography, or motion values in feature code if a shared token or recipe already exists.
- If a visual direction changes, update `packages/design-tokens`, `packages/theme-engine`, and [docs/STYLE_CANON.md](/Users/meniwap/telegramplay/docs/STYLE_CANON.md) together.
- Shared components and HUD surfaces must consume semantic tokens such as `--surface-primary`, `--text-primary`, `--accent-primary`, `--hud-bg`, and `--card-radius`.
- New game screens must feel like part of the same product line even when their mechanics differ.

## Mobile-first Telegram rules

- Treat mobile portrait inside Telegram Mini App WebView as the primary target. Desktop is secondary.
- Play routes such as `/games/[gameSlug]/play` must be immersive game screens, not generic portal pages with stacked shell content.
- Immersive play routes must hide global site chrome, consume safe-area insets, lock page scrolling, and keep core controls thumb-friendly.
- Do not rely on hover, mouse precision, or desktop-only affordances for a critical gameplay flow.
- Game HUD must stay readable under fingers and avoid burying primary actions below off-screen scroll.
- If a game needs instructions, use an explicit in-game help affordance such as an info button or overlay, not a long content section above or below the playable surface.
- Any future UI or design change must be evaluated first against Telegram mobile constraints: safe area, touch targets, one-hand use where practical, interruption recovery, and WebView performance.

## Coding conventions

- Prefer server-side composition and service modules over page-local fetch chains.
- Keep deterministic game logic pure and serializable.
- Prefer append-only ledgers and audit records for reconstructable history.
- Add tests for auth, game-session lifecycle, and reward logic whenever the underlying rules change.
- Keep logs structured. Include request, player, game session, and module correlation where available.

## Safe extension rules

- New games must plug into the shared profile, wallet, leaderboard, analytics, and theme systems before adding bespoke infrastructure.
- Platform routes, stores, and docs must use `game` or `session` terminology, not `race`, unless the code is explicitly racer-specific.
- If a second game needs new platform contracts, document them in [docs/GAME_PLATFORM_GUIDE.md](/Users/meniwap/telegramplay/docs/GAME_PLATFORM_GUIDE.md) and the relevant ADR.
- If you introduce a new architectural pattern, capture the decision in `docs/adr/`.
- If you touch schema, update [docs/DATA_MODEL.md](/Users/meniwap/telegramplay/docs/DATA_MODEL.md) and commit the migration in the same change.

## Definition of done

- Telegram auth remains server-validated.
- Official results remain server-authoritative.
- Tests and typecheck pass.
- Docs stay aligned with the code.
- Visual changes remain centralized and consistent.
