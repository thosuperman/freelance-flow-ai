"use client";

import { useMemo, useRef, useState } from "react";
import { AgStudioAiModule, createAiHarness, type AgAiHarnessSetup, type AgAiPromptStarter, type AgReportState, type AgStudioApi, type AgStudioMode } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import type { FinancialDataset } from "@/features/insights/data";
import { cn } from "@/lib/utils";
import { claudeAdapter } from "./claude-adapter";
import { PAGE_TITLES, buildStudioData, freelanceFlowStudioTheme, initialReport } from "./studio-config";

const STORAGE_KEY = "ff-insights-report-v1";

const PROMPT_STARTERS: AgAiPromptStarter[] = [
  { label: "Overdue payments", prompt: "Which projects have overdue payment requests, and how much is overdue in each currency?" },
  { label: "Scope-change revenue", prompt: "How much additional revenue came from approved scope changes, per currency?" },
  { label: "Awaiting payment", prompt: "Which milestones are awaiting payment? Add a grid of them to this page." },
  { label: "Biggest balances", prompt: "Which projects have the greatest outstanding balance? Show it as a chart." },
];

function loadSaved(): AgReportState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AgReportState) : null;
  } catch {
    return null;
  }
}

export default function FinancialStudio({ data, aiEnabled, licenseKey }: { data: FinancialDataset; aiEnabled: boolean; licenseKey?: string }) {
  const apiRef = useRef<AgStudioApi | null>(null);
  const [mode, setMode] = useState<AgStudioMode>("view");
  const [initialState] = useState<AgReportState>(() => loadSaved() ?? initialReport);
  const [page, setPage] = useState(initialState.selectedPageId ?? "revenue");
  const [saved, setSaved] = useState<string | null>(null);
  const studioData = useMemo(() => buildStudioData(data), [data]);
  // Read once when Studio is created: Studio's built-in agents, run on Claude through our server.
  const ai = useMemo<AgAiHarnessSetup | undefined>(
    () => (aiEnabled ? ({ api }) => createAiHarness(api as AgStudioApi, { adapter: claudeAdapter(), promptStarters: PROMPT_STARTERS }) : undefined),
    [aiEnabled],
  );

  const select = (id: string) => {
    const api = apiRef.current;
    if (api) api.setState({ ...api.getState(), selectedPageId: id });
    setPage(id);
  };
  const save = () => {
    const api = apiRef.current;
    if (!api) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(api.getState()));
      setSaved("Layout saved in this browser");
    } catch {
      setSaved("Could not save in this browser");
    }
  };
  const reset = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    apiRef.current?.setState(initialReport);
    apiRef.current?.clearHistory();
    setPage(initialReport.selectedPageId ?? "revenue");
    setSaved("Default layout restored");
  };

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[640px] flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <nav aria-label="Report pages" className="flex flex-wrap gap-1">
          {initialReport.pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => select(p.id)}
              aria-current={page === p.id ? "page" : undefined}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium", page === p.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
            >
              {PAGE_TITLES[p.id] ?? p.id}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {saved ? <span className="text-xs text-muted-foreground" role="status">{saved}</span> : null}
          <button type="button" className="rounded-md border px-3 py-1.5 hover:bg-muted" onClick={() => setMode(mode === "view" ? "edit" : "view")}>
            {mode === "view" ? "Customize" : "Done editing"}
          </button>
          <button type="button" className="rounded-md border px-3 py-1.5 hover:bg-muted" onClick={save}>
            Save layout
          </button>
          <button type="button" className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted" onClick={reset}>
            Reset
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1" data-testid="financial-studio">
        <AgStudioProvider licenseKey={licenseKey} modules={ai ? [AgStudioAiModule] : undefined}>
          <AgStudio
            style={{ height: "100%", width: "100%" }}
            theme={freelanceFlowStudioTheme}
            layout={{ widgetBorderEnabled: true }}
            data={studioData}
            ai={ai}
            initialState={initialState}
            mode={mode}
            onApiReady={(e) => {
              apiRef.current = e.api;
            }}
            onStateUpdated={(e) => {
              if (e.state.selectedPageId && e.state.selectedPageId !== page) setPage(e.state.selectedPageId);
            }}
          />
        </AgStudioProvider>
      </div>
    </div>
  );
}
