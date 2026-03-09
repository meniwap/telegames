import { getThemeManifest } from "@telegramplay/theme-engine";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

export function Button({ className, variant = "primary", icon, children, ...props }: ButtonProps) {
  const recipe = getThemeManifest(process.env.NEXT_PUBLIC_APP_THEME).componentRecipes.button!;

  return (
    <button className={cn(recipe.base, recipe.variants[variant], className)} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
