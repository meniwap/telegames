# ADR-005: Multi-Game Core Refactor

## Decision

Refactor the platform in place so that shared routes, stores, payloads, and database lifecycle tables are game-generic, while racer-specific simulation and stats move into isolated module extensions.

## Rationale

- The repository already had production-grade foundations worth preserving.
- The architectural problem was shape, not quality: too many contracts described the entire platform in racer terms.
- Future non-racing games need shared auth, wallet, progression, leaderboard, analytics, and ops systems without inheriting racer-only naming or data columns.

## Consequences

- `packages/game-core` now contains genre-agnostic contracts only.
- `packages/game-racer-core` owns deterministic racer logic and replay verification.
- Public browser-facing APIs move to `/api/games/[gameSlug]/...`.
- Shared lifecycle tables become `game_sessions`, `game_submissions`, and `game_results`.
- Racer-only counters move to `racer_player_stats` instead of staying in `game_profiles`.
