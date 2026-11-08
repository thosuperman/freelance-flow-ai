import { studioTheme } from "ag-studio";
import type { AgDataSourcesDefinition, AgFieldDefinition, AgFormat, AgPageState, AgRelationDefinition, AgReportState, AgWidgetLayoutState } from "ag-studio";
import type { FinancialDataset } from "@/features/insights/data";

/**
 * AG Studio configuration for Financial Intelligence: data sources (one table per record type,
 * related to each other and to a calendar), the starting report, and a theme built from the app's
 * own design tokens so Studio looks like part of FreelanceFlow.
 *
 * Money fields use a plain decimal format plus an explicit Currency field instead of a currency
 * symbol format, because records can be in different currencies. Widgets that total money are
 * split by currency (grid rows or chart legend), and every page has a currency filter.
 */

const CALENDAR = "calendar";
type Spec = [id: string, name: string, format: AgFormat, hide?: boolean];
const fields = (specs: Spec[]): AgFieldDefinition[] => specs.map(([id, name, format, hide]) => ({ id, name, format, ...(hide ? { hide } : {}) }));
const manyToOne = (id: string, source: string, target: string): AgRelationDefinition => {
  const [st, sf] = source.split(".");
  const [tt, tf] = target.split(".");
  return { id, source: { tableId: st!, fieldId: sf! }, target: { tableId: tt!, fieldId: tf! }, type: "many-to-one" };
};
const onCalendar = (tableId: string, fieldId: string): AgRelationDefinition => ({ id: `${tableId}-${fieldId}-cal`, source: { tableId, fieldId }, target: { calendarId: CALENDAR } });
const sum = (id: string) => ({ id, aggregation: "sum" as const });
const countd = (id: string) => ({ id, aggregation: "countd" as const });

export function buildStudioData(d: FinancialDataset): AgDataSourcesDefinition {
  const dates = [...d.paymentRequests.map((r) => r.dueDate), ...d.transactions.map((t) => t.capturedAt), ...d.projects.map((p) => p.createdAt)]
    .filter((x): x is string => Boolean(x))
    .sort();
  const today = d.asOf.slice(0, 10);
  return {
    description:
      "A freelancer's own FreelanceFlow records: projects with approved agreements, milestones, PayPal payment requests, " +
      "verified PayPal Sandbox captures and scope change requests. Amounts are in each record's own currency and are never " +
      "converted: always group or filter by currency before summing money. There is no cost data, so profit cannot be computed.",
    sources: [
      {
        id: "clients",
        description: "The freelancer's clients.",
        data: d.clients,
        fields: fields([
          ["id", "Client ID", "textFormat", true],
          ["name", "Client", "textFormat"],
          ["company", "Company", "textFormat"],
        ]),
      },
      {
        id: "projects",
        description: "One row per project. Original value is the approved proposal; revised value adds approved change requests. Paid counts verified PayPal captures only.",
        data: d.projects,
        fields: fields([
          ["id", "Project ID", "textFormat", true],
          ["clientId", "Client ID", "textFormat", true],
          ["title", "Project", "textFormat"],
          ["currency", "Currency", "textFormat"],
          ["status", "Project Status", "textFormat"],
          ["createdAt", "Created", "dateFormat"],
          ["originalValue", "Original Value", "decimalFormat"],
          ["approvedChanges", "Approved Changes", "decimalFormat"],
          ["revisedValue", "Revised Value", "decimalFormat"],
          ["paid", "Paid (verified)", "decimalFormat"],
          ["outstanding", "Outstanding", "decimalFormat"],
          ["overdue", "Overdue", "decimalFormat"],
          ["paidShare", "Paid Share", "percentageFormat"],
        ]),
      },
      {
        id: "milestones",
        description: "Agreed milestones, including change-order milestones created by approved change requests.",
        data: d.milestones,
        fields: fields([
          ["id", "Milestone ID", "textFormat", true],
          ["projectId", "Project ID", "textFormat", true],
          ["title", "Milestone", "textFormat"],
          ["kind", "Milestone Type", "textFormat"],
          ["currency", "Milestone Currency", "textFormat"],
          ["amount", "Milestone Amount", "decimalFormat"],
          ["dueDate", "Milestone Due", "dateFormat"],
          ["terms", "Terms", "textFormat"],
          ["workStatus", "Work Status", "textFormat"],
          ["paymentStatus", "Payment Status", "textFormat"],
        ]),
      },
      {
        id: "paymentRequests",
        name: "Payment Requests",
        description: "PayPal payment requests sent to clients. Overdue means open and past the due date.",
        data: d.paymentRequests,
        fields: fields([
          ["id", "Request ID", "textFormat", true],
          ["projectId", "Project ID", "textFormat", true],
          ["milestoneId", "Milestone ID", "textFormat", true],
          ["description", "Request", "textFormat"],
          ["currency", "Request Currency", "textFormat"],
          ["amount", "Requested", "decimalFormat"],
          ["status", "Request Status", "textFormat"],
          ["dueDate", "Request Due", "dateFormat"],
          ["paidAt", "Paid On", "dateFormat"],
          ["isOverdue", "Is Overdue", "booleanFormat"],
          ["daysOverdue", "Days Overdue", "integerFormat"],
          ["daysToPay", "Days to Pay", "integerFormat"],
        ]),
      },
      {
        id: "transactions",
        name: "PayPal Captures",
        description: "Verified PayPal captures (Sandbox in this demo). Only COMPLETED captures count as paid.",
        data: d.transactions,
        fields: fields([
          ["id", "Transaction ID", "textFormat", true],
          ["projectId", "Project ID", "textFormat", true],
          ["paymentRequestId", "Request ID", "textFormat", true],
          ["captureId", "PayPal Capture ID", "textFormat"],
          ["environment", "PayPal Environment", "textFormat"],
          ["currency", "Capture Currency", "textFormat"],
          ["amount", "Captured", "decimalFormat"],
          ["status", "Capture Status", "textFormat"],
          ["capturedAt", "Captured On", "dateFormat"],
          ["verifiedVia", "Verified Via", "textFormat"],
        ]),
      },
      {
        id: "changeRequests",
        name: "Change Requests",
        description: "Scope change requests. Approved amount is non-zero only once the client approved.",
        data: d.changeRequests,
        fields: fields([
          ["id", "Change ID", "textFormat", true],
          ["projectId", "Project ID", "textFormat", true],
          ["number", "CR #", "integerFormat"],
          ["title", "Change", "textFormat"],
          ["status", "Change Status", "textFormat"],
          ["currency", "Change Currency", "textFormat"],
          ["amount", "Change Amount", "decimalFormat"],
          ["approvedAmount", "Approved Amount", "decimalFormat"],
          ["createdAt", "Requested On", "dateFormat"],
          ["decidedAt", "Decided On", "dateFormat"],
        ]),
      },
    ],
    relationships: [
      manyToOne("project-client", "projects.clientId", "clients.id"),
      manyToOne("milestone-project", "milestones.projectId", "projects.id"),
      manyToOne("request-project", "paymentRequests.projectId", "projects.id"),
      manyToOne("capture-request", "transactions.paymentRequestId", "paymentRequests.id"),
      manyToOne("change-project", "changeRequests.projectId", "projects.id"),
      onCalendar("transactions", "capturedAt"),
      onCalendar("paymentRequests", "dueDate"),
    ],
    calendars: [
      {
        id: CALENDAR,
        label: "Calendar",
        range: { from: { type: "date", value: dates[0] ?? today }, to: { type: "date", value: dates.at(-1) ?? today } },
        fragments: ["year", "quarter", "month", "week", "day"],
      },
    ],
    expressions: [
      {
        id: "collectionRate",
        name: "Collection Rate",
        description: "Verified payments / revised contract value. Filter to one currency first.",
        format: "percentageFormat",
        isMeasure: true,
        expression: { operator: "divide", inputs: [sum("projects.paid"), sum("projects.revisedValue")] },
      },
    ],
  };
}

