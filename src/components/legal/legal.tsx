import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_UPDATED = "November 12, 2026";
export const CONTACT_URL = "https://github.com/thosuperman/freelance-flow-ai/issues";

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      <Link href="/terms" className="hover:text-foreground">
        Terms
      </Link>
      <Link href="/privacy" className="hover:text-foreground">
        Privacy
      </Link>
      <Link href="/disclaimer" className="hover:text-foreground">
        Disclaimer
      </Link>
    </nav>
  );
}

export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {LEGAL_UPDATED}</p>
      <div className="mt-6 rounded-2xl border bg-indigo-50/50 p-4 text-sm leading-relaxed">{intro}</div>
      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mt-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_p+p]:mt-3 [&_p+ul]:mt-2">
        {children}
      </div>
    </article>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      {children}
    </section>
  );
}

export function ContactLine() {
  return (
    <p>
      The only official contact channel is the project&apos;s GitHub repository:{" "}
      <a href={CONTACT_URL} target="_blank" rel="noopener">
        github.com/thosuperman/freelance-flow-ai/issues
      </a>
      . Please do not post personal information in a public issue. For privacy matters, open an issue titled &quot;Privacy request&quot; with no personal
      details, and we will arrange a private way to continue.
    </p>
  );
}
