import Link from "next/link";
import { FlaskConical } from "lucide-react";

/** Always tells the user which integrations are live and which are simulated. */
export function EnvironmentBanner({
  aiSimulated,
  paypalMode,
  paypalConfigured,
  isDemo,
}: {
  aiSimulated: boolean;
  paypalMode: "sandbox" | "live" | "mock";
  paypalConfigured: boolean;
  isDemo: boolean;
}) {
  const notes: string[] = [];
  if (isDemo) notes.push("Demo workspace (expires in 24h)");
  if (aiSimulated) notes.push("AI: simulated heuristics — add ANTHROPIC_API_KEY for Claude");
  if (paypalMode === "mock") notes.push("PayPal: simulated test gateway");
  else if (!paypalConfigured) notes.push("PayPal Sandbox credentials missing");
  else if (paypalMode === "sandbox") notes.push("PayPal Sandbox — no real money moves");
  if (notes.length === 0) return null;
  return (
    <div className="border-b border-amber-200/70 bg-amber-50/70 px-4 py-2 text-xs text-amber-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1">
        <FlaskConical className="size-3.5 shrink-0" />
        {notes.map((n, i) => (
          <span key={n} className="flex items-center gap-3">
            {i > 0 ? <span aria-hidden className="text-amber-400">•</span> : null}
            {n}
          </span>
        ))}
        <Link href="/app/settings" className="ml-auto font-medium underline-offset-2 hover:underline">
          Integration status
        </Link>
      </div>
    </div>
  );
}
