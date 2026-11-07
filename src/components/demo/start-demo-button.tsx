"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startDemoAction } from "@/features/demo/actions";

export function StartDemoButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="h-11 px-5 text-base"
        disabled={pending}
        data-testid="start-demo"
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await startDemoAction();
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Start my demo workspace
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
