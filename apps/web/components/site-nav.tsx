"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Menu, X } from "lucide-react";

import { Badge } from "@telegramplay/ui";

import type { PlayerRecord } from "@/lib/types";

const items: Array<{ href: Route; label: string }> = [
  { href: "/", label: "Games" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
  { href: "/admin/ops", label: "Ops" }
];

export function SiteNav({ appName, player, isAdmin }: { appName: string; player: PlayerRecord | null; isAdmin: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-primary)_82%,transparent_18%)] pt-[max(0px,var(--safe-top))] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--accent-primary)_14%,var(--surface-elevated)_86%)] shadow-[var(--shadow-glow)] sm:h-11 sm:w-11 sm:rounded-2xl">
            <span className="font-display text-sm font-semibold tracking-[0.18em] text-[var(--accent-primary)] sm:text-lg">{appName.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)] sm:text-lg sm:tracking-[0.18em]">
              {appName}
            </p>
            <p className="hidden text-xs uppercase tracking-[0.24em] text-[var(--text-muted)] sm:block">
              Telegram Mini App
            </p>
          </div>
        </Link>

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

        <div className="flex items-center gap-2.5">
          {isAdmin ? <Badge variant="accent">Ops</Badge> : null}
          <div className="min-w-0 text-right">
            <p className="max-w-[120px] truncate text-sm font-semibold text-[var(--text-primary)] sm:max-w-none">{player?.displayNameSnapshot ?? "..."}</p>
            <p className="hidden text-xs uppercase tracking-[0.24em] text-[var(--text-muted)] sm:block">
              {player ? `Level ${player.level}` : "Connecting"}
            </p>
          </div>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] transition hover:text-[var(--text-primary)] md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav className="border-t border-[var(--border-subtle)] bg-[var(--surface-primary)] px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {items.map((item) =>
              item.href === "/admin/ops" && !isAdmin ? null : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              )
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
