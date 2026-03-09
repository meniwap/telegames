import type { Route } from "next";
import Link from "next/link";
import { ShieldCheck, Trophy, Wallet } from "lucide-react";

import { Badge, Button, Card, PageShell, StatCard } from "@telegramplay/ui";

import { getBootstrapPayload } from "@/lib/server/store";
import { getPagePlayerContext } from "@/lib/server/page-context";

export default async function HomePage() {
  const playerContext = await getPagePlayerContext();
  const bootstrap = await getBootstrapPayload(playerContext);
  const primaryProfile = bootstrap.gameProfiles[0] ?? null;

  return (
    <PageShell
      eyebrow="Games"
      title="Play. Compete. Climb."
      description="Challenge yourself in fast-paced games and compete for the top of the leaderboard."
      actions={
        <Link href="/leaderboard">
          <Button variant="secondary">Leaderboard</Button>
        </Link>
      }
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Level" value={bootstrap.player ? String(bootstrap.player.level) : "..."} hint="Shared across all games" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Coins" value={bootstrap.wallet ? `${bootstrap.wallet.coins}` : "..."} hint="Earned from games" icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="XP" value={primaryProfile ? `${primaryProfile.xp}` : "0"} hint={primaryProfile?.gameName ?? "Play to earn"} icon={<Trophy className="h-5 w-5" />} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {bootstrap.catalog.map((game) => {
          const playHref = `/games/${game.slug}/play` as Route;
          const detailHref = `/games/${game.slug}` as Route;
          const profile = bootstrap.gameProfiles.find((p) => p.gameSlug === game.slug);

          return (
            <Card key={game.slug} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant={game.status === "live" ? "accent" : "neutral"}>
                    {game.status === "live" ? "Live" : "Coming Soon"}
                  </Badge>
                  <h2 className="mt-3 font-display text-2xl font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)] sm:text-3xl">
                    {game.name}
                  </h2>
                </div>
                {profile ? (
                  <span className="shrink-0 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)]">
                    Lv {profile.level}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-[var(--text-muted)]">{game.tagline}</p>
              <div className="mt-auto flex flex-wrap gap-3">
                <Link href={playHref}>
                  <Button>Play Now</Button>
                </Link>
                <Link href={detailHref}>
                  <Button variant="secondary">Details</Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </section>
    </PageShell>
  );
}
