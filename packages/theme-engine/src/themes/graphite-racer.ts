import { depth, motion, palette, radii } from "@telegramplay/design-tokens";

import type { ThemeManifest } from "../types";

export const graphiteRacerTheme: ThemeManifest = {
  id: "graphite-racer",
  label: "Graphite Racer",
  description: "Dark graphite shell with enamel orange energy and cyan telemetry accents.",
  tokens: {
    "surface-primary": palette.graphite900,
    "surface-elevated": palette.graphite850,
    "surface-contrast": palette.graphite800,
    "text-primary": palette.ivory100,
    "text-muted": palette.steel300,
    "text-inverted": palette.graphite950,
    "accent-primary": palette.orange500,
    "accent-secondary": palette.cyan500,
    "accent-success": palette.emerald500,
    "accent-danger": palette.crimson500,
    "accent-warning": palette.amber500,
    "hud-bg": "rgba(9, 11, 18, 0.82)",
    "hud-border": palette.borderStrong,
    "hud-highlight": "rgba(255, 138, 61, 0.16)",
    "card-radius": radii.md,
    "shadow-soft": depth.surface,
    "shadow-glow": depth.glow,
    "motion-fast": motion.fast,
    "motion-normal": motion.normal,
    "border-subtle": palette.borderSoft,
    "border-strong": palette.borderStrong
  },
  componentRecipes: {
    button: {
      base: "inline-flex items-center justify-center gap-2 rounded-[var(--card-radius)] border px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition-all",
      variants: {
        primary:
          "border-transparent bg-[var(--accent-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-glow)] hover:brightness-110",
        secondary:
          "border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--surface-elevated)_92%,white_8%)] text-[var(--text-primary)] hover:border-[var(--accent-secondary)]",
        ghost:
          "border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
      }
    },
    card: {
      base: "rounded-[var(--card-radius)] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-elevated)_92%,white_8%),var(--surface-primary))] shadow-[var(--shadow-soft)]",
      variants: {
        default: "p-5",
        glass: "bg-[color-mix(in_srgb,var(--surface-elevated)_74%,transparent_26%)] backdrop-blur-md p-5",
        inset: "bg-[var(--surface-primary)] p-4"
      }
    },
    badge: {
      base: "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]",
      variants: {
        accent:
          "border-[color-mix(in_srgb,var(--accent-primary)_45%,transparent_55%)] bg-[color-mix(in_srgb,var(--accent-primary)_18%,transparent_82%)] text-[var(--accent-primary)]",
        neutral:
          "border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-elevated)_86%,transparent_14%)] text-[var(--text-muted)]"
      }
    }
  },
  hud: {
    shell:
      "rounded-[calc(var(--card-radius)-4px)] border border-[var(--hud-border)] bg-[var(--hud-bg)] px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-md",
    metric: "text-sm font-medium text-[var(--text-primary)]",
    accent: "text-[var(--accent-secondary)]"
  }
};
