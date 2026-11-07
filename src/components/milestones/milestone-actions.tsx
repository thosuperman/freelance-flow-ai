"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, PlayCircle, Receipt, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { milestoneWorkAction } from "@/features/milestones/actions";
import { cancelPaymentRequestAction, createPaymentRequestAction } from "@/features/payments/actions";

type Props = {
  projectId: string;
  milestone: { id: string; title: string; workStatus: string; termsStatus: string; requiresDelivery: boolean; paymentStatus: string };
  projectActive: boolean;
  eligible: boolean;
  ineligibleReason: string | null;
  openRequestId: string | null;
};

export function MilestoneActions({ projectId, milestone: m, projectActive, eligible, openRequestId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<"submit" | "request" | null>(null);
  const [note, setNote] = useState("");
  const [dueInDays, setDueInDays] = useState("7");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong");
      else {
        toast.success(success);
        setDialog(null);
        router.refresh();
      }
    });
  }

  const canWork = projectActive && m.termsStatus === "APPROVED" && m.requiresDelivery;
  return (
    <div className="flex flex-wrap gap-2 md:justify-end">
      {canWork && (m.workStatus === "NOT_STARTED" || m.workStatus === "CHANGES_REQUESTED") ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => milestoneWorkAction(projectId, m.id, "start"), "Marked in progress")}>
          <PlayCircle /> Start
        </Button>
      ) : null}
      {canWork && ["NOT_STARTED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(m.workStatus) ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setDialog("submit")}>
          <Send /> Submit for review
        </Button>
      ) : null}
      {eligible ? (
        <Button size="sm" disabled={pending} onClick={() => setDialog("request")} data-testid="request-payment">
          <Receipt /> Request payment
        </Button>
      ) : null}
      {openRequestId ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => cancelPaymentRequestAction(projectId, openRequestId), "Payment request cancelled")}>
          <XCircle /> Cancel request
        </Button>
      ) : null}

      <Dialog open={dialog === "submit"} onOpenChange={(o) => setDialog(o ? "submit" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit “{m.title}” for review</DialogTitle>
            <DialogDescription>Your client will be asked to accept the work or request changes in their portal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`note-${m.id}`}>Delivery note (optional)</Label>
            <Textarea id={`note-${m.id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Staging link: https://… — feedback welcome!" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button disabled={pending} onClick={() => run(() => milestoneWorkAction(projectId, m.id, "submit", note), "Submitted for client review")}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />} Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "request"} onOpenChange={(o) => setDialog(o ? "request" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request payment</DialogTitle>
            <DialogDescription>
              The amount comes from the approved milestone and cannot be changed here. Your client pays through PayPal in their portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`due-${m.id}`}>Due in (days)</Label>
            <Input id={`due-${m.id}`} type="number" min={0} max={120} value={dueInDays} onChange={(e) => setDueInDays(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              data-testid="confirm-payment-request"
              onClick={() => run(() => createPaymentRequestAction(projectId, { milestoneId: m.id, dueInDays: Number(dueInDays) || 7 }), "Payment request created")}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Receipt />} Create payment request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
