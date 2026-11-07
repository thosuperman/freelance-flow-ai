"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy", variant = "outline" }: { value: string; label?: string; variant?: "outline" | "ghost" | "secondary" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Could not copy — select and copy manually", { description: value });
        }
      }}
    >
      {copied ? <Check /> : <Copy />} {label}
    </Button>
  );
}
