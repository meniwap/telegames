import { depth, motion, radii } from "@telegramplay/design-tokens";

import type { ThemeManifest } from "../types";

export const brightToyRacerTheme: ThemeManifest = {
  id: "bright-toy-racer",
  label: "Bright Toy Racer",
  description: "Lighter toy-forward skin proving the platform can swap themes centrally.",
  tokens: {
    "surface-primary": "#fff9ef",
    "surface-elevated": "#fff4db",
    "surface-contrast": "#fee4c2",
    "text-primary": "#231a15",
    "text-muted": "#6d5a4a",
    "text-inverted": "#fff9ef",
    "accent-primary": "#ff6b2f",
    "accent-secondary": "#008dd5",
    "accent-success": "#2db87a",
    "accent-danger": "#d64155",
    "accent-warning": "#c68512",
    "hud-bg": "rgba(255, 249, 239, 0.84)",
    "hud-border": "rgba(35, 26, 21, 0.12)",
    "hud-highlight": "rgba(255, 107, 47, 0.14)",
    "card-radius": radii.md,
    "shadow-soft": depth.surface,
    "shadow-glow": "0 10px 34px rgba(0, 141, 213, 0.12)",
    "motion-fast": motion.fast,
    "motion-normal": motion.normal,
    "border-subtle": "rgba(35, 26, 21, 0.08)",
    "border-strong": "rgba(35, 26, 21, 0.16)"
  },
  componentRecipes: {
    button: {
      base: "inline-flex items-center justify-center gap-2 rounded-[var(--card-radius)] border px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition-all",
      variants: {
        primary:
          "border-transparent bg-[var(--accent-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-glow)] hover:brightness-105",
        secondary:
          "border-[var(--border-strong)] bg-[var(--surface-primary)] text-[var(--text-primary)] hover:border-[var(--accent-secondary)]",
        ghost:
          "border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      }
    },
    card: {
      base: "rounded-[var(--card-radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] shadow-[var(--shadow-soft)]",
      variants: {
        default: "p-5",
        glass: "bg-[color-mix(in_srgb,var(--surface-elevated)_88%,transparent_12%)] backdrop-blur-sm p-5",
        inset: "bg-[var(--surface-primary)] p-4"
      }
    },
    badge: {
      base: "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]",
      variants: {
        accent:
          "border-[color-mix(in_srgb,var(--accent-primary)_36%,transparent_64%)] bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent_88%)] text-[var(--accent-primary)]",
        neutral:
          "border-[var(--border-subtle)] bg-[var(--surface-primary)] text-[var(--text-muted)]"
      }
    }
  },
  hud: {
    shell:
      "rounded-[calc(var(--card-radius)-4px)] border border-[var(--hud-border)] bg-[var(--hud-bg)] px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-sm",
    metric: "text-sm font-medium text-[var(--text-primary)]",
    accent: "text-[var(--accent-secondary)]"
  }
};
