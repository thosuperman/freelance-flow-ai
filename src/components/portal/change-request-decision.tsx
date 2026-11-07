"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CircleCheck, FileDiff, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { decideChangeRequestAction } from "@/features/portal/actions";
import { ApprovalFields } from "./approval-fields";

type CR = {
  id: string;
  number: number;
  title: string;
  description: string;
  deliverables: { title: string; description: string }[];
  amount: string;
  currency: string;
  billingTiming: string;
  termsHash: string;
};

export function ChangeRequestDecision({ token, cr, defaultName, revisedTotal }: { token: string; cr: CR; defaultName: string; revisedTotal: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, start] = useTransition();

  function decide(decision: "APPROVED" | "REJECTED") {
    start(async () => {
      const res = await decideChangeRequestAction(token, {
        changeRequestId: cr.id,
        termsHash: cr.termsHash,
        decision,
        actorName: name,
        confirm: decision === "APPROVED" ? confirmed : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      toast.success(decision === "APPROVED" ? "Change request approved" : "Change request declined");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-5" data-testid="portal-change-request">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <FileDiff className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div>
            <div className="text-xs font-semibold text-amber-800">Change request #{cr.number}</div>
            <div className="font-semibold">{cr.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{cr.description}</p>
            <ul className="mt-2 list-disc pl-4 text-sm">
              {cr.deliverables.map((d) => (
                <li key={d.title}>
                  <span className="font-medium">{d.title}</span>
                  {d.description ? <span className="text-muted-foreground"> — {d.description}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-semibold">{formatMoney(cr.amount, cr.currency)}</div>
          <div className="text-xs text-muted-foreground">{cr.billingTiming === "ON_APPROVAL" ? "Payable once approved" : "Payable after delivery"}</div>
        </div>
      </div>
      <div className="mt-4 space-y-3 border-t border-amber-200 pt-4">
        <ApprovalFields
          id={`cr-${cr.id}`}
          name={name}
          setName={setName}
          confirmed={confirmed}
          setConfirmed={setConfirmed}
          confirmText={
            <>
              I approve this additional work for <strong>{formatMoney(cr.amount, cr.currency)}</strong>. The project total becomes {formatMoney(revisedTotal, cr.currency)}.
            </>
          }
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={pending || name.trim().length < 2} onClick={() => decide("REJECTED")}>
            <X /> Decline
          </Button>
          <Button disabled={pending || !confirmed || name.trim().length < 2} onClick={() => decide("APPROVED")} data-testid="approve-change-request">
            {pending ? <Loader2 className="animate-spin" /> : <CircleCheck />} Approve change
          </Button>
        </div>
      </div>
    </div>
  );
}
