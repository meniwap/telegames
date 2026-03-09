# ADR-001: Stack Selection

## Decision

Retain the preferred stack:

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Phaser 3.90
- Supabase Postgres with SQL migrations and RLS
- Vercel
- GitHub Actions

## Rationale

- Next.js App Router provides a clean split between server-rendered portal concerns and client-only Phaser rendering.
- Phaser remains the most pragmatic stable choice for a performant Telegram WebView racer.
- Supabase gives managed Postgres plus operational familiarity without forcing browser trust.
- Tailwind 4 works well with centralized semantic CSS variables and package-driven component recipes.

## Consequences

- The browser stays off direct Supabase writes.
- Server routes act as the trusted BFF.
- Deterministic game logic lives in workspace packages so it can be shared by client and server.
