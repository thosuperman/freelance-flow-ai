import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/features/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status-badge";
import { EnvironmentTag } from "@/components/payments/payments-panel";

export const metadata: Metadata = { title: "Payment history" };

export default async function PaymentsPage() {
  const user = await requireUser();
  const requests = await db.paymentRequest.findMany({
    where: { project: { ownerId: user.id } },
    include: { project: { include: { client: true } }, transactions: true, milestone: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Payment history" description="Every payment request and verified PayPal capture across your projects." />
      {requests.length === 0 ? (
        <EmptyState icon={Receipt} title="No payments yet" description="Payment requests you create from approved milestones appear here." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-xs">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Requested</th>
                <th className="px-4 py-2.5 font-medium">Project · milestone</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">PayPal capture</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const t = r.transactions.find((x) => x.status === "COMPLETED") ?? r.transactions[0];
                return (
                  <tr key={r.id} className="border-b last:border-0" data-testid="payment-history-row">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</td>
                    <td className="px-4 py-3">
                      <Link href={`/app/projects/${r.projectId}?tab=payments`} className="font-medium hover:underline">
                        {r.project.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {r.milestone.title} · {r.project.client.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {t ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-mono">{t.providerCaptureId}</span>
                          <EnvironmentTag env={t.environment} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      <Money value={r.amount} currency={r.currency} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
