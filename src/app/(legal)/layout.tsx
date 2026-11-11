import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { LegalLinks } from "@/components/legal/legal";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link href="/demo" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Try the demo
        </Link>
      </header>
      <main className="flex-1 px-4 pb-16 pt-6 sm:px-6">{children}</main>
      <footer className="border-t py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>© 2026 FreelanceFlow AI · a personal hackathon project</span>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
