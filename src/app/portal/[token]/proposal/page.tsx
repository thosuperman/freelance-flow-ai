import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { getPortalProject } from "@/features/portal/service";
import type { ProposalSnapshot } from "@/features/proposals/service";
import { formatMoney } from "@/lib/money";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { ProposalDecision } from "@/components/portal/proposal-decision";
import { StatusBadge } from "@/components/shared/status-badge";

export default async function PortalProposalPage({ params }: PageProps<"/portal/[token]/proposal">) {
  const { token } = await params;
  const { project, grant } = await getPortalProject(token);
  const versions = project.proposal?.versions ?? [];
  const v = versions.find((x) => x.status === "PENDING") ?? versions.find((x) => x.status === "APPROVED");
  return (
    <div className="space-y-6">
      <Link href={`/portal/${token}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to overview
      </Link>
      {!v ? (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">There is no proposal to review right now.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <ProposalDocument s={v.snapshot as unknown as ProposalSnapshot} />
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm">
              <span className="font-medium">Version {v.version}</span>
              <StatusBadge status={v.status} />
            </div>
            {v.status === "PENDING" ? (
              <ProposalDecision
                token={token}
                versionId={v.id}
                termsHash={v.termsHash}
                version={v.version}
                totalLabel={formatMoney(v.totalAmount, v.currency)}
                defaultName={grant.client.name}
              />
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <ShieldCheck className="mb-1 size-5" />
                You approved this proposal on {v.decidedAt?.toLocaleDateString("en-US", { dateStyle: "long" })}.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
