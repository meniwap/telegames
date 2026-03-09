"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ClientErrorReporter() {
  const pathname = usePathname();

  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      void fetch("/api/client-errors", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          route: pathname,
          message: event.message,
          stack: event.error instanceof Error ? event.error.stack ?? null : null,
          userAgent: navigator.userAgent
        })
      });
    };

    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, [pathname]);

  return null;
}
