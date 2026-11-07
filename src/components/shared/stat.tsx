import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "brand" | "danger";
  className?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success-foreground",
    warning: "text-warning-foreground",
    brand: "text-primary",
    danger: "text-destructive",
  }[tone];
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-xs", className)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-1.5 text-xl font-semibold tracking-tight tabular", toneClass)}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
