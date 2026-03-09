# GAME_PLATFORM_GUIDE

## How to add a new game

1. Add or extend a module core package for authoritative logic. `packages/game-core` stays generic; genre-specific logic belongs in a sibling package such as `packages/game-racer-core` or `packages/game-memory-core`.
2. Add a render/input package if the game needs a dedicated client runtime, as shown by `packages/game-racer` and `packages/game-memory`.
3. Register the module in the game registry and implement:
   - `createSessionConfig`
   - `parseSubmissionPayload`
   - `verifySubmission`
   - module-specific profile and ops stat builders
4. Register the title in `game_titles` and add any module seed data or extension tables.
5. Reuse the generic routes under `apps/web/app/api/games/[gameSlug]/...` and add portal pages under `/games/[gameSlug]`.

## Play route structure

- `/games/[gameSlug]/play` is an immersive runtime route, not a normal portal article page.
- Active play must occupy a single mobile-first viewport with no page-length vertical scroll.
- Hide global site chrome on immersive play routes and keep instructions, retry, validation state, and controls inside the same surface.
- Respect Telegram safe areas and WebView constraints before adding decorative hero copy or extra panels.
- Keep primary controls bottom-anchored, touch-first, and comfortably reachable with thumbs.
- If a game needs extra module-specific help, expose it behind a concise in-game help button rather than stacking explanatory cards above the canvas.

## Required shared systems

Every new game must integrate with:

- Telegram-authenticated player identity
- server-managed sessions
- shared profile and progression
- wallet and append-only ledger
- official leaderboard flow
- telemetry and audit events
- ops visibility
- centralized design tokens and shared UI

## Consistency rules

- Do not bypass the platform shell with a game-specific standalone auth flow.
- Do not mint rewards inside the client renderer.
- Do not hardcode a new design language in feature pages; extend the theme layer instead.
- Reuse shared result, reward, and error presentation patterns.

## Data integration expectations

- Register title metadata in `game_titles`.
- Add per-game progression in `game_profiles`.
- Persist official sessions, inputs, and results in the shared `game_sessions`, `game_submissions`, and `game_results` lifecycle tables.
- If a game needs extra counters or content, add an extension table such as `racer_player_stats` or `memory_player_stats` instead of polluting `game_profiles`.
- Emit audit and client error events in the existing taxonomy.

## Avoiding platform drift

- If new mechanics require a new authoritative flow, document it in an ADR before spreading implementation changes.
- Shared UI additions belong in `packages/ui`, not directly in route files.
- Shared game contracts belong in packages, not local app utilities.
- Do not add new public API endpoints shaped around a single game when the generic `/api/games/[gameSlug]/...` surface can carry the workflow.
