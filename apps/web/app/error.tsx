"use client";

import { useEffect } from "react";

import { Button, Card, PageShell } from "@telegramplay/ui";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/client-errors", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        route: "app/error",
        message: error.message,
        stack: error.stack ?? null,
        userAgent: navigator.userAgent
      })
    });
  }, [error]);

  return (
    <PageShell eyebrow="Error" title="Unexpected platform error" description="The failure has been recorded for ops review.">
      <Card className="flex flex-col items-start gap-4">
        <p className="text-sm text-[var(--text-muted)]">{error.message}</p>
        <Button onClick={reset}>Retry</Button>
      </Card>
    </PageShell>
  );
}
