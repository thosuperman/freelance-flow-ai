"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CircleCheck, Loader2, PackageOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/money";
import { reviewMilestoneAction } from "@/features/portal/actions";

export function MilestoneReview({
  token,
  milestone: m,
  defaultName,
}: {
  token: string;
  milestone: { id: string; title: string; description: string; note: string | null; amount: string; currency: string };
  defaultName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [comment, setComment] = useState("");
  const [showChanges, setShowChanges] = useState(false);
  const [pending, start] = useTransition();

  function decide(decision: "APPROVED" | "CHANGES_REQUESTED") {
    start(async () => {
      const res = await reviewMilestoneAction(token, { milestoneId: m.id, decision, actorName: name, comment: comment || undefined });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(decision === "APPROVED" ? "Delivery accepted" : "Change request sent to the freelancer");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xs" data-testid="portal-milestone-review">
      <div className="flex gap-3">
        <PackageOpen className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="flex-1">
          <div className="font-semibold">{m.title}</div>
          {m.note ? <p className="mt-1 rounded-lg bg-muted/60 p-2.5 text-sm">“{m.note}”</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">Accepting makes {formatMoney(m.amount, m.currency)} payable for this milestone.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`ms-name-${m.id}`}>Your name</Label>
          <Input id={`ms-name-${m.id}`} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {showChanges ? (
          <div className="space-y-1.5">
            <Label htmlFor={`ms-comment-${m.id}`}>What needs to change?</Label>
            <Textarea id={`ms-comment-${m.id}`} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {showChanges ? (
            <Button variant="outline" disabled={pending || comment.trim().length < 3} onClick={() => decide("CHANGES_REQUESTED")}>
              <RotateCcw /> Send change request
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setShowChanges(true)}>
              <RotateCcw /> Request changes
            </Button>
          )}
          <Button disabled={pending || name.trim().length < 2} onClick={() => decide("APPROVED")} data-testid="accept-delivery">
            {pending ? <Loader2 className="animate-spin" /> : <CircleCheck />} Accept delivery
          </Button>
        </div>
      </div>
    </div>
  );
}
