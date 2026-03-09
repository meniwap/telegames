# ADR-004: Centralized Design System

## Decision

Separate raw tokens, theme mapping, and reusable UI into distinct workspace packages.

## Rationale

- Theme changes should not require route-by-route restyling.
- Future LLM contributors need a clear place to evolve brand direction safely.
- Shared shell, HUD, leaderboard, and profile patterns should remain visually coherent across future games.

## Consequences

- Raw palette and spacing values live only in `packages/design-tokens`.
- Semantic slot mapping and component recipes live only in `packages/theme-engine`.
- Feature code consumes shared UI and semantic tokens instead of raw primitives.
