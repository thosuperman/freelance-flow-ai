"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApprovalFields({
  id,
  name,
  setName,
  confirmed,
  setConfirmed,
  confirmText,
}: {
  id: string;
  name: string;
  setName: (v: string) => void;
  confirmed: boolean;
  setConfirmed: (v: boolean) => void;
  confirmText: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`}>Your full name</Label>
        <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <label htmlFor={`${id}-confirm`} className="flex cursor-pointer items-start gap-2.5 text-sm">
        <Checkbox id={`${id}-confirm`} checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
        <span>{confirmText}</span>
      </label>
    </div>
  );
}
