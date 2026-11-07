import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { getPortalGrant } from "@/features/portal/service";
import { LogoMark } from "@/components/shared/logo";

export const metadata: Metadata = { title: "Client portal", robots: { index: false, follow: false } };

export default async function PortalLayout({ children, params }: LayoutProps<"/portal/[token]">) {
  const { token } = await params;
  const grant = await getPortalGrant(token);
  const owner = grant.project.owner;
  const brand = owner.profile?.businessName || owner.name;
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={`/portal/${token}`} className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-sm font-semibold text-background">{brand.slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="text-sm font-semibold leading-tight">{brand}</div>
              <div className="text-xs text-muted-foreground">Client portal · {grant.client.name}</div>
            </div>
          </Link>
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Lock className="size-3.5" /> Private link — don’t share it
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-2 px-4 text-xs text-muted-foreground">
          <LogoMark className="size-5" /> Powered by FreelanceFlow AI · Payments processed by PayPal
        </div>
      </footer>
    </div>
  );
}
