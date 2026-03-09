import type { Route } from "next";
import Link from "next/link";
import { CarFront, ShieldCheck, Trophy, Wallet } from "lucide-react";

import { Badge, Button, Card, PageShell, StatCard } from "@telegramplay/ui";

import { getBootstrapPayload } from "@/lib/server/store";
import { getPagePlayerContext } from "@/lib/server/page-context";

export default async function HomePage() {
  const playerContext = await getPagePlayerContext();
  const bootstrap = await getBootstrapPayload(playerContext);
  const primaryGame = bootstrap.catalog[0]!;
  const primaryProfile = bootstrap.gameProfiles.find((profile) => profile.gameSlug === primaryGame.slug) ?? null;
  const detailHref = `/games/${primaryGame.slug}` as Route;
  const playHref = `/games/${primaryGame.slug}/play` as Route;
  const leaderboardHref = `/leaderboard?game=${primaryGame.slug}` as Route;

  return (
    <PageShell
      eyebrow="Portal"
      title="Premium Telegram games, built on an authoritative platform shell."
      description="The portal owns identity, progression, wallet history, ops visibility, and design consistency. The first racer module proves the shared foundation instead of defining the whole architecture."
        actions={
        <>
          <Link href={detailHref}>
            <Button>Launch POC</Button>
          </Link>
          <Link href={leaderboardHref}>
            <Button variant="secondary">Official Leaderboard</Button>
          </Link>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Player Level" value={bootstrap.player ? String(bootstrap.player.level) : "..." } hint="Shared across future games" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Wallet" value={bootstrap.wallet ? `${bootstrap.wallet.coins} coins` : "..."} hint="Server-minted only" icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Game XP" value={primaryProfile ? `${primaryProfile.xp} XP` : "0 XP"} hint={`${primaryGame.name} progression is modular`} icon={<Trophy className="h-5 w-5" />} />
        <StatCard label="Build" value={bootstrap.deploymentVersion} hint={bootstrap.commitSha.slice(0, 7)} icon={<CarFront className="h-5 w-5" />} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <Card className="overflow-hidden p-0">
          <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
            <div className="relative overflow-hidden bg-[linear-gradient(145deg,color-mix(in_srgb,var(--surface-elevated)_70%,transparent_30%),color-mix(in_srgb,var(--accent-primary)_16%,transparent_84%))] p-6 sm:p-8">
                <Badge variant="accent">{primaryGame.status === "live" ? "Live POC" : "Coming Soon"}</Badge>
              <h2 className="mt-5 font-display text-4xl font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)]">
                {primaryGame.name}
              </h2>
              <p className="mt-3 max-w-xl text-base text-[var(--text-muted)]">{primaryGame.description}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={detailHref}>
                  <Button>Open Detail</Button>
                </Link>
                <Link href={playHref}>
                  <Button variant="secondary">Start Official Run</Button>
                </Link>
              </div>
            </div>
            <div className="relative flex min-h-64 items-end bg-[radial-gradient(circle_at_top,rgba(74,210,255,0.2),transparent_40%),linear-gradient(180deg,rgba(31,40,54,0.95),rgba(9,11,18,0.95))] p-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">Pillar Breakdown</p>
                <ul className="space-y-2 text-sm text-[var(--text-muted)]">
                  <li>Server-validated game sessions and official submission verification.</li>
                  <li>Wallet ledger and progression history reconstructed from trusted writes.</li>
                  <li>Centralized theme/tokens consumed by shell, HUD, cards, and future games.</li>
                  <li>Thin bot integration: onboarding outside, product inside the Mini App.</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        <Card variant="glass" className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">Platform Guarantees</p>
            <h2 className="mt-2 font-display text-2xl font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">
              No client authority
            </h2>
          </div>
          <ul className="space-y-3 text-sm text-[var(--text-muted)]">
            <li>Telegram Mini App init data is validated on the server before a session cookie is issued.</li>
            <li>Game-session seeds and config versions are generated server-side and persisted before play begins.</li>
            <li>Game modules re-run their official validation on the server and reject stale or invalid payloads.</li>
            <li>Coins, XP, and leaderboard entries are derived from the official result only.</li>
          </ul>
        </Card>
      </section>
    </PageShell>
  );
}
