"use client";

import "@bryntum/gantt/fontawesome/css/fontawesome.css";
import "@bryntum/gantt/fontawesome/css/solid.css";
import "@bryntum/gantt/gantt.css";
import "@bryntum/gantt/stockholm-light.css";

import { useCallback, useMemo, useRef, useState } from "react";
import { BryntumGantt } from "@bryntum/gantt-react";
import { StringHelper, type GridColumnConfig, type TaskModel } from "@bryntum/gantt";
import type { Timeline, TimelineTask } from "@/features/timeline/build";
import { TimelineDetails } from "./timeline-details";

type Row = {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  duration?: number;
  manuallyScheduled: true;
  percentDone: number;
  eventColor: string;
  expanded?: boolean;
  baselines?: { startDate: string; endDate: string }[];
  children?: Row[];
};

const SUB_GRIDS = { locked: { width: 300 } };

function colorFor(t: TimelineTask): string {
  if (t.flags.late || t.flags.overduePayment) return "red";
  if (t.flags.affected) return "orange";
  if (t.kind === "payment") return t.paymentStatus === "PAID" ? "green" : "gray";
  if (t.percentDone === 100) return "green";
  if (t.origin === "CHANGE_REQUEST") return "violet";
  return "blue";
}

function toRows(timeline: Timeline): Row[] {
  const row = (t: TimelineTask): Row => ({
    id: t.id,
    name: t.name,
    startDate: t.startDate,
    ...(t.kind === "payment" ? { duration: 0 } : { endDate: t.endDate }),
    manuallyScheduled: true,
    percentDone: t.percentDone,
    eventColor: colorFor(t),
    ...(t.baseline ? { baselines: [t.baseline] } : {}),
  });
  return timeline.tasks
    .filter((t) => t.kind === "group")
    .map((g) => ({ ...row(g), expanded: true, children: timeline.tasks.filter((t) => t.parentId === g.id).map(row) }));
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  CHANGES_REQUESTED: "Changes requested",
  ACCEPTED: "Accepted",
  UNPAID: "Unpaid",
  REQUESTED: "Payment requested",
  PROCESSING: "Processing",
  PAID: "Paid",
};

export default function TimelineGantt({ timeline }: { timeline: Timeline }) {
  const ref = useRef<BryntumGantt>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(timeline.tasks.map((t) => [t.id, t])), [timeline]);
  const project = useMemo(
    () => ({
      tasks: toRows(timeline),
      dependencies: timeline.dependencies.map((d) => ({ id: d.id, fromTask: d.from, toTask: d.to })),
    }),
    [timeline],
  );
  const columns = useMemo<GridColumnConfig[]>(
    () => [
      { type: "name", text: "Phase / payment", width: 200 } as GridColumnConfig,
      {
        text: "Status",
        width: 120,
        field: "id",
        htmlEncode: false,
        renderer: ({ record }: { record: unknown }) => {
          const t = byId.get(String((record as TaskModel).id));
          if (!t || t.kind === "group") return "";
          const status = t.kind === "payment" ? t.paymentStatus : t.workStatus;
          const flag = t.flags.late ? " · late" : t.flags.overduePayment ? " · overdue" : t.flags.affected ? " · at risk" : "";
          return StringHelper.encodeHtml(`${STATUS_LABEL[status ?? ""] ?? status ?? ""}${flag}`);
        },
      },
      {
        text: "Amount",
        width: 100,
        align: "end" as const,
        field: "id",
        renderer: ({ record }: { record: unknown }) => {
          const t = byId.get(String((record as TaskModel).id));
          return t?.amount && t.kind !== "group" ? `${t.amount} ${t.currency}` : "";
        },
      },
    ],
    [byId],
  );

  const tooltip = useMemo(
    () => ({
      template: ({ taskRecord }: { taskRecord: TaskModel }) => {
        const t = byId.get(String(taskRecord.id));
        if (!t) return "";
        const lines = [
          `<b>${StringHelper.encodeHtml(t.name)}</b>`,
          t.kind === "payment" ? `Payment date: ${t.startDate}` : `${t.startDate} → ${t.endDate}`,
          t.amount ? `${t.amount} ${t.currency}` : "",
          t.baseline ? `Agreed end: ${t.baseline.endDate}${t.slipDays ? ` (${t.slipDays} days later now)` : ""}` : "",
          t.origin === "CHANGE_REQUEST" ? "Added by an approved change request" : "",
        ];
        return lines.filter(Boolean).join("<br>");
      },
    }),
    [byId],
  );
  const onTaskClick = useCallback(({ taskRecord }: { taskRecord: TaskModel }) => setSelectedId(String(taskRecord.id)), []);

  const zoom = (action: "in" | "out" | "fit") => {
    const g = ref.current?.instance;
    if (!g) return;
    if (action === "in") g.zoomIn();
    else if (action === "out") g.zoomOut();
    else g.zoomToFit({ leftMargin: 40, rightMargin: 40 });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm">
          <span className="font-medium">Zoom</span>
          <button type="button" className="rounded-md border px-2 py-1 hover:bg-muted" onClick={() => zoom("out")} aria-label="Zoom out">−</button>
          <button type="button" className="rounded-md border px-2 py-1 hover:bg-muted" onClick={() => zoom("in")} aria-label="Zoom in">+</button>
          <button type="button" className="rounded-md border px-2 py-1 hover:bg-muted" onClick={() => zoom("fit")}>Fit project</button>
          <span className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legend color="bg-[#3b82f6]" label="Planned" />
            <Legend color="bg-[#8b5cf6]" label="Approved change" />
            <Legend color="bg-[#22c55e]" label="Done / paid" />
            <Legend color="bg-[#f97316]" label="At risk" />
            <Legend color="bg-[#ef4444]" label="Late / overdue" />
            <Legend color="border border-dashed border-slate-400" label="Agreed baseline" />
          </span>
        </div>
        <div className="h-[460px]" data-testid="smart-timeline">
          <BryntumGantt
            ref={ref}
            project={project}
            columns={columns}
            readOnly
            subGridConfigs={SUB_GRIDS}
            rowHeight={44}
            barMargin={10}
            viewPreset="weekAndDayLetter"
            startDate={timeline.startDate}
            endDate={timeline.endDate}
            baselinesFeature
            dependenciesFeature
            percentBarFeature
            taskEditFeature={false}
            taskMenuFeature={false}
            cellEditFeature={false}
            taskDragFeature={false}
            taskResizeFeature={false}
            taskDragCreateFeature={false}
            dependencyEditFeature={false}
            taskTooltipFeature={tooltip}
            onTaskClick={onTaskClick}
          />
        </div>
      </div>
      <TimelineDetails task={selectedId ? (byId.get(selectedId) ?? null) : null} timeline={timeline} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block size-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
