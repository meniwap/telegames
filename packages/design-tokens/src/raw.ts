export const palette = {
  graphite950: "#090b12",
  graphite900: "#111520",
  graphite850: "#171d29",
  graphite800: "#1f2836",
  graphite700: "#2b384d",
  steel500: "#6e7b91",
  steel300: "#b4c0d2",
  ivory100: "#f7f5ee",
  orange500: "#ff8a3d",
  orange400: "#ff9d57",
  cyan500: "#4ad2ff",
  cyan400: "#88e2ff",
  emerald500: "#43d39e",
  crimson500: "#ff5d6c",
  amber500: "#f7b84b",
  shadowInk: "rgba(3, 6, 12, 0.62)",
  shadowGlow: "rgba(74, 210, 255, 0.22)",
  borderSoft: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.14)"
} as const;

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
  "3xl": "3rem"
} as const;

export const radii = {
  xs: "10px",
  sm: "14px",
  md: "18px",
  lg: "24px",
  pill: "999px"
} as const;

export const typography = {
  display: "'Oxanium', 'Space Grotesk', sans-serif",
  body: "'Space Grotesk', 'Segoe UI', sans-serif",
  mono: "'IBM Plex Mono', monospace"
} as const;

export const motion = {
  instant: "80ms",
  fast: "140ms",
  normal: "220ms",
  slow: "360ms"
} as const;

export const depth = {
  surface: "0 10px 30px rgba(3, 6, 12, 0.25)",
  raised: "0 18px 38px rgba(3, 6, 12, 0.34)",
  glow: "0 0 0 1px rgba(255, 255, 255, 0.08), 0 16px 42px rgba(74, 210, 255, 0.18)"
} as const;

export const semanticSlots = [
  "surface-primary",
  "surface-elevated",
  "surface-contrast",
  "text-primary",
  "text-muted",
  "text-inverted",
  "accent-primary",
  "accent-secondary",
  "accent-success",
  "accent-danger",
  "accent-warning",
  "hud-bg",
  "hud-border",
  "hud-highlight",
  "card-radius",
  "shadow-soft",
  "shadow-glow",
  "motion-fast",
  "motion-normal",
  "border-subtle",
  "border-strong"
] as const;

export type SemanticSlot = (typeof semanticSlots)[number];
