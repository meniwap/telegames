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
    <PageShell eyebrow="Leaderboard" title="Official standings only" description="Every entry is derived from a server-validated game result. There is no client-side minting or rank claiming.">
      <div className="flex flex-wrap gap-3">
        {catalog.map((entry) => (
          <Link key={entry.slug} href={`/leaderboard?game=${entry.slug}&window=${window}` as Route}>
            <Button variant={entry.slug === selectedGameSlug ? "primary" : "secondary"}>{entry.name}</Button>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {windows.map((value) => (
          <Link key={value} href={`/leaderboard?game=${selectedGameSlug}&window=${value}` as Route}>
            <Button variant={value === window ? "primary" : "secondary"}>{value.replace("_", " ")}</Button>
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[72px_minmax(0,1fr)_120px_100px] gap-4 border-b border-[var(--border-subtle)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          <span>Rank</span>
          <span>Player</span>
          <span>Best Result</span>
          <span>Level</span>
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {leaderboard.entries.length === 0 ? (
            <div className="px-5 py-8 text-sm text-[var(--text-muted)]">No official runs yet for this leaderboard window.</div>
          ) : (
            leaderboard.entries.map((entry) => (
              <div key={entry.playerId} className="grid grid-cols-[72px_minmax(0,1fr)_120px_100px] gap-4 px-5 py-4 text-sm">
                <span className="font-display text-xl tracking-[0.08em] text-[var(--accent-primary)]">#{entry.placement}</span>
                <div className="flex items-center gap-3">
                  {entry.placement <= 3 ? <Badge variant="accent">Top {entry.placement}</Badge> : null}
                  <span className="font-semibold text-[var(--text-primary)]">{entry.displayName}</span>
                </div>
                <span className="text-[var(--text-primary)]">{entry.displayValue}</span>
                <span className="text-[var(--text-muted)]">{entry.level}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </PageShell>
  );
}
