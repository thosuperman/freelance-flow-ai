import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground ring-border",
  brand: "bg-brand-soft text-accent-foreground ring-indigo-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
};

export function Pill({ tone = "neutral", children, className, dot = true }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  );
}

const MAP: Record<string, [string, Tone]> = {
  // project
  DRAFT: ["Draft", "neutral"],
  PROPOSED: ["Awaiting client", "warning"],
  ACTIVE: ["Active", "brand"],
  COMPLETED: ["Completed", "success"],
  CANCELLED: ["Cancelled", "neutral"],
  // proposal version
  PENDING: ["Awaiting decision", "warning"],
  APPROVED: ["Approved", "success"],
  REVISION_REQUESTED: ["Revision requested", "danger"],
  WITHDRAWN: ["Withdrawn", "neutral"],
  // change request
  PENDING_CLIENT: ["Awaiting client", "warning"],
  REJECTED: ["Rejected", "danger"],
  // payment request
  OPEN: ["Awaiting payment", "warning"],
  PROCESSING: ["Processing", "info"],
  PAID: ["Paid", "success"],
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const [label, tone] = MAP[status] ?? [status.toLowerCase().replace(/_/g, " "), "neutral" as Tone];
  return (
    <Pill tone={tone} className={className}>
      {label}
    </Pill>
  );
}

const STAGE_TONES: Record<string, Tone> = {
  Draft: "neutral",
  Approved: "brand",
  "In progress": "info",
  Submitted: "warning",
  "Changes requested": "danger",
  "Client approved": "success",
  "Payment pending": "warning",
  Paid: "success",
};

export function StageBadge({ stage }: { stage: string }) {
  return <Pill tone={STAGE_TONES[stage] ?? "neutral"}>{stage}</Pill>;
}

export function SimulatedBadge({ label = "Simulated", className }: { label?: string; className?: string }) {
  return (
    <span
      title="This result was not produced by a live external service. See Settings for configuration."
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-dashed border-amber-400 bg-amber-50 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800",
        className,
      )}
    >
      {label}
    </span>
  );
}
