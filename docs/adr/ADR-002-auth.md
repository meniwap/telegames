# ADR-002: Telegram Auth and Session Design

## Decision

Use Telegram Mini App init-data validation on the server and issue a server-managed session cookie.

## Rationale

- Telegram provides a strong identity proof for Mini App launches.
- Server-managed sessions prevent feature code from depending on raw init-data everywhere.
- The model supports a Telegram-native admin allowlist without introducing a separate operator auth system.

## Consequences

- `initDataUnsafe` is never authoritative.
- Sensitive routes require a valid server session.
- Admin access derives from the same player identity plus allowlisted ops membership.
