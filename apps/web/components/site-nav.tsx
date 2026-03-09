import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@telegramplay/ui";

import type { PlayerRecord } from "@/lib/types";

const items: Array<{ href: Route; label: string }> = [
  { href: "/", label: "Catalog" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
  { href: "/admin/ops", label: "Ops" }
];

export function SiteNav({ appName, player, isAdmin }: { appName: string; player: PlayerRecord | null; isAdmin: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-primary)_82%,transparent_18%)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--accent-primary)_14%,var(--surface-elevated)_86%)] shadow-[var(--shadow-glow)]">
            <span className="font-display text-lg font-semibold tracking-[0.18em] text-[var(--accent-primary)]">{appName.slice(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <p className="font-display text-lg font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">
              {appName}
            </p>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Telegram Mini App Platform
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          {items.map((item) =>
            item.href === "/admin/ops" && !isAdmin ? null : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-transparent px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)] transition hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex items-center gap-3">
          {isAdmin ? <Badge variant="accent">Ops</Badge> : null}
          <div className="text-right">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{player?.displayNameSnapshot ?? "Authenticating"}</p>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              {player ? `Level ${player.level}` : "Telegram session"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
