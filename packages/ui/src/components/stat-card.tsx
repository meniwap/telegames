import type { ReactNode } from "react";

import { Card } from "./card";

export function StatCard({
  label,
  value,
  hint,
  icon
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="flex min-h-32 flex-col justify-between gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</p>
        {icon ? <div className="text-[var(--accent-secondary)]">{icon}</div> : null}
      </div>
      <div>
        <p className="font-display text-3xl font-semibold tracking-[0.06em] text-[var(--text-primary)]">{value}</p>
        {hint ? <p className="mt-1 text-sm text-[var(--text-muted)]">{hint}</p> : null}
      </div>
    </Card>
  );
}
