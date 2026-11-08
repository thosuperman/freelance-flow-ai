import "server-only";
import { getProjectDetail, type ProjectDetail } from "@/features/projects/service";
import { explainTimelineWithAI } from "@/features/ai/service";
import type { TimelineInsightContext } from "@/lib/ai/simulated";
import { buildTimeline, type Timeline, type TimelineSource } from "./build";

type Snapshot = { milestones?: { id: string; dueDate: string | null }[] };

export function timelineSourceFor(project: ProjectDetail, today = new Date()): TimelineSource {
  const approved = project.proposal?.versions.find((v) => v.status === "APPROVED") ?? null;
  const snapshot = (approved?.snapshot ?? null) as Snapshot | null;
  return {
    today,
    project: { startDate: project.startDate, createdAt: project.createdAt, currency: project.currency },
    baseline: approved
      ? { version: approved.version, approvedAt: approved.decidedAt, milestones: (snapshot?.milestones ?? []).map((m) => ({ id: m.id, dueDate: m.dueDate })) }
      : null,
    milestones: project.milestones.map((m) => ({
      id: m.id,
      position: m.position,
      kind: m.kind,
      title: m.title,
      amount: m.amount,
      currency: m.currency,
      dueDate: m.dueDate,
      termsStatus: m.termsStatus,
      workStatus: m.workStatus,
      paymentStatus: m.paymentStatus,
      changeRequestId: m.changeRequestId,
    })),
    changeRequests: project.changeRequests.map((c) => ({ id: c.id, number: c.number, title: c.title, status: c.status, decidedAt: c.decidedAt, dueDate: c.dueDate })),
    paymentRequests: project.paymentRequests
      .filter((p) => p.status !== "CANCELLED")
      .map((p) => ({ id: p.id, milestoneId: p.milestoneId, dueDate: p.dueDate, status: p.status, paidAt: p.paidAt })),
    scopeItems: project.scopeItems.map((s) => ({ kind: s.kind, title: s.title, milestoneId: s.milestoneId, changeRequestId: s.changeRequestId })),
  };
}

/** Owner-scoped: getProjectDetail throws NOT_FOUND for anyone but the owner. */
export async function getProjectTimeline(userId: string, projectId: string): Promise<Timeline> {
  return buildTimeline(timelineSourceFor(await getProjectDetail(userId, projectId)));
}

/** Timeline end dates are exclusive (Gantt convention); people and the AI get the inclusive last day. */
function lastDay(exclusiveEnd: string): string {
  return new Date(Date.parse(`${exclusiveEnd}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

export function insightContext(t: Timeline): TimelineInsightContext {
  const name = (id: string) => t.tasks.find((x) => x.id === id)?.name ?? id;
  return {
    late: t.tasks.filter((x) => x.flags.late).map((x) => ({ name: x.name, dueDate: lastDay(x.endDate) })),
    affected: t.risks.affected.map(name),
    overduePayments: t.risks.overduePayments.map(({ milestoneTitle, amount, currency, dueDate }) => ({ milestoneTitle, amount, currency, dueDate })),
    changes: t.changes.map(({ number, title, extendsScheduleByDays }) => ({ number, title, extendsScheduleByDays })),
    endDate: lastDay(t.endDate),
    baselineEndDate: t.baselineEndDate ? lastDay(t.baselineEndDate) : null,
  };
}

export async function explainProjectTimeline(user: { id: string; profile: { isDemo: boolean } }, projectId: string) {
  const timeline = await getProjectTimeline(user.id, projectId);
  return explainTimelineWithAI(user, projectId, insightContext(timeline));
}
