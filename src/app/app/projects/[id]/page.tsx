import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { isDomainError } from "@/lib/errors";
import { requireUser } from "@/features/auth/session";
import { financialsFor, getProjectDetail, type ProjectDetail } from "@/features/projects/service";
import { portalPath } from "@/features/clients/portal-access";
import { reconcilePaymentRequest } from "@/features/payments/service";
import { aiConfig } from "@/lib/ai/provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { FinancialSummary } from "@/components/projects/financial-summary";
import { NextStep } from "@/components/projects/next-step";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { MilestoneBoard } from "@/components/milestones/milestone-board";
import { ScopeList } from "@/components/projects/scope-list";
import { ProposalPanel } from "@/components/proposals/proposal-panel";
import { ScopePanel } from "@/components/ai/scope-panel";
import { PaymentsPanel } from "@/components/payments/payments-panel";
import { ActivityPanel } from "@/components/projects/activity-panel";
import { EXAMPLE_SCOPE_CHANGE } from "@/features/demo/examples";
import { buildTimeline } from "@/features/timeline/build";
import { timelineSourceFor } from "@/features/timeline/service";
import { TimelinePanel } from "@/components/timeline/timeline-panel";
import { JudgeWalkthrough } from "@/components/demo/judge-walkthrough";
import { JUDGE_PROJECT_TITLE } from "@/features/demo/judge-seed";

export const metadata: Metadata = { title: "Project" };

const TABS = ["overview", "proposal", "timeline", "scope", "payments", "activity"] as const;
type Tab = (typeof TABS)[number];

async function load(userId: string, id: string): Promise<ProjectDetail | null> {
  try {
    return await getProjectDetail(userId, id);
  } catch (e) {
    if (isDomainError(e) && e.code === "NOT_FOUND") return null;
    throw e;
  }
}

export default async function ProjectPage({ params, searchParams }: PageProps<"/app/projects/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  let project = await load(user.id, id);
  if (!project) notFound();

  // Resolve payments left in an uncertain state (e.g. browser closed after PayPal approval).
  const uncertain = project.paymentRequests.filter((pr) => pr.attempts.some((a) => ["APPROVED", "CAPTURING", "PENDING"].includes(a.status)));
  if (uncertain.length) {
    for (const pr of uncertain) await reconcilePaymentRequest(pr.id);
    project = (await load(user.id, id))!;
  }

  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";
  const fin = financialsFor(project);
  const grant = project.accessGrants[0];
  const portal = grant ? portalPath(grant.tokenCiphertext) : null;
  const portalAbsolute = portal ? `${process.env.APP_URL ?? ""}${portal}` : null;
  const [events, approvals] = await Promise.all([
    tab === "activity" ? db.auditEvent.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 100 }) : Promise.resolve([]),
    db.approval.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  const ai = aiConfig();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/app/projects" className="hover:text-foreground">
            Projects
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {project.title} <StatusBadge status={project.status} />
          </span>
        }
        description={
          <>
            For <span className="font-medium text-foreground">{project.client.name}</span>
            {project.client.company ? ` · ${project.client.company}` : ""}
            {project.client.email ? ` · ${project.client.email}` : ""}
          </>
        }
        actions={
          <>
            {project.status === "DRAFT" ? (
              <Button variant="outline" asChild>
                <Link href={`/app/projects/${id}/edit`}>
                  <Pencil /> Edit terms
                </Link>
              </Button>
            ) : null}
            {portal ? (
              <>
                <CopyButton value={portalAbsolute!} label="Copy client link" />
                <Button asChild>
                  <a href={portal} target="_blank" rel="noopener" data-testid="open-portal">
                    <ExternalLink /> Client portal
                  </a>
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {user.profile.isDemo && project.title === JUDGE_PROJECT_TITLE ? <JudgeWalkthrough project={project} portal={portal} /> : <NextStep project={project} portal={portal} tour={sp.tour === "1"} />}
      <FinancialSummary fin={fin} currency={project.currency} />

      <ProjectTabs projectId={id} active={tab} counts={{ scope: project.changeRequests.filter((c) => c.status === "PENDING_CLIENT").length, payments: project.paymentRequests.filter((p) => p.status === "OPEN").length }} />

      {tab === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <MilestoneBoard project={project} />
          <ScopeList project={project} />
        </div>
      ) : null}
      {tab === "proposal" ? <ProposalPanel project={project} approvals={approvals} portal={portal} ai={{ simulated: ai.provider === "simulated" }} /> : null}
      {tab === "timeline" ? <TimelinePanel projectId={id} timeline={buildTimeline(timelineSourceFor(project))} /> : null}
      {tab === "scope" ? <ScopePanel project={project} example={EXAMPLE_SCOPE_CHANGE} ai={{ simulated: ai.provider === "simulated" }} hourlyRate={user.profile.hourlyRate} /> : null}
      {tab === "payments" ? <PaymentsPanel project={project} /> : null}
      {tab === "activity" ? <ActivityPanel events={events} approvals={approvals} /> : null}
    </div>
  );
}
