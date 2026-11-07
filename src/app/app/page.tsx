import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, FolderKanban, Sparkles } from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { getDashboard } from "@/features/dashboard/service";
import { milestoneStage } from "@/features/milestones/rules";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Stat } from "@/components/shared/stat";
import { StageBadge, StatusBadge } from "@/components/shared/status-badge";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { EnvironmentTag } from "@/components/payments/payments-panel";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user.profile.onboarded) redirect("/app/onboarding");
  const d = await getDashboard(user.id);
  const first = user.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Good to see you, ${first}`}
        description="Your agreed work, payments and what needs attention — all from verified records."
        actions={
          <Button asChild size="lg" className="h-10">
            <Link href="/app/new">
              <Sparkles /> Turn a client message into a project
            </Link>
          </Button>
        }
      />

      {d.rows.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Start with a client conversation"
          description="Paste a message from a client and FreelanceFlow drafts the project, milestones and payment schedule for you to review."
          action={
            <Button asChild>
              <Link href="/app/new?example=landing">
                Try it with an example <ArrowRight />
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {d.totals.map((t) => (
            <section key={t.currency} aria-label={`Totals in ${t.currency}`} className="space-y-2">
              {d.totals.length > 1 ? <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.currency}</h2> : null}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid={`dashboard-totals-${t.currency}`}>
                <Stat label="Approved project value" value={<Money value={t.approvedValue} currency={t.currency} />} hint={<>incl. <Money value={t.approvedChanges} currency={t.currency} /> in approved changes</>} />
                <Stat label="Paid" value={<Money value={t.paid} currency={t.currency} />} tone="success" hint="Verified PayPal captures" />
                <Stat label="Outstanding" value={<Money value={t.outstanding} currency={t.currency} />} hint="Approved but not yet paid" />
                <Stat
                  label="Pending payment requests"
                  value={<Money value={t.pending} currency={t.currency} />}
                  tone={!t.overdue.isZero() ? "danger" : t.pending.isZero() ? "default" : "warning"}
                  hint={t.overdue.isZero() ? "Awaiting client payment" : <>Overdue: <Money value={t.overdue} currency={t.currency} /></>}
                />
              </div>
            </section>
          ))}

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Active projects" value={d.activeCount} />
            <Stat label="Awaiting approval" value={d.awaitingApproval} />
            <Stat label="Overdue requests" value={d.overdueCount} tone={d.overdueCount ? "danger" : "default"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Projects</h2>
                <Link href="/app/projects" className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </div>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
                {d.rows.slice(0, 6).map(({ project: p, fin }) => (
                  <li key={p.id}>
                    <Link href={`/app/projects/${p.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
                        <FolderKanban className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{p.client.name}</div>
                      </div>
                      <div className="hidden text-right sm:block">
                        <div className="text-sm font-medium">
                          <Money value={fin.hasApprovedAgreement ? fin.revisedValue : p.budget} currency={p.currency} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <Money value={fin.paid} currency={p.currency} /> paid
                        </div>
                      </div>
                      <StatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>

              {d.monthly ? <MonthlyChart currency={d.monthly.currency} months={d.monthly.months.map((m) => ({ label: m.label, value: m.total.toFixed(2) }))} /> : null}
            </section>

            <div className="space-y-6">
              <section className="rounded-2xl border bg-card p-4 shadow-xs">
                <h2 className="mb-3 text-sm font-semibold">Upcoming milestones</h2>
                {d.upcoming.length === 0 ? <p className="text-xs text-muted-foreground">No open milestones on active projects.</p> : null}
                <ul className="space-y-3">
                  {d.upcoming.map(({ m, p }) => (
                    <li key={m.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/app/projects/${p.id}`} className="block truncate text-sm font-medium hover:underline">
                          {m.title}
                        </Link>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="size-3" />
                          {m.dueDate ? m.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "No date"} · {p.title}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Money value={m.amount} currency={m.currency} className="text-sm font-medium" />
                        <StageBadge stage={milestoneStage(m)} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl border bg-card p-4 shadow-xs">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Recent payments</h2>
                  <Link href="/app/payments" className="text-xs font-medium text-primary hover:underline">
                    History
                  </Link>
                </div>
                {d.recentTransactions.length === 0 ? <p className="text-xs text-muted-foreground">No payments received yet.</p> : null}
                <ul className="space-y-3">
                  {d.recentTransactions.map(({ t, pr, p }) => (
                    <li key={t.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{pr.description}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {t.capturedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {p.client.name} <EnvironmentTag env={t.environment} />
                        </div>
                      </div>
                      <Money value={t.amount} currency={t.currency} className={t.status === "COMPLETED" ? "text-sm font-medium text-emerald-700" : "text-sm text-muted-foreground line-through"} />
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
