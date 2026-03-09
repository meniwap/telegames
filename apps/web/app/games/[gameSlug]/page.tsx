import type { Route } from "next";
import Link from "next/link";
import { Gamepad2, Medal, Zap } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge, Button, Card, PageShell } from "@telegramplay/ui";

import { getGameDetailPayload } from "@/lib/server/game-service";

export default async function GameDetailPage({
  params
}: {
  params: Promise<{ gameSlug: string }>;
}) {
  const { gameSlug } = await params;

  try {
    const game = await getGameDetailPayload(gameSlug);
    const playHref = `/games/${game.slug}/play` as Route;
    const leaderboardHref = `/leaderboard?game=${game.slug}` as Route;

    return (
      <PageShell
        eyebrow="Game"
        title={game.name}
        description={game.tagline}
        actions={
          <>
            <Link href={playHref}>
              <Button>Play Now</Button>
            </Link>
            <Link href={leaderboardHref}>
              <Button variant="secondary">Leaderboard</Button>
            </Link>
          </>
        }
      >
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <Card className="space-y-5">
            <Badge variant="accent">{game.status === "live" ? "Live" : "Coming Soon"}</Badge>
            <p className="max-w-2xl text-base text-[var(--text-muted)]">
              {game.description}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4">
                <Gamepad2 className="h-5 w-5 text-[var(--accent-secondary)]" />
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">How to Play</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">Jump in and start playing immediately. Intuitive controls designed for touch.</p>
              </div>
              <div className="rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4">
                <Medal className="h-5 w-5 text-[var(--accent-secondary)]" />
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">Compete</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">Every result is verified on the server. Climb the daily, weekly, and all-time leaderboards.</p>
              </div>
              <div className="rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4">
                <Zap className="h-5 w-5 text-[var(--accent-secondary)]" />
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">Rewards</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">Earn XP and coins based on your performance. Better results mean bigger rewards.</p>
              </div>
            </div>
          </Card>

          <Card variant="glass" className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">Game Info</p>
            <ul className="space-y-3 text-sm text-[var(--text-muted)]">
              <li className="flex justify-between"><span>Status</span><span className="font-semibold text-[var(--text-primary)]">{game.status === "live" ? "Live" : "Coming Soon"}</span></li>
              <li className="flex justify-between"><span>Rewards</span><span className="font-semibold text-[var(--text-primary)]">XP + Coins</span></li>
              <li className="flex justify-between"><span>Leaderboard</span><span className="font-semibold text-[var(--text-primary)]">Daily / Weekly / All Time</span></li>
              <li className="flex justify-between"><span>Validation</span><span className="font-semibold text-[var(--text-primary)]">Server-verified</span></li>
            </ul>
          </Card>
        </section>
      </PageShell>
    );
  } catch {
    notFound();
  }
}
