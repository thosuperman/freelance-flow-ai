"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";

const schema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});
type Values = z.infer<typeof schema>;

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "" } });
  const isSignUp = mode === "sign-up";

  async function onSubmit(values: Values) {
    setError(null);
    if (isSignUp && !values.name?.trim()) {
      form.setError("name", { message: "Tell us your name" });
      return;
    }
    const res = isSignUp
      ? await signUp.email({ name: values.name!.trim(), email: values.email, password: values.password })
      : await signIn.email({ email: values.email, password: values.password });
    if (res.error) {
      setError(
        res.error.status === 429
          ? "Too many attempts. Please wait a minute."
          : isSignUp
            ? (res.error.message ?? "Could not create the account.")
            : "Incorrect email or password.",
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const errors = form.formState.errors;
  return (
    <div className="w-full max-w-sm animate-fade-up">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{isSignUp ? "Create your workspace" : "Welcome back"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isSignUp ? "Start turning client messages into paid milestones." : "Sign in to your FreelanceFlow workspace."}
        </p>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm" noValidate>
        {isSignUp ? (
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...form.register("name")} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
          {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
        </div>
        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="h-10 w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
          {isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account? " : "New to FreelanceFlow? "}
        <Link className="font-medium text-primary hover:underline" href={isSignUp ? "/sign-in" : "/sign-up"}>
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
