"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CircleCheck, Loader2, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { decideProposalAction } from "@/features/portal/actions";
import { ApprovalFields } from "./approval-fields";

export function ProposalDecision({
  token,
  versionId,
  termsHash,
  version,
  totalLabel,
  defaultName,
}: {
  token: string;
  versionId: string;
  termsHash: string;
  version: number;
  totalLabel: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "revise">("approve");
  const [name, setName] = useState(defaultName);
  const [confirmed, setConfirmed] = useState(false);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await decideProposalAction(token, {
        versionId,
        termsHash,
        decision: mode === "approve" ? "APPROVED" : "CHANGES_REQUESTED",
        actorName: name,
        comment: comment || undefined,
        confirm: mode === "approve" ? confirmed : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      toast.success(mode === "approve" ? "Proposal approved — thank you!" : "Revision request sent");
      router.push(`/portal/${token}`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm" data-testid="proposal-decision">
      <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1 text-sm">
        <button type="button" onClick={() => setMode("approve")} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === "approve" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>
          Approve
        </button>
        <button type="button" onClick={() => setMode("revise")} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === "revise" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>
          Request changes
        </button>
      </div>
      {mode === "approve" ? (
        <div className="space-y-4">
          <ApprovalFields
            id="proposal"
            name={name}
            setName={setName}
            confirmed={confirmed}
            setConfirmed={setConfirmed}
            confirmText={
              <>
                I approve version {version} of this proposal, including its scope and the total price of <strong>{totalLabel}</strong>.
              </>
            }
          />
          <Button className="h-10 w-full" disabled={pending || !confirmed || name.trim().length < 2} onClick={submit} data-testid="approve-proposal">
            {pending ? <Loader2 className="animate-spin" /> : <CircleCheck />} Approve proposal
          </Button>
          <p className="text-[11px] text-muted-foreground">We record your name, the time and the exact version you approved. This is not a qualified electronic signature.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="revise-comment">What should change?</Label>
            <Textarea id="revise-comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <ApprovalFields id="revise" name={name} setName={setName} confirmed={true} setConfirmed={() => {}} confirmText="Send this feedback to the freelancer." />
          <Button variant="outline" className="h-10 w-full" disabled={pending || comment.trim().length < 3 || name.trim().length < 2} onClick={submit}>
            {pending ? <Loader2 className="animate-spin" /> : <MessageSquareWarning />} Request changes
          </Button>
        </div>
      )}
    </div>
  );
}
