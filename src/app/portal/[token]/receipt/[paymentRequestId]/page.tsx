import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheckBig } from "lucide-react";
import { db } from "@/lib/db";
import { getPortalGrant } from "@/features/portal/service";
import { Money } from "@/components/shared/money";
import { EnvironmentTag } from "@/components/payments/payments-panel";
import { PrintButton } from "@/components/shared/print-button";

export default async function ReceiptPage({ params }: PageProps<"/portal/[token]/receipt/[paymentRequestId]">) {
  const { token, paymentRequestId } = await params;
  const grant = await getPortalGrant(token);
  const pr = await db.paymentRequest.findUnique({ where: { id: paymentRequestId }, include: { milestone: true, project: true, transactions: true } });
  if (!pr || pr.projectId !== grant.projectId) notFound();
  const t = pr.transactions.find((x) => x.status === "COMPLETED");
  const brand = grant.project.owner.profile?.businessName || grant.project.owner.name;
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href={`/portal/${token}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="size-4" /> Back to overview
      </Link>
      {!t ? (
        <div className="rounded-2xl border bg-card p-6 text-sm">No verified payment for this request yet.</div>
      ) : (
        <div className="rounded-2xl border bg-card p-6 shadow-sm" data-testid="receipt">
          <div className="flex items-center gap-3">
            <CircleCheckBig className="size-8 text-emerald-600" />
            <div>
              <h1 className="text-xl font-semibold">Payment received</h1>
              <p className="text-sm text-muted-foreground">Thank you, {grant.client.name.split(" ")[0]}.</p>
            </div>
          </div>
          <div className="my-6 border-y py-5 text-center">
            <Money value={t.amount} currency={t.currency} className="text-3xl font-semibold" />
          </div>
          <dl className="space-y-2 text-sm">
            {[
              ["Paid to", brand],
              ["Project", pr.project.title],
              ["For", pr.milestone.title],
              ["Date", t.capturedAt.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })],
              ["PayPal capture ID", t.providerCaptureId],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium break-all">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Processed via</dt>
              <dd>
                <EnvironmentTag env={t.environment} />
              </dd>
            </div>
          </dl>
          <div className="mt-6 print:hidden">
            <PrintButton />
          </div>
        </div>
      )}
    </div>
  );
}
