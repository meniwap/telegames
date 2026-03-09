# ADR-003: Official Results Flow

## Decision

Use authoritative server-created game sessions plus replay-based submission verification, with the racer module as the first implementation.

## Rationale

- The client must remain responsive inside Telegram WebView.
- The server must retain final authority over placement, rewards, progression, and leaderboard writes.
- Replay submission is a practical midpoint between naive trust and full remote simulation streaming.

## Consequences

- The client records input frames only.
- The server resolves the selected game module and replays or validates from a pinned config snapshot.
- Duplicate, stale, mismatched, or implausible submissions are rejected or flagged.
