import { getThemeManifest } from "@telegramplay/theme-engine";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

type BadgeVariant = "accent" | "neutral";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  const recipe = getThemeManifest(process.env.NEXT_PUBLIC_APP_THEME).componentRecipes.badge!;

  return <span className={cn(recipe.base, recipe.variants[variant], className)} {...props} />;
}
