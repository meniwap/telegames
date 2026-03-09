import { getThemeManifest } from "@telegramplay/theme-engine";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export function HudChip({ label, value, accent }: { label: string; value: string; accent?: ReactNode }) {
  const hud = getThemeManifest(process.env.NEXT_PUBLIC_APP_THEME).hud;

  return (
    <div className={cn(hud.shell, "min-w-28")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className={cn(hud.metric, "font-display text-xl tracking-[0.08em]")}>{value}</span>
        {accent ? <span className={hud.accent}>{accent}</span> : null}
      </div>
    </div>
  );
}
