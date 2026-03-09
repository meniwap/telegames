import Link from "next/link";

import { Button, Card, PageShell } from "@telegramplay/ui";

export default function NotFound() {
  return (
    <PageShell eyebrow="404" title="Route not found" description="The requested page does not exist in the platform shell.">
      <Card className="flex flex-col items-start gap-4">
        <p className="text-sm text-[var(--text-muted)]">Return to the catalog and launch an official game session from a known entry point.</p>
        <Link href="/">
          <Button>Back to Portal</Button>
        </Link>
      </Card>
    </PageShell>
  );
}
