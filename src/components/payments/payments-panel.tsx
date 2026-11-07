import { Receipt } from "lucide-react";
import type { ProjectDetail } from "@/features/projects/service";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { SimulatedBadge, StatusBadge, Pill } from "@/components/shared/status-badge";

const fmt = (d: Date | null) => (d ? d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—");

export function EnvironmentTag({ env }: { env: string }) {
  if (env === "mock") return <SimulatedBadge label="Simulated PayPal" />;
  if (env === "sandbox") return <Pill tone="info" dot={false}>PayPal Sandbox</Pill>;
  return <Pill tone="success" dot={false}>PayPal Live</Pill>;
}

export function PaymentsPanel({ project }: { project: ProjectDetail }) {
  if (project.paymentRequests.length === 0) {
    return <EmptyState icon={Receipt} title="No payment requests yet" description="Request payment from an approved milestone. Your client pays via PayPal in their portal." />;
  }
  return (
    <div className="space-y-3">
      {project.paymentRequests.map((pr) => (
        <div key={pr.id} className="rounded-2xl border bg-card p-4 shadow-xs" data-testid="payment-request">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{pr.milestone.title}</h3>
                <StatusBadge status={pr.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                Requested {fmt(pr.createdAt)} · due {pr.dueDate.toLocaleDateString("en-US", { dateStyle: "medium" })}
                {pr.paidAt ? ` · paid ${fmt(pr.paidAt)}` : ""}
              </p>
            </div>
            <Money value={pr.amount} currency={pr.currency} className="text-lg font-semibold" />
          </div>
          {pr.transactions.length || pr.attempts.length ? (
            <div className="mt-3 overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">PayPal reference</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Verified via</th>
                    <th className="px-3 py-2 font-medium">Environment</th>
                    <th className="px-3 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {pr.transactions.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-3 py-2 font-mono">Capture {t.providerCaptureId}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={t.status === "COMPLETED" ? "PAID" : t.status} />
                      </td>
                      <td className="px-3 py-2">{t.verifiedVia.replace(/_/g, " ").toLowerCase()}</td>
                      <td className="px-3 py-2">
                        <EnvironmentTag env={t.environment} />
                      </td>
                      <td className="px-3 py-2">{fmt(t.capturedAt)}</td>
                    </tr>
                  ))}
                  {pr.attempts
                    .filter((a) => a.status !== "COMPLETED")
                    .map((a) => (
                      <tr key={a.id} className="border-t text-muted-foreground">
                        <td className="px-3 py-2 font-mono">Order {a.providerOrderId}</td>
                        <td className="px-3 py-2">{a.status.toLowerCase()}{a.lastError ? ` (${a.lastError})` : ""}</td>
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2">
                          <EnvironmentTag env={a.environment} />
                        </td>
                        <td className="px-3 py-2">{fmt(a.createdAt)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
