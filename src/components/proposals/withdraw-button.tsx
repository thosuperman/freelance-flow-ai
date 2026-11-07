"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withdrawProposalAction } from "@/features/proposals/actions";

export function WithdrawProposalButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!window.confirm("Withdraw this proposal? Your client will no longer be able to approve it.")) return;
          const res = await withdrawProposalAction(projectId);
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Proposal withdrawn — terms are editable again");
            router.refresh();
          }
        })
      }
    >
      <Undo2 /> Withdraw to edit
    </Button>
  );
}
