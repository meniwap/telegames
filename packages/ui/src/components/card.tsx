import { getThemeManifest } from "@telegramplay/theme-engine";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

type CardVariant = "default" | "glass" | "inset";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

export function Card({ className, variant = "default", ...props }: CardProps) {
  const recipe = getThemeManifest(process.env.NEXT_PUBLIC_APP_THEME).componentRecipes.card!;

  return <div className={cn(recipe.base, recipe.variants[variant], className)} {...props} />;
}
