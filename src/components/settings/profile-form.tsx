"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { updateProfileAction } from "@/features/settings/actions";

type Values = { businessName: string; defaultCurrency: string; hourlyRate: string };

export function ProfileForm({ initial, redirectTo, submitLabel = "Save" }: { initial: Values; redirectTo?: string; submitLabel?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<Values>({ defaultValues: initial });
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const res = await updateProfileAction(v);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Saved");
          if (redirectTo) router.push(redirectTo);
          router.refresh();
        }),
      )}
    >
      <div className="space-y-1.5">
        <Label htmlFor="businessName">Business name</Label>
        <Input id="businessName" placeholder="e.g. Rivera Studio" {...form.register("businessName")} />
        <p className="text-xs text-muted-foreground">Shown on proposals and in the PayPal checkout.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="defaultCurrency">Default currency</Label>
          <select id="defaultCurrency" className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" {...form.register("defaultCurrency")}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hourlyRate">Hourly rate (optional)</Label>
          <Input id="hourlyRate" inputMode="decimal" placeholder="e.g. 50" {...form.register("hourlyRate")} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Your hourly rate is used to suggest change-request prices from AI effort estimates (hours × rate). AI never sets a price on its own.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
