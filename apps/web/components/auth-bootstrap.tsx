"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getTelegramWebApp, resolveTelegramInitData } from "@/lib/client/telegram-web-app";

function toReadableAuthError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "telegram_auth_failed";

  switch (message) {
    case "telegram_init_data_unavailable":
      return "Telegram session data was not received from the Mini App bridge. Close the Mini App and reopen it from the bot menu.";
    case "unauthorized":
    case "telegram_auth_failed":
      return "Telegram authentication failed. Reopen the Mini App from Telegram and try again.";
    default:
      return message;
  }
}

export function AuthBootstrap({ hasSession }: { hasSession: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (hasSession) {
      return;
    }

    void resolveTelegramInitData()
      .then(async (initData) => {
        if (cancelled) {
          return;
        }

        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ initData })
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "telegram_auth_failed");
        }

        if (!cancelled) {
          router.refresh();
        }
      })
      .catch((reason: unknown) => {
        const message = reason instanceof Error ? reason.message : "telegram_auth_failed";
        const initData = getTelegramWebApp()?.initData?.trim();

        if (!cancelled) {
          if (!initData && (message === "telegram_init_data_unavailable" || message === "missing_hash")) {
            return;
          }

          setError(toReadableAuthError(reason));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasSession, router]);

  if (hasSession || !error) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-[var(--card-radius)] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-4 text-sm text-[var(--text-muted)] shadow-[var(--shadow-soft)] sm:left-auto sm:right-4 sm:max-w-xl">
      {error}
    </div>
  );
}
