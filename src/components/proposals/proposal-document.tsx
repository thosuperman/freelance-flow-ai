import { CalendarDays, CircleSlash, PackageCheck } from "lucide-react";
import { Money } from "@/components/shared/money";
import type { ProposalSnapshot } from "@/features/proposals/service";

function fmtDate(d: string | null) {
  return d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

/** Renders a proposal snapshot exactly as stored — used for previews, the client view and approved records. */
export function ProposalDocument({ s }: { s: ProposalSnapshot }) {
  return (
    <article className="space-y-7 rounded-2xl border bg-white p-5 shadow-sm sm:p-8" data-testid="proposal-document">
      <header className="space-y-2 border-b pb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-primary">Proposal · version {s.version}</div>
        <h2 className="text-2xl font-semibold tracking-tight">{s.title}</h2>
        <p className="text-sm text-muted-foreground">
          Prepared by <span className="font-medium text-foreground">{s.freelancer.businessName || s.freelancer.name}</span> for{" "}
          <span className="font-medium text-foreground">{s.client.company ? `${s.client.name}, ${s.client.company}` : s.client.name}</span>
          {s.startDate ? ` · starting ${fmtDate(s.startDate)}` : ""}
        </p>
      </header>

      <Section title="Overview">
        <p className="whitespace-pre-line">{s.terms.overview}</p>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Deliverables">
          <ul className="space-y-2">
            {s.deliverables.map((d) => (
              <li key={d.id} className="flex gap-2">
                <PackageCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <span className="font-medium">{d.title}</span>
                  {d.description ? <span className="block text-muted-foreground">{d.description}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Not included">
          {s.exclusions.length ? (
            <ul className="space-y-1.5">
              {s.exclusions.map((e) => (
                <li key={e.id} className="flex gap-2 text-muted-foreground">
                  <CircleSlash className="mt-0.5 size-4 shrink-0" />
                  {e.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No explicit exclusions.</p>
          )}
        </Section>
      </div>

      <Section title="Milestones & pricing">
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Milestone</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Due</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {s.milestones.map((m) => (
                <tr key={m.id} className="border-t align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground">{m.kind === "DEPOSIT" ? "Due on approval of this proposal" : "Due when you accept the delivery"}</div>
                    {m.dueDate ? (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground sm:hidden">
                        <CalendarDays className="size-3" /> {fmtDate(m.dueDate)}
                      </div>
                    ) : null}
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">{fmtDate(m.dueDate) ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right font-medium">
                    <Money value={m.amount} currency={s.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40">
                <td className="px-3 py-2.5 font-semibold" colSpan={1}>
                  Total
                </td>
                <td className="hidden sm:table-cell" />
                <td className="px-3 py-2.5 text-right text-base font-semibold" data-testid="proposal-total">
                  <Money value={s.total} currency={s.currency} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        {s.terms.timelineSummary ? (
          <Section title="Timeline">
            <p className="whitespace-pre-line">{s.terms.timelineSummary}</p>
          </Section>
        ) : null}
        {s.terms.paymentConditions ? (
          <Section title="Payment conditions">
            <p className="whitespace-pre-line">{s.terms.paymentConditions}</p>
          </Section>
        ) : null}
        <Section title={`Revisions (${s.terms.revisionLimit} included)`}>
          <p className="whitespace-pre-line">{s.terms.revisionPolicy}</p>
        </Section>
        <Section title="Change requests">
          <p className="whitespace-pre-line">{s.terms.changeRequestPolicy}</p>
        </Section>
        {s.acceptanceCriteria.length || s.terms.acceptanceStatement ? (
          <Section title="Acceptance">
            {s.terms.acceptanceStatement ? <p className="whitespace-pre-line">{s.terms.acceptanceStatement}</p> : null}
            {s.acceptanceCriteria.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                {s.acceptanceCriteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
          </Section>
        ) : null}
      </div>
      <footer className="border-t pt-4 text-[11px] text-muted-foreground">
        This proposal records the agreed scope and commercial terms between the parties. Approval through FreelanceFlow records who approved which
        version and when; it is not a qualified electronic signature.
      </footer>
    </article>
  );
}
