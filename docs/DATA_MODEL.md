# DATA_MODEL

## Core identity

- `players`: internal player record, Telegram ID snapshot, display metadata, progression summary
- `telegram_accounts`: explicit Telegram account mapping and snapshot history anchor
- `auth_sessions`: opaque hashed session storage
- `admin_users`: Telegram-native allowlist for internal ops access

## Catalog and progression

- `game_titles`: portal catalog metadata
- `game_profiles`: per-player, per-title generic progression
- `racer_player_stats`: racer-only counters and best-result summary
- `memory_player_stats`: memory-only counters and best-result summary
- `hopper_player_stats`: hopper-only counters and best-result summary
- `wallets`: current soft-currency balance
- `wallet_ledger`: append-only reward history
- `player_unlocks`: unlock state for future cosmetics and content
- `cosmetics`: catalog of cosmetic items and future visual unlockables

## Shared authoritative lifecycle

- `game_sessions`: official server-created sessions for any game module
- `game_submissions`: submitted authoritative payloads
- `game_results`: server-authoritative official results with generic ranking fields

## Racer extension entities

- `racer_tracks`: authoritative track snapshots and config versions for the racer module

## Integrity and observability

- `audit_events`: structured lifecycle events
- `cheat_flags`: suspicious or rejected run markers
- `client_error_reports`: reported Mini App client issues
- `analytics_daily_rollups`: daily aggregate storage
- `analytics_game_rollups`: per-game aggregate storage

## Relationship summary

- One `player` has one `wallet`, many `auth_sessions`, many `game_profiles`, many `game_sessions`, many `game_results`, many `wallet_ledger` entries, and optional module-extension rows.
- One `game_session` has at most one `game_submissions` row and one `game_results` row.
- One `game_title` has many `game_profiles`, many `game_sessions`, and optional extension entities such as `racer_tracks`, `racer_player_stats`, `memory_player_stats`, and `hopper_player_stats`.

## Reconstructability

- Reward history is reconstructed from `wallet_ledger`.
- Official game history is reconstructed from `game_sessions`, `game_submissions`, and `game_results`.
- Racer-specific history enrichments come from `racer_player_stats` and `racer_tracks`.
- Memory-specific history enrichments come from `memory_player_stats`.
- Hopper-specific history enrichments come from `hopper_player_stats`.
- Suspicious activity is reconstructed from `cheat_flags` and `audit_events`.
