# OPERATIONS_GUIDE

## Logs

- All server flows should emit structured JSON logs through the shared telemetry package.
- Include request ID, player ID, game session ID, and module slug where possible.
- Rejections should log the reason explicitly.

## Analytics

- Use `leaderboard_best_results_*` views and `ops_kpis` for routine operational reads.
- `client_error_reports` captures Mini App failures.
- `audit_events` captures auth and game lifecycle transitions.

## Common stats in the ops surface

- total players
- new players today
- DAU / WAU
- session starts
- accepted results
- completion rate
- average official session duration
- top players
- rewards granted
- suspicious runs
- rejected submissions
- client errors

## Debugging approach

- Confirm Telegram auth validation before debugging downstream state.
- Verify `game_sessions` exist before looking at submissions.
- For result disputes, inspect `game_submissions`, `game_results`, `cheat_flags`, and matching audit events together.
- For UI failures, inspect `client_error_reports` and server logs in the same time window.

## Deployment notes

- Vercel hosts the Next.js application.
- Supabase hosts the production database and RLS policies.
- Keep `USE_MEMORY_STORE=false` in real environments.
- Ensure bot webhook and menu button both point to the current deployed `APP_URL`.

## Incident triage basics

- Auth issue: verify bot token, domain, and init-data age window.
- Missing rewards: verify `wallet_ledger` entries for the session ID.
- Leaderboard issue: verify `game_results.status='accepted'` and the relevant leaderboard view.
- Ops access issue: verify `admin_users` membership and session validity.
