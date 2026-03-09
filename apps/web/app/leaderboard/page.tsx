import type { Route } from "next";
import Link from "next/link";

import { Badge, Button, Card, PageShell } from "@telegramplay/ui";

import { getGameLeaderboardPayload } from "@/lib/server/game-service";
import { getCatalogPayload } from "@/lib/server/store";
import type { LeaderboardWindow } from "@telegramplay/game-core";

const windows: LeaderboardWindow[] = ["daily", "weekly", "all_time"];

export default async function LeaderboardPage({
  searchParams
}: {
  searchParams: Promise<{ window?: LeaderboardWindow; game?: string }>;
}) {
  const { window = "daily", game } = await searchParams;
  const catalog = await getCatalogPayload();
  const selectedGameSlug = game ?? catalog[0]?.slug ?? "racer-poc";
  const leaderboard = await getGameLeaderboardPayload(selectedGameSlug, window);

  return (
    <PageShell eyebrow="Leaderboard" title="Official Standings" description="Every entry comes from a server-validated game result.">
      <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1">
        {catalog.map((entry) => (
          <Link key={entry.slug} href={`/leaderboard?game=${entry.slug}&window=${window}` as Route}>
            <Button variant={entry.slug === selectedGameSlug ? "primary" : "secondary"}>{entry.name}</Button>
          </Link>
        ))}
      </div>

      <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1">
        {windows.map((value) => (
          <Link key={value} href={`/leaderboard?game=${selectedGameSlug}&window=${value}` as Route}>
            <Button variant={value === window ? "primary" : "secondary"}>{value.replace("_", " ")}</Button>
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        {/* Desktop table header */}
        <div className="hidden border-b border-[var(--border-subtle)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)] md:grid md:grid-cols-[72px_minmax(0,1fr)_120px_100px] md:gap-4">
          <span>Rank</span>
          <span>Player</span>
          <span>Best Result</span>
          <span>Level</span>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {leaderboard.entries.length === 0 ? (
            <div className="px-5 py-8 text-sm text-[var(--text-muted)]">No official runs yet for this window.</div>
          ) : (
            leaderboard.entries.map((entry) => (
              <div key={entry.playerId}>
                {/* Mobile layout */}
                <div className="flex items-center justify-between px-4 py-3 md:hidden">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 font-display text-xl tracking-[0.08em] text-[var(--accent-primary)]">#{entry.placement}</span>
                    {entry.placement <= 3 ? <Badge variant="accent">Top {entry.placement}</Badge> : null}
                    <span className="truncate font-semibold text-[var(--text-primary)]">{entry.displayName}</span>
                  </div>
                  <span className="shrink-0 pl-3 text-sm text-[var(--text-primary)]">{entry.displayValue}</span>
                </div>

                {/* Desktop layout */}
                <div className="hidden md:grid md:grid-cols-[72px_minmax(0,1fr)_120px_100px] md:gap-4 md:px-5 md:py-4 md:text-sm">
                  <span className="font-display text-xl tracking-[0.08em] text-[var(--accent-primary)]">#{entry.placement}</span>
                  <div className="flex items-center gap-3">
                    {entry.placement <= 3 ? <Badge variant="accent">Top {entry.placement}</Badge> : null}
                    <span className="font-semibold text-[var(--text-primary)]">{entry.displayName}</span>
                  </div>
                  <span className="text-[var(--text-primary)]">{entry.displayValue}</span>
                  <span className="text-[var(--text-muted)]">{entry.level}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </PageShell>
  );
}
