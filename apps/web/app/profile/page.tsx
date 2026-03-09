import { Coins, Gauge, Trophy } from "lucide-react";

import { Card, PageShell, StatCard } from "@telegramplay/ui";

import { getPagePlayerContext } from "@/lib/server/page-context";
import { getProfilePayload } from "@/lib/server/game-service";

export default async function ProfilePage({
  searchParams
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const playerContext = await getPagePlayerContext();
  const { game } = await searchParams;
  const profile = await getProfilePayload(playerContext, game);
  const selectedProfile =
    profile && profile.selectedGameSlug
      ? profile.gameProfiles.find((entry) => entry.gameSlug === profile.selectedGameSlug) ?? null
      : null;

  return (
    <PageShell
      eyebrow="Profile"
      title={profile?.player.displayNameSnapshot ?? "Player Profile"}
      description={profile ? `Level ${profile.player.level} player` : "Authenticate through Telegram to view your profile."}
    >
      {!profile ? (
        <Card className="text-sm text-[var(--text-muted)]">Open from the Telegram bot to authenticate.</Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard label="Level" value={String(profile.player.level)} hint={`${selectedProfile?.xp ?? 0} XP earned`} icon={<Gauge className="h-5 w-5" />} />
            <StatCard label="Coins" value={String(profile.wallet.coins)} hint="Earned from games" icon={<Coins className="h-5 w-5" />} />
            <StatCard label="Active Game" value={selectedProfile?.gameName ?? "None"} hint={selectedProfile ? `Level ${selectedProfile.level}` : "Play a game to start"} icon={<Trophy className="h-5 w-5" />} />
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Card className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">About</p>
              <div className="space-y-2 text-sm text-[var(--text-muted)]">
                <p className="flex justify-between"><span>Name</span><span className="font-semibold text-[var(--text-primary)]">{profile.player.displayNameSnapshot}</span></p>
                <p className="flex justify-between"><span>Username</span><span className="font-semibold text-[var(--text-primary)]">{profile.player.usernameSnapshot ?? "Not set"}</span></p>
                <p className="flex justify-between"><span>Last active</span><span className="font-semibold text-[var(--text-primary)]">{new Date(profile.player.lastSeenAt).toLocaleDateString()}</span></p>
              </div>
            </Card>

            <Card className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">Your Games</p>
              <div className="space-y-3">
                {profile.gameProfiles.map((entry) => (
                  <div key={entry.gameTitleId} className="rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-4 py-3 text-sm">
                    <p className="font-semibold text-[var(--text-primary)]">{entry.gameName}</p>
                    <p className="text-[var(--text-muted)]">Level {entry.level} · {entry.xp} XP</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card variant="glass" className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">Game Stats</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {profile.selectedGameStats.map((stat) => (
                  <div key={stat.label} className="rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-4 py-3 text-sm">
                    <p className="text-[var(--text-muted)]">{stat.label}</p>
                    <p className="mt-1 font-display text-xl tracking-[0.08em] text-[var(--accent-primary)]">{stat.value}</p>
                    <p className="text-[var(--text-muted)]">{stat.hint}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card variant="glass" className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">Recent Rewards</p>
              <div className="space-y-3">
                {profile.recentLedger.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No rewards earned yet. Play a game to start!</p>
                ) : (
                  profile.recentLedger.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-[calc(var(--card-radius)-6px)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-4 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{entry.entryType.toUpperCase()}</p>
                        <p className="text-[var(--text-muted)]">{entry.sourceType.replaceAll("_", " ")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-lg tracking-[0.08em] text-[var(--accent-primary)]">+{entry.amount}</p>
                        <p className="text-[var(--text-muted)]">{new Date(entry.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </section>
        </>
      )}
    </PageShell>
  );
}
