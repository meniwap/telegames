"use client";

export type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  initData?: string;
  colorScheme?: "light" | "dark";
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp() {
  return window.Telegram?.WebApp ?? null;
}

export function enterTelegramImmersiveMode(options?: { getWebApp?: () => TelegramWebApp | null }) {
  const getWebApp = options?.getWebApp ?? getTelegramWebApp;
  const webApp = getWebApp();

  webApp?.ready?.();
  webApp?.expand?.();
  webApp?.disableVerticalSwipes?.();

  return () => {
    webApp?.enableVerticalSwipes?.();
  };
}

function wait(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export async function resolveTelegramInitData(options?: {
  getWebApp?: () => TelegramWebApp | null;
  devInitData?: string;
  maxAttempts?: number;
  intervalMs?: number;
}) {
  const getWebApp = options?.getWebApp ?? getTelegramWebApp;
  const devInitData = options?.devInitData ?? process.env.NEXT_PUBLIC_DEV_INIT_DATA;
  const maxAttempts = options?.maxAttempts ?? 24;
  const intervalMs = options?.intervalMs ?? 150;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const webApp = getWebApp();
    webApp?.ready?.();
    webApp?.expand?.();

    const initData = webApp?.initData?.trim();
    if (initData) {
      return initData;
    }

    if (attempt < maxAttempts - 1) {
      await wait(intervalMs);
    }
  }

  const fallbackInitData = devInitData?.trim();
  if (fallbackInitData) {
    return fallbackInitData;
  }

  throw new Error("telegram_init_data_unavailable");
}
