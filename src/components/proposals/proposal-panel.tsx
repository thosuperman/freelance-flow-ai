import type { Approval } from "@prisma/client";
import { ShieldCheck } from "lucide-react";
import { buildProposalSnapshot, type ProposalSnapshot } from "@/features/proposals/service";
import type { ProjectDetail } from "@/features/projects/service";
import { StatusBadge } from "@/components/shared/status-badge";
import { Money } from "@/components/shared/money";
import { ProposalDocument } from "./proposal-document";
import { ProposalEditor } from "./proposal-editor";
import { WithdrawProposalButton } from "./withdraw-button";

export function ProposalPanel({
  project,
  approvals,
  portal,
  ai,
}: {
  project: ProjectDetail;
  approvals: Approval[];
  portal: string | null;
  ai: { simulated: boolean };
}) {
  const versions = project.proposal?.versions ?? [];
  const current = versions.find((v) => v.status === "PENDING" || v.status === "APPROVED");
  const lastDecided = versions[0];

  if (project.status === "DRAFT") {
    const preview = project.proposal ? buildProposalSnapshot(project, (versions[0]?.version ?? 0) + 1, { name: project.client.name, businessName: null }) : null;
    return (
      <div className="space-y-4">
        {lastDecided?.status === "REVISION_REQUESTED" ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <strong>Version {lastDecided.version}: revision requested.</strong> {lastDecided.clientNote ? `“${lastDecided.clientNote}”` : null}
          </div>
        ) : null}
        <ProposalEditor
          projectId={project.id}
          simulated={ai.simulated}
          initial={
            project.proposal
              ? {
                  overview: project.proposal.overview,
                  timelineSummary: project.proposal.timelineSummary,
                  paymentConditions: project.proposal.paymentConditions,
                  revisionLimit: project.proposal.revisionLimit,
                  revisionPolicy: project.proposal.revisionPolicy,
                  changeRequestPolicy: project.proposal.changeRequestPolicy,
                  acceptanceStatement: project.proposal.acceptanceStatement,
                }
              : null
          }
          hasPreview={Boolean(preview)}
        />
        {preview ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Client preview</h2>
            <ProposalDocument s={{ ...preview, freelancer: { name: "You", businessName: null } }} />
          </div>
        ) : null}
      </div>
    );
  }

  if (!current) return null;
  const snapshot = current.snapshot as unknown as ProposalSnapshot;
  const approval = approvals.find((a) => a.subjectType === "PROPOSAL_VERSION" && a.subjectId === current.id && a.decision === "APPROVED");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <ProposalDocument s={snapshot} />
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border bg-card p-4 text-sm shadow-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">Version {current.version}</span>
            <StatusBadge status={current.status} />
          </div>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium">
                <Money value={current.totalAmount} currency={current.currency} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Sent</dt>
              <dd>{current.sentAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Terms hash</dt>
              <dd className="font-mono" title={current.termsHash}>
                {current.termsHash.slice(0, 12)}…
              </dd>
            </div>
          </dl>
          {current.status === "PENDING" ? (
            <div className="mt-3 space-y-2 border-t pt-3">
              <p className="text-xs text-muted-foreground">Terms are locked while your client reviews this version.</p>
              {portal ? (
                <a className="block text-xs font-medium text-primary hover:underline" href={portal} target="_blank" rel="noopener">
                  Open the client portal →
                </a>
              ) : null}
              <WithdrawProposalButton projectId={project.id} />
            </div>
          ) : null}
        </div>
        {approval ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs shadow-xs" data-testid="approval-record">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
              <ShieldCheck className="size-4" /> Approval record
            </div>
            <dl className="space-y-1">
              <div className="flex justify-between gap-2">
                <dt className="text-emerald-900/70">Approved by</dt>
                <dd className="font-medium">{approval.actorName}</dd>
              </div>
              {approval.actorEmail ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-emerald-900/70">Client email</dt>
                  <dd>{approval.actorEmail}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-emerald-900/70">When</dt>
                <dd>{approval.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-emerald-900/70">Amount</dt>
                <dd>{approval.amount ? <Money value={approval.amount} currency={approval.currency!} /> : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-emerald-900/70">Version hash</dt>
                <dd className="font-mono">{approval.termsHash?.slice(0, 12)}…</dd>
              </div>
            </dl>
          </div>
        ) : null}
        {versions.length > 1 ? (
          <div className="rounded-2xl border bg-card p-4 text-xs shadow-xs">
            <div className="mb-2 text-sm font-semibold">Version history</div>
            <ul className="space-y-1.5">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span>v{v.version}</span>
                  <StatusBadge status={v.status} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
