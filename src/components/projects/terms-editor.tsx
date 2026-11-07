"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateProjectTermsAction } from "@/features/projects/actions";
import { TermsFields, reconciliation, toTermsPayload, type TermsFormValues } from "./terms-form";

export function TermsEditor({ projectId, initial }: { projectId: string; initial: TermsFormValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<TermsFormValues>({ defaultValues: initial });
  const rec = reconciliation(form.watch());
  return (
    <form
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const res = await updateProjectTermsAction(projectId, toTermsPayload(v));
          if (!res.ok) {
            toast.error("Could not save", { description: res.error });
            return;
          }
          toast.success("Terms saved");
          router.push(`/app/projects/${projectId}?tab=proposal`);
          router.refresh();
        }),
      )}
      className="space-y-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/app/projects/${projectId}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to project
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Edit project terms</h1>
          <p className="text-sm text-muted-foreground">Terms can be edited until the proposal is sent.</p>
        </div>
        <Button type="submit" disabled={pending || !rec.balanced}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save terms
        </Button>
      </div>
      <div className="rounded-2xl border bg-surface p-4 shadow-xs sm:p-6">
        <TermsFields control={form.control} register={form.register} watch={form.watch} showClient={false} />
      </div>
    </form>
  );
}
