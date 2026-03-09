# STYLE_CANON

## Brand essence

The active `graphite-racer` theme should make the platform feel dense, sharp, technical, and tactile. The first game is motorsport-inspired, but the surrounding product language must still support future non-racing modules.

## Visual keywords

- Graphite
- enamel
- beveled
- telemetry-lit
- compact
- premium toy-arcade
- fast but disciplined

## Emotional tone

- Confident, not loud
- Energetic, not chaotic
- Mechanical, not sterile
- Competitive, not hostile

## Color strategy

- Base surfaces sit in graphite and steel ranges.
- Primary action comes from enamel orange.
- Secondary telemetry and system signal comes from cyan.
- Success, warning, and danger remain semantic accents, never primary surfaces.
- Raw palette values live in `packages/design-tokens`; feature code should consume semantic slots only.

## Typography philosophy

- Display typography uses angular arcade-industrial forms for titles and metrics.
- Body typography stays clean and highly legible on mobile.
- Monospace is reserved for telemetry, IDs, and operational data.

## Spacing principles

- Tight by default, breathing room at section boundaries.
- Cards should feel dense and information-rich without becoming cramped.
- HUD spacing is smaller than portal spacing but uses the same token ladder.

## Radius language

- Rounded but machined.
- Cards and panels use beveled-feeling medium radii.
- Chips and badges may go pill-shaped.

## Elevation and shadow language

- Use soft depth for structural separation.
- Reserve glow for primary action, HUD emphasis, or telemetry accents.
- Avoid flat white borders and generic drop shadows.

## Motion principles

- Motion is short, intentional, and directional.
- Loading and transitions should feel like systems engaging, not decorative bouncing.
- The game should prioritize responsiveness over showiness.

## Shared patterns

### HUD

- Semi-translucent graphite panels
- High-contrast metric numerals
- Accent highlights only where the eye must go next

### Cards

- Elevated graphite surfaces
- Fine border separation
- Dense information grouping

### Buttons

- Primary: enamel orange
- Secondary: structural graphite
- Ghost: text-led, low-emphasis

### Modals

- Use elevated surfaces with crisp hierarchy and one dominant action.

### Forms

- Inputs should inherit platform radii and borders.
- Error and success states must use semantic color roles only.

### Leaderboard

- Rank-first layout
- Dense, readable rows
- Top placements may get accent treatment without turning into a casino UI

### Profile

- Progression, wallet, and identity should feel like a control panel, not a social feed

### Catalog

- Treat each game as a premium tile within a disciplined shell

### Empty states

- Calm and explicit
- Avoid jokes or filler copy

### Loading states

- Prefer polished structural placeholders over spinners-only

### Error states

- Clear, sober, actionable

### Game screens

- Mobile portrait inside Telegram Mini Apps is the default design target.
- Play routes should behave like immersive game surfaces, not long-form portal pages.
- Hide global site chrome during active play and keep the playable surface within a single non-scrolling viewport.
- Respect `safe-area-inset-*` values and Telegram viewport behavior before adding decorative layout.
- Primary controls belong within thumb reach near the bottom edge, with large touch targets and no hover dependence.
- HUD should be compact, layered over the game, and legible without blocking the critical playfield.
- If instructions are needed, expose them behind an explicit help affordance such as an info button, not a tall content block above the canvas.
- Result, retry, and recovery states should stay in the same immersive surface without forcing a page-length scroll.

## Future game consistency

Every future game must still feel like it belongs to the same product line by sharing:

- semantic tokens
- typography system
- component recipes
- card/HUD language
- result and reward presentation patterns

## Safe evolution rules

- If a future LLM changes the visual direction, it must update tokens, theme manifests, and this document together.
- Do not scatter raw palette or motion constants across routes and feature components.
- New themes should be introduced as manifests, not ad hoc file rewrites.
- Any gameplay route redesign must be reviewed on a phone-sized Telegram WebView before it is considered done.

## Changelog

- 2026-03-09: Initial `graphite-racer` platform canon added with `bright-toy-racer` scaffold theme for swapability proof.
- 2026-03-09: Locked immersive mobile-first rules for all `/play` routes: full-viewport layout, safe-area awareness, bottom-anchored controls, and in-surface help instead of stacked content.
