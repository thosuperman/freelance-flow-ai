import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { StatusBadge, SimulatedBadge } from "@/components/shared/status-badge";
import { reconciliation } from "@/components/projects/terms-form";
import type { ProposalSnapshot } from "@/features/proposals/service";

const snapshot: ProposalSnapshot = {
  schema: 1,
  projectId: "p1",
  version: 2,
  title: "Business Landing Page",
  description: "Landing page",
  currency: "USD",
  startDate: "2026-11-09",
  client: { name: "Jordan Lee", email: "jordan@example.com", company: null },
  freelancer: { name: "Alex Rivera", businessName: "Rivera Studio" },
  deliverables: [{ id: "d1", title: "Landing page design", description: "Responsive" }],
  exclusions: [{ id: "e1", title: "Booking systems" }],
  acceptanceCriteria: ["Works on mobile"],
  milestones: [
    { id: "m1", position: 1, kind: "DEPOSIT", title: "Upfront deposit", description: "", amount: "450.00", dueDate: null },
    { id: "m2", position: 2, kind: "DELIVERY", title: "Final delivery", description: "", amount: "1050.00", dueDate: "2026-11-21" },
  ],
  total: "1500.00",
  terms: {
    overview: "Hello Jordan",
    timelineSummary: "Two weeks",
    paymentConditions: "Deposit first",
    revisionLimit: 2,
    revisionPolicy: "Two rounds",
    changeRequestPolicy: "Written change requests",
    acceptanceStatement: "Accept in portal",
  },
};

describe("ProposalDocument", () => {
  it("renders the immutable snapshot with exact prices and no e-signature claim", () => {
    render(<ProposalDocument s={snapshot} />);
    expect(screen.getByText("Proposal · version 2")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-total")).toHaveTextContent("$1,500.00");
    const table = screen.getByRole("table");
    expect(within(table).getByText("$450.00")).toBeInTheDocument();
    expect(within(table).getByText("$1,050.00")).toBeInTheDocument();
    expect(screen.getByText("Booking systems")).toBeInTheDocument();
    expect(screen.getByText(/not a qualified electronic signature/)).toBeInTheDocument();
  });
});

describe("status badges", () => {
  it("maps domain statuses to human labels", () => {
    render(
      <>
        <StatusBadge status="PENDING_CLIENT" />
        <StatusBadge status="PAID" />
        <SimulatedBadge label="Simulated PayPal" />
      </>,
    );
    expect(screen.getByText("Awaiting client")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Simulated PayPal")).toBeInTheDocument();
  });
});

describe("terms form reconciliation", () => {
  it("balances only when milestones equal the project value exactly", () => {
    const m = (amount: string) => ({ title: "x", description: "", kind: "DELIVERY" as const, amount, dueDate: "", inferred: false });
    expect(reconciliation({ budget: "1500", currency: "USD", milestones: [m("450.00"), m("1050.00")] }).balanced).toBe(true);
    expect(reconciliation({ budget: "1500", currency: "USD", milestones: [m("450"), m("1000")] }).balanced).toBe(false);
    expect(reconciliation({ budget: "1500", currency: "USD", milestones: [m("abc")] }).invalid).toBe(true);
  });
});
