import type { SemanticSlot } from "@telegramplay/design-tokens";

export type SemanticTokenMap = Record<SemanticSlot, string>;

export type ComponentVariantRecipe = {
  base: string;
  variants: Record<string, string>;
};

export type HudThemeRecipe = {
  shell: string;
  metric: string;
  accent: string;
};

export type ThemeManifest = {
  id: string;
  label: string;
  description: string;
  tokens: SemanticTokenMap;
  componentRecipes: Record<string, ComponentVariantRecipe>;
  hud: HudThemeRecipe;
};
