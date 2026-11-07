"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Save, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SimulatedBadge } from "@/components/shared/status-badge";
import { draftProposalAIAction, saveProposalAction, sendProposalAction } from "@/features/proposals/actions";

type Fields = {
  overview: string;
  timelineSummary: string;
  paymentConditions: string;
  revisionLimit: number;
  revisionPolicy: string;
  changeRequestPolicy: string;
  acceptanceStatement: string;
};

const EMPTY: Fields = {
  overview: "",
  timelineSummary: "",
  paymentConditions: "",
  revisionLimit: 2,
  revisionPolicy: "",
  changeRequestPolicy: "",
  acceptanceStatement: "",
};

export function ProposalEditor({ projectId, initial, simulated, hasPreview }: { projectId: string; initial: Fields | null; simulated: boolean; hasPreview: boolean }) {
  const router = useRouter();
  const form = useForm<Fields>({ defaultValues: initial ?? EMPTY });
  const [aiUsed, setAiUsed] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();

  async function draft() {
    setDrafting(true);
    const res = await draftProposalAIAction(projectId);
    setDrafting(false);
    if (!res.ok) {
      toast.error("AI drafting failed", { description: res.error });
      return;
    }
    const d = res.data.draft;
    form.reset({
      overview: d.overview,
      timelineSummary: d.timelineSummary,
      paymentConditions: d.paymentConditions,
      revisionLimit: Math.max(0, Math.min(20, Math.round(d.revisionLimit))),
      revisionPolicy: d.revisionPolicy,
      changeRequestPolicy: d.changeRequestPolicy,
      acceptanceStatement: d.acceptanceStatement,
    }, { keepDefaultValues: true });
    setAiUsed(true);
    toast.success("Draft ready — review it carefully", { description: "AI never sets prices; amounts come from your milestones." });
  }

  function save(andSend: boolean) {
    start(async () => {
      const values = form.getValues();
      const saved = await saveProposalAction(projectId, values, aiUsed);
      if (!saved.ok) {
        toast.error("Could not save", { description: saved.error });
        return;
      }
      if (!andSend) {
        toast.success("Proposal saved");
        form.reset(values);
        router.refresh();
        return;
      }
      const sent = await sendProposalAction(projectId);
      if (!sent.ok) {
        toast.error("Could not send", { description: sent.error });
        router.refresh();
        return;
      }
      setConfirmOpen(false);
      toast.success(`Proposal v${sent.data.version} sent`, { description: "Share the client portal link with your client." });
      router.refresh();
    });
  }

  const r = form.register;
  return (
    <div className="rounded-2xl border bg-surface p-4 shadow-xs sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Proposal</h2>
          <p className="text-sm text-muted-foreground">AI drafts the wording. You approve every word before your client sees it.</p>
        </div>
        <div className="flex items-center gap-2">
          {simulated ? <SimulatedBadge label="Simulated AI" /> : null}
          <Button type="button" variant="outline" onClick={draft} disabled={drafting || pending} data-testid="draft-proposal-ai">
            {drafting ? <Loader2 className="animate-spin" /> : <Sparkles />} {initial || aiUsed ? "Redraft with AI" : "Draft with AI"}
          </Button>
        </div>
      </div>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="overview">Overview</Label>
          <Textarea id="overview" rows={5} {...r("overview")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timelineSummary">Timeline</Label>
          <Textarea id="timelineSummary" rows={3} {...r("timelineSummary")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paymentConditions">Payment conditions</Label>
          <Textarea id="paymentConditions" rows={3} {...r("paymentConditions")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="revisionPolicy">Revision policy</Label>
          <Textarea id="revisionPolicy" rows={3} {...r("revisionPolicy")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="changeRequestPolicy">Change request policy</Label>
          <Textarea id="changeRequestPolicy" rows={3} {...r("changeRequestPolicy")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acceptanceStatement">How work is accepted</Label>
          <Textarea id="acceptanceStatement" rows={3} {...r("acceptanceStatement")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="revisionLimit">Included revision rounds</Label>
          <Input id="revisionLimit" type="number" min={0} max={20} className="w-28" {...r("revisionLimit", { valueAsNumber: true })} />
        </div>
      </form>
      <div className="mt-6 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => save(false)} disabled={pending}>
          <Save /> Save draft
        </Button>
        <Button type="button" onClick={() => setConfirmOpen(true)} disabled={pending || !form.watch("overview")} data-testid="send-proposal">
          <Send /> Send to client
        </Button>
      </div>
      {!hasPreview ? <p className="mt-2 text-right text-xs text-muted-foreground">Save the draft to see the client preview.</p> : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this proposal?</DialogTitle>
            <DialogDescription>
              The current scope, milestones and wording are frozen into an immutable version. Your client approves that exact version. To change it later
              you will need to withdraw it and send a new version.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep editing
            </Button>
            <Button onClick={() => save(true)} disabled={pending} data-testid="confirm-send-proposal">
              {pending ? <Loader2 className="animate-spin" /> : <Send />} Send proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