const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({ xTrack, yTrack, xSpan, ySpan });
const title = (text: string) => ({ title: { enabled: true, text } });
const legend = { style: { theme: { common: { legend: { enabled: true } } } } };
const currencyFilter = (field: string) => ({
  type: "button-filter" as const,
  dataMapping: { value: [{ id: field }] },
  format: { ...title("Currency"), style: { selection: { type: "single" as const }, dimensions: { height: 28, minWidth: 48 } } },
});

const revenue: AgPageState = {
  id: "revenue",
  widgets: {
    currency: currencyFilter("projects.currency"),
    totals: {
      type: "grid",
      dataMapping: {
        cols: [{ id: "projects.currency" }, sum("projects.originalValue"), sum("projects.approvedChanges"), sum("projects.revisedValue"), sum("projects.paid"), sum("projects.outstanding"), sum("projects.overdue")],
      },
      format: title("Totals by currency (never mixed)"),
    },
    "collection-rate": {
      type: "radial-gauge",
      dataMapping: { value: [{ id: "collectionRate" }] },
      format: { ...title("Collected vs contracted"), style: { scaleLabel: { min: 0, max: 1 } } },
    },
    "by-project": {
      type: "column-chart-stacked",
      dataMapping: { categoryKey: [{ id: "projects.title" }], valueKey: [sum("projects.paid"), sum("projects.outstanding")] },
      format: { ...title("Paid and outstanding by project (each in its own currency)"), ...legend },
    },
    "captures-by-month": {
      type: "column-chart-stacked",
      dataMapping: { categoryKey: [{ id: "calendar::month" }], valueKey: [sum("transactions.amount")], legendKey: [{ id: "transactions.currency" }] },
      format: { ...title("Verified PayPal payments by month, per currency"), ...legend },
    },
    projects: {
      type: "grid",
      dataMapping: {
        cols: [{ id: "projects.title" }, { id: "clients.name" }, { id: "projects.currency" }, sum("projects.originalValue"), sum("projects.approvedChanges"), sum("projects.revisedValue"), sum("projects.paid"), sum("projects.outstanding")],
      },
      sort: [{ field: sum("projects.outstanding"), direction: "desc" }],
      format: title("Projects"),
    },
  },
  widgetLayout: {
    currency: at(0, 0, 6, 6),
    totals: at(6, 0, 18, 12),
    "collection-rate": at(0, 6, 6, 14),
    "by-project": at(6, 12, 18, 18),
    "captures-by-month": at(0, 30, 12, 18),
    projects: at(12, 30, 12, 18),
  },
};

