import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm shadow-indigo-500/30",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h9a4 4 0 0 1 0 8H8" />
        <path d="M11 12l-3 3 3 3" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}>
      <LogoMark />
      <span>
        FreelanceFlow <span className="text-primary">AI</span>
      </span>
    </Link>
  );
}
