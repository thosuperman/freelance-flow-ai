import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-indigo-50 to-transparent" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link href="/demo" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Try the demo
        </Link>
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-8 sm:pt-16">{children}</main>
    </div>
  );
}
