"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { FolderKanban, LayoutDashboard, LogOut, Menu, Receipt, Settings, Sparkles } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/new", label: "New project", icon: Sparkles },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/payments", label: "Payments", icon: Receipt },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

type NavUser = { name: string; email: string; businessName: string | null; isDemo: boolean };

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBlock({ user }: { user: NavUser }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card p-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-primary">
        {user.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{user.businessName || user.name}</div>
        <div className="truncate text-xs text-muted-foreground">{user.isDemo ? "Demo workspace" : user.email}</div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Sign out"
        onClick={async () => {
          await signOut();
          router.replace("/");
          router.refresh();
        }}
      >
        <LogOut />
      </Button>
    </div>
  );
}

export function AppSidebar({ user }: { user: NavUser }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-5 lg:flex">
      <div className="px-2.5 pb-6">
        <Logo href="/app" />
      </div>
      <NavLinks />
      <div className="mt-auto">
        <UserBlock user={user} />
      </div>
    </aside>
  );
}

export function MobileNav({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
      <Logo href="/app" />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Open menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col gap-6 p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Logo href="/app" />
          <NavLinks onNavigate={() => setOpen(false)} />
          <div className="mt-auto">
            <UserBlock user={user} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
