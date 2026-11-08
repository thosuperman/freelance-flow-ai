import { KeyRound } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";

/** Public PayPal Sandbox buyer login for reviewers. Sandbox funds only. */
export function SandboxBuyerCard({ buyer, compact = false }: { buyer: { email: string; password: string }; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-sm" data-testid="sandbox-buyer">
      <p className="flex items-center gap-1.5 font-semibold">
        <KeyRound className="size-4 text-sky-700" /> PayPal Sandbox buyer for reviewers
      </p>
      {!compact ? (
        <p className="mt-0.5 text-muted-foreground">Use this in the PayPal popup. It holds simulated Sandbox money only; no real payment is possible.</p>
      ) : null}
      <dl className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1.5">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="truncate font-mono text-xs">{buyer.email}</dd>
        <dd>
          <CopyButton value={buyer.email} label="Copy" variant="ghost" />
        </dd>
        <dt className="text-muted-foreground">Password</dt>
        <dd className="truncate font-mono text-xs">{buyer.password}</dd>
        <dd>
          <CopyButton value={buyer.password} label="Copy" variant="ghost" />
        </dd>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">Shared with all reviewers: please don&apos;t change its password or settings.</p>
    </div>
  );
}
