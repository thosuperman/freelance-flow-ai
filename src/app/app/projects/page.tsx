import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Sparkles } from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { getDashboard } from "@/features/dashboard/service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const { rows } = await getDashboard(user.id);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Every project, its agreed value and what has been paid."
        actions={
          <Button asChild>
            <Link href="/app/new">
              <Sparkles /> New project
            </Link>
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" description="Create your first project from a client conversation." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-xs">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Value</th>
                <th className="px-4 py-2.5 text-right font-medium">Paid</th>
                <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project: p, fin }) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/app/projects/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">{p.client.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={fin.hasApprovedAgreement ? fin.revisedValue : p.budget} currency={p.currency} />
                    {!fin.hasApprovedAgreement ? <div className="text-[11px] text-muted-foreground">proposed</div> : null}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700">
                    <Money value={fin.paid} currency={p.currency} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={fin.outstanding} currency={p.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
