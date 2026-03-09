import type { Route } from "next";
import Link from "next/link";

import { Card, PageShell, StatCard } from "@telegramplay/ui";

import { getOpsDashboardPayload } from "@/lib/server/game-service";
import { getPagePlayerContext } from "@/lib/server/page-context";

export default async function OpsPage({
  searchParams
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const playerContext = await getPagePlayerContext();
  const { game } = await searchParams;

  try {
    const ops = await getOpsDashboardPayload(playerContext, game);

    return (
      <PageShell eyebrow="Ops" title="Protected platform visibility" description="Fast-loading operational stats, session funnel visibility, and client health in one Telegram-native internal view.">
        <div className="flex flex-wrap gap-3">
          {ops.filters.games.map((entry) => (
            <Link
              key={entry.slug}
              href={`/admin/ops?game=${entry.slug}` as Route}
              className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${
                ops.filters.selectedGameSlug === entry.slug
                  ? "border-[var(--accent-primary)] text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] text-[var(--text-muted)]"
              }`}
            >
              {entry.name}
            </Link>
          ))}
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {ops.kpis.map((kpi) => (
            <StatCard key={kpi.label} label={kpi.label} value={kpi.value} hint={kpi.hint} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">Top players</p>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {ops.topPlayers.map((entry) => (
                <div key={entry.playerId} className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{entry.displayName}</p>
                    <p className="text-[var(--text-muted)]">Level {entry.level}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl tracking-[0.08em] text-[var(--accent-primary)]">#{entry.placement}</p>
                    <p className="text-[var(--text-muted)]">{entry.displayValue}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">Selected game stats</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {ops.gameStats.map((stat) => (
                  <div key={stat.label} className="rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3 text-sm">
                    <p className="text-[var(--text-muted)]">{stat.label}</p>
                    <p className="mt-1 font-display text-xl tracking-[0.08em] text-[var(--accent-primary)]">{stat.value}</p>
                    <p className="text-[var(--text-muted)]">{stat.hint}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">Suspicious runs</p>
              {ops.suspiciousRuns.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No suspicious runs recorded.</p>
              ) : (
                ops.suspiciousRuns.map((flag) => (
                  <div key={flag.id} className="rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3 text-sm">
                    <p className="font-semibold text-[var(--text-primary)]">{flag.flag}</p>
                    <p className="text-[var(--text-muted)]">Session {flag.sessionId}</p>
                  </div>
                ))
              )}
            </Card>

            <Card variant="glass" className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">Client errors</p>
              {ops.clientErrors.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No client-side issues reported.</p>
              ) : (
                ops.clientErrors.map((error) => (
                  <div key={error.id} className="rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3 text-sm">
                    <p className="font-semibold text-[var(--text-primary)]">{error.message}</p>
                    <p className="text-[var(--text-muted)]">{error.route}</p>
                  </div>
                ))
              )}
            </Card>
          </div>
        </section>
      </PageShell>
    );
  } catch {
    return (
      <PageShell eyebrow="Ops" title="Access denied" description="This route is protected by the Telegram-native admin allowlist.">
        <Card className="text-sm text-[var(--text-muted)]">Your current Telegram identity is not authorized for internal ops visibility.</Card>
      </PageShell>
    );
  }
}
