import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  className
}: HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6", className)}>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl space-y-2">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent-secondary)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-4xl font-semibold tracking-[0.08em] text-[var(--text-primary)] md:text-5xl">
            {title}
          </h1>
          {description ? <p className="max-w-2xl text-sm text-[var(--text-muted)] sm:text-base">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
