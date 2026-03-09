import type { ThemeManifest } from "./types";
import { brightToyRacerTheme } from "./themes/bright-toy-racer";
import { graphiteRacerTheme } from "./themes/graphite-racer";

export * from "./types";

export const themes = {
  [graphiteRacerTheme.id]: graphiteRacerTheme,
  [brightToyRacerTheme.id]: brightToyRacerTheme
} as const;

export type ThemeId = keyof typeof themes;

export const defaultThemeId: ThemeId = "graphite-racer";

export function getThemeManifest(themeId: string | undefined): ThemeManifest {
  if (themeId && themeId in themes) {
    return themes[themeId as ThemeId]!;
  }

  return themes[defaultThemeId]!;
}

export function getThemeCssVariables(themeId: string | undefined): Record<string, string> {
  const theme = getThemeManifest(themeId);

  return Object.entries(theme.tokens).reduce<Record<string, string>>((accumulator, [slot, value]) => {
    accumulator[`--${slot}`] = value;
    return accumulator;
  }, {});
}
