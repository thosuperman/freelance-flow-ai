"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startDemoAction, startFullDemoAction } from "@/features/demo/actions";

export function StartDemoButton({ full = false, variant = "default" }: { full?: boolean; variant?: "default" | "outline" }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        variant={variant}
        className="h-11 px-5 text-base"
        disabled={pending}
        data-testid={full ? "start-full-demo" : "start-demo"}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await (full ? startFullDemoAction() : startDemoAction());
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {full ? "Try the full demo" : "Start my demo workspace"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
