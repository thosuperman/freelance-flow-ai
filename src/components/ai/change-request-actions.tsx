"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendChangeRequestAction, withdrawChangeRequestAction } from "@/features/scope-changes/actions";

export function ChangeRequestActions({ projectId, id, status }: { projectId: string; id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Something went wrong");
      else {
        toast.success(msg);
        router.refresh();
      }
    });
  return (
    <div className="flex gap-2">
      {status === "DRAFT" ? (
        <Button size="sm" disabled={pending} onClick={() => run(() => sendChangeRequestAction(projectId, id), "Sent to client")}>
          <Send /> Send
        </Button>
      ) : null}
      {status === "DRAFT" || status === "PENDING_CLIENT" ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => withdrawChangeRequestAction(projectId, id), "Change request withdrawn")}>
          <Undo2 /> Withdraw
        </Button>
      ) : null}
    </div>
  );
}
