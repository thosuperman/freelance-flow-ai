import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { paypalConfig } from "@/lib/paypal";
import { getPortalGrant } from "@/features/portal/service";
import { reconcilePaymentRequest } from "@/features/payments/service";
import { Money } from "@/components/shared/money";
import { PayPalCheckout } from "@/components/payments/paypal-checkout";

export default async function PayPage({ params }: PageProps<"/portal/[token]/pay/[paymentRequestId]">) {
  const { token, paymentRequestId } = await params;
  const grant = await getPortalGrant(token);
  let pr = await db.paymentRequest.findUnique({ where: { id: paymentRequestId }, include: { milestone: true, project: true, attempts: true } });
  if (!pr || pr.projectId !== grant.projectId) notFound();
  if (pr.attempts.some((a) => ["APPROVED", "CAPTURING", "PENDING"].includes(a.status))) {
    await reconcilePaymentRequest(pr.id);
    pr = await db.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequestId }, include: { milestone: true, project: true, attempts: true } });
  }
  if (pr.status === "PAID") redirect(`/portal/${token}/receipt/${pr.id}`);
  const cfg = paypalConfig();
  const brand = grant.project.owner.profile?.businessName || grant.project.owner.name;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href={`/portal/${token}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to overview
      </Link>
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Payment request</div>
        <h1 className="mt-1 text-xl font-semibold">{pr.milestone.title}</h1>
        <p className="text-sm text-muted-foreground">
          {pr.project.title} · to {brand}
        </p>
        <div className="my-6 flex items-end justify-between border-y py-5">
          <span className="text-sm text-muted-foreground">Amount due</span>
          <Money value={pr.amount} currency={pr.currency} className="text-3xl font-semibold tracking-tight" />
        </div>
        {pr.status === "CANCELLED" ? (
          <p className="rounded-xl bg-muted p-4 text-sm">This payment request was cancelled by the freelancer.</p>
        ) : pr.status === "PROCESSING" ? (
          <p className="rounded-xl bg-sky-50 p-4 text-sm text-sky-900">PayPal is still processing your payment. You don’t need to pay again — this page updates once it’s confirmed.</p>
        ) : (
          <PayPalCheckout token={token} paymentRequestId={pr.id} currency={pr.currency} mode={cfg.mode} clientId={cfg.clientId} />
        )}
      </div>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" /> The amount is set by the approved agreement and verified by our server with PayPal.
      </p>
    </div>
  );
}
