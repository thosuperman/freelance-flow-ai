import type { Approval, AuditEvent } from "@prisma/client";
import { History } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

const LABELS: Record<string, string> = {
  "project.created": "Project created",
  "project.terms_updated": "Terms updated",
  "proposal.sent": "Proposal sent",
  "proposal.withdrawn": "Proposal withdrawn",
  "proposal.approved": "Proposal approved by client",
  "proposal.revision_requested": "Client requested proposal revisions",
  "milestone.start": "Milestone started",
  "milestone.submit": "Milestone submitted for review",
  "milestone.accepted": "Client accepted milestone",
  "milestone.changes_requested": "Client requested milestone changes",
  "change_request.created": "Change request drafted",
  "change_request.sent": "Change request sent",
  "change_request.withdrawn": "Change request withdrawn",
  "change_request.approved": "Client approved change request",
  "change_request.rejected": "Client rejected change request",
  "payment_request.created": "Payment requested",
  "payment_request.cancelled": "Payment request cancelled",
  "payment.order_created": "Client started PayPal checkout",
  "payment.captured": "Payment captured & verified",
  "payment.pending": "Payment pending at PayPal",
  "payment.declined": "Payment declined",
  "payment.verification_failed": "Payment verification failed",
  "payment.refunded": "Payment refunded",
  "payment.reversed": "Payment reversed",
  "portal.link_regenerated": "Client link regenerated",
};

const ACTOR: Record<string, string> = { FREELANCER: "You", CLIENT: "Client", SYSTEM: "System", PAYPAL: "PayPal" };

export function ActivityPanel({ events, approvals }: { events: AuditEvent[]; approvals: Approval[] }) {
  if (events.length === 0) return <EmptyState icon={History} title="No activity yet" />;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ol className="relative space-y-4 border-l pl-5">
        {events.map((e) => (
          <li key={e.id} className="relative">
            <span aria-hidden className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-white bg-primary ring-1 ring-border" />
            <div className="text-sm font-medium">{LABELS[e.action] ?? e.action}</div>
            <div className="text-xs text-muted-foreground">
              {ACTOR[e.actorType]} · {e.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </li>
        ))}
      </ol>
      <aside className="rounded-2xl border bg-card p-4 shadow-xs lg:self-start">
        <h3 className="mb-2 text-sm font-semibold">Approvals log</h3>
        {approvals.length === 0 ? <p className="text-xs text-muted-foreground">No client decisions yet.</p> : null}
        <ul className="space-y-2 text-xs">
          {approvals.map((a) => (
            <li key={a.id} className="rounded-lg bg-muted/50 p-2">
              <div className="font-medium">
                {a.subjectType.replace(/_/g, " ").toLowerCase()} · {a.decision.replace(/_/g, " ").toLowerCase()}
              </div>
              <div className="text-muted-foreground">
                {a.actorName} · {a.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </div>
              {a.comment ? <div className="mt-0.5 italic">“{a.comment}”</div> : null}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