const risk: AgPageState = {
  id: "risk",
  widgets: {
    currency: currencyFilter("paymentRequests.currency"),
    "by-status": {
      type: "donut-chart",
      dataMapping: { categoryKey: [{ id: "paymentRequests.status" }], valueKey: [countd("paymentRequests.id")] },
      format: title("Payment requests by status"),
    },
    "overdue-by-client": {
      type: "column-chart-stacked",
      dataMapping: { categoryKey: [{ id: "clients.name" }], valueKey: [sum("paymentRequests.amount")], legendKey: [{ id: "paymentRequests.isOverdue" }] },
      format: { ...title("Requested amounts by client, overdue vs on time"), ...legend },
    },
    requests: {
      type: "grid",
      dataMapping: {
        cols: [{ id: "projects.title" }, { id: "paymentRequests.description" }, { id: "paymentRequests.currency" }, sum("paymentRequests.amount"), { id: "paymentRequests.status" }, { id: "paymentRequests.dueDate" }, sum("paymentRequests.daysOverdue"), { id: "paymentRequests.paidAt" }],
      },
      sort: [{ field: sum("paymentRequests.daysOverdue"), direction: "desc" }],
      format: title("Payment requests (most overdue first)"),
    },
  },
  widgetLayout: {
    currency: at(0, 0, 6, 6),
    "by-status": at(0, 6, 8, 16),
    "overdue-by-client": at(8, 0, 16, 22),
    requests: at(0, 22, 24, 20),
  },
};

const scope: AgPageState = {
  id: "scope",
  widgets: {
    currency: currencyFilter("changeRequests.currency"),
    "change-status": {
      type: "donut-chart",
      dataMapping: { categoryKey: [{ id: "changeRequests.status" }], valueKey: [countd("changeRequests.id")] },
      format: title("Change requests by status"),
    },
    "change-value": {
      type: "column-chart-stacked",
      dataMapping: { categoryKey: [{ id: "projects.title" }], valueKey: [sum("changeRequests.approvedAmount")], legendKey: [{ id: "changeRequests.currency" }] },
      format: { ...title("Approved scope-change revenue by project"), ...legend },
    },
    changes: {
      type: "grid",
      dataMapping: {
        cols: [{ id: "projects.title" }, sum("changeRequests.number"), { id: "changeRequests.title" }, { id: "changeRequests.status" }, { id: "changeRequests.currency" }, sum("changeRequests.amount"), { id: "changeRequests.decidedAt" }],
      },
      format: title("All change requests"),
    },
  },
  widgetLayout: {
    currency: at(0, 0, 6, 6),
    "change-status": at(0, 6, 8, 16),
    "change-value": at(8, 0, 16, 22),
    changes: at(0, 22, 24, 18),
  },
};

export const initialReport: AgReportState = { selectedPageId: revenue.id, pages: [revenue, risk, scope], panels: { filters: { collapsed: true } } };
export const PAGE_TITLES: Record<string, string> = { revenue: "Revenue overview", risk: "Payment risk", scope: "Scope change impact" };

const v = (name: string) => `var(--${name})`;
export const freelanceFlowStudioTheme = studioTheme.withParams({
  fontFamily: v("font-sans"),
  fontSize: 14,
  textColor: v("foreground"),
  foregroundColor: v("foreground"),
  subtleTextColor: v("muted-foreground"),
  backgroundColor: v("card"),
  borderColor: v("border"),
  accentColor: v("primary"),
  rowHoverColor: v("muted"),
  studioWrapperBorder: false,
  studioWrapperBorderRadius: 0,
  studioWrapperSpacing: 0,
  studioWrapperBackgroundColor: v("background"),
  studioCanvasBorder: false,
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: false,
  studioCanvasBackgroundColor: v("background"),
  studioCanvasPadding: 8,
  studioCanvasRowHeight: 18,
  studioWidgetBackgroundColor: v("card"),
  studioWidgetBorder: { width: 1, color: v("border") },
  studioWidgetBorderRadius: 12,
  studioWidgetPadding: 10,
  studioWidgetTitleFontSize: 14,
  studioWidgetTitleFontWeight: 600,
  studioWidgetTitleTextColor: v("foreground"),
});
