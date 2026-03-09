import type { Route } from "next";
import Link from "next/link";
import { CircuitBoard, Rocket, Shield } from "lucide-react";
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

    return (
      <PageShell
        eyebrow="Game Detail"
        title={game.name}
        description={game.description}
        actions={
          <Link href={playHref}>
            <Button>Start Official Session</Button>
          </Link>
        }
      >
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <Card className="space-y-5">
            <Badge variant="accent">{game.status === "live" ? "Live Module" : "Coming Soon"}</Badge>
            <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">
              {game.tagline}
            </h2>
            <p className="max-w-2xl text-base text-[var(--text-muted)]">
              The platform shell stays game-agnostic while each module owns its own simulation, validation, and presentation details. This first module proves the contract without centering the whole product around racing.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4">
                <CircuitBoard className="h-5 w-5 text-[var(--accent-secondary)]" />
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">Authoritative loop</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">Server-created sessions and server-finalized results remain the default pattern for every future game.</p>
              </div>
              <div className="rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4">
                <Shield className="h-5 w-5 text-[var(--accent-secondary)]" />
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">Shared security</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">The platform still owns auth, wallet, progression, and admin protection outside the game renderer.</p>
              </div>
              <div className="rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4">
                <Rocket className="h-5 w-5 text-[var(--accent-secondary)]" />
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">Module-ready</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">Routes, APIs, and leaderboard flows are now shaped around game modules instead of a single racer-specific surface.</p>
              </div>
            </div>
          </Card>

          <Card variant="glass" className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">Active module</p>
            <ul className="space-y-3 text-sm text-[var(--text-muted)]">
              <li>Slug: {game.slug}</li>
              <li>Status: {game.status}</li>
              <li>Type: Premium single-player Telegram game module</li>
              <li>Rewards: XP + Coins</li>
              <li>Leaderboard: Official server-side standings</li>
              <li>Surface: Shared portal shell + game-specific play route</li>
            </ul>
          </Card>
        </section>
      </PageShell>
    );
  } catch {
    notFound();
  }
}
