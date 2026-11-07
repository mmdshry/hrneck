"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 2500;

type PanelStat = { label: string; value: string };
type PanelRow = { title: string; meta: string };

type MockPanel = {
  id: string;
  label: string;
  chromeTitle: string;
  stats: PanelStat[];
  highlight: { title: string; progress?: number; caption: string };
  rows: PanelRow[];
};

const PANELS: MockPanel[] = [
  {
    id: "orgs",
    label: "Orgs",
    chromeTitle: "MSP · Client portfolio",
    stats: [
      { label: "Active orgs", value: "24" },
      { label: "Training on", value: "19" },
      { label: "At risk", value: "2" },
    ],
    highlight: {
      title: "Portfolio health · This week",
      caption: "3 orgs need attention · 21 on track",
      progress: 88,
    },
    rows: [
      { title: "Northwind Ltd", meta: "Industry · Manufacturing · Live" },
      { title: "Contoso Health", meta: "Industry · Healthcare · Live" },
    ],
  },
  {
    id: "training",
    label: "Training",
    chromeTitle: "MSP · Acme Corp training posture",
    stats: [
      { label: "Completion", value: "86%" },
      { label: "Assigned", value: "412" },
      { label: "Risk score", value: "Low" },
    ],
    highlight: {
      title: "Active campaign · Security awareness Q4",
      caption: "72% of assigned learners completed",
      progress: 72,
    },
    rows: [
      { title: "Northwind Ltd", meta: "Training on · Live" },
      { title: "Contoso Health", meta: "Training on · Live" },
    ],
  },
  {
    id: "checklists",
    label: "Checklists",
    chromeTitle: "MSP · HR checklist operations",
    stats: [
      { label: "In progress", value: "18" },
      { label: "Due soon", value: "5" },
      { label: "Completed", value: "64" },
    ],
    highlight: {
      title: "Template · Employee onboarding",
      caption: "12 open instances across 4 organizations",
      progress: 61,
    },
    rows: [
      { title: "IT access provisioning", meta: "Due in 2 days · Contoso" },
      { title: "Offboarding · Northwind", meta: "3 of 9 items remaining" },
    ],
  },
  {
    id: "tickets",
    label: "Tickets",
    chromeTitle: "MSP · Service desk queue",
    stats: [
      { label: "Open tickets", value: "12" },
      { label: "SLA on track", value: "94%" },
      { label: "Avg reply", value: "1.4h" },
    ],
    highlight: {
      title: "Queue · Priority incidents",
      caption: "2 urgent · 10 standard · desks responding",
      progress: 94,
    },
    rows: [
      { title: "INC-2841 · VPN access", meta: "SLA 4h · Assigned" },
      { title: "SR-991 · Laptop request", meta: "Service request · New" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    chromeTitle: "MSP · Risk & reporting",
    stats: [
      { label: "Risk trend", value: "↓ 12%" },
      { label: "Schedules", value: "6" },
      { label: "PDF ready", value: "Q4" },
    ],
    highlight: {
      title: "Quarterly archive · Ready to export",
      caption: "Business rollup + filtered learner sections",
      progress: 100,
    },
    rows: [
      { title: "Weekly campaign digest", meta: "Email · Every Monday" },
      { title: "Quarterly PDF · Acme Corp", meta: "Export · DomPDF" },
    ],
  },
];

function TabButtons({
  activeIndex,
  onSelect,
  orientation,
  labelledBy,
  tabIdPrefix,
  panelId,
  progressKey,
}: {
  activeIndex: number;
  onSelect: (index: number) => void;
  orientation: "vertical" | "horizontal";
  labelledBy: string;
  tabIdPrefix: string;
  panelId: string;
  progressKey: number;
}) {
  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      aria-labelledby={labelledBy}
      className={cn(
        orientation === "vertical"
          ? "hidden flex-col gap-2 sm:flex"
          : "flex gap-2 overflow-x-auto pb-1 sm:hidden",
      )}
    >
      {PANELS.map((panel, index) => {
        const selected = index === activeIndex;
        return (
          <button
            key={panel.id}
            type="button"
            role="tab"
            id={`${tabIdPrefix}-tab-${panel.id}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "landing-mock-tab relative shrink-0 overflow-hidden rounded-lg px-2.5 py-2 text-left text-xs transition-[color,background-color,box-shadow,transform] duration-[var(--motion)]",
              selected
                ? "z-[1] scale-[1.03] bg-[var(--accent)] font-semibold text-[var(--accent-foreground)] shadow-[var(--shadow-sm)] ring-1 ring-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
                : "bg-[var(--muted)] text-[var(--muted-foreground)] opacity-80 hover:opacity-100 hover:text-[var(--foreground)]",
            )}
            onClick={() => onSelect(index)}
          >
            <span className="relative z-[1]">{panel.label}</span>
            {selected ? (
              <span
                key={progressKey}
                aria-hidden
                className={cn(
                  "absolute bg-[color-mix(in_srgb,var(--accent-foreground)_75%,transparent)]",
                  orientation === "vertical"
                    ? "landing-tab-progress-y inset-y-0 left-0 w-0.5 origin-top"
                    : "landing-tab-progress inset-x-0 bottom-0 h-0.5 origin-left",
                )}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Interactive multi-tenant workspace mock for the hero. */
export function ProductMock({ className }: { className?: string }) {
  const reactId = useId();
  const idPrefix = `mock-${reactId.replace(/:/g, "")}`;
  const titleId = `${idPrefix}-title`;
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [panelKey, setPanelKey] = useState(0);

  const panel = PANELS[activeIndex] ?? PANELS[0];
  const panelId = `${idPrefix}-panel`;

  useEffect(() => {
    if (paused) {
      return;
    }
    const id = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % PANELS.length);
      setPanelKey((key) => key + 1);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, activeIndex]);

  function selectTab(index: number) {
    setActiveIndex(index);
    setPanelKey((key) => key + 1);
  }

  function pauseRotation() {
    setPaused(true);
  }

  function resumeRotation() {
    setPaused(false);
    // Resync progress bar with a fresh 2.5s window after pause.
    setPanelKey((key) => key + 1);
  }

  return (
    <div
      className={className}
      onMouseEnter={pauseRotation}
      onMouseLeave={resumeRotation}
      onFocusCapture={pauseRotation}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          resumeRotation();
        }
      }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted)]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted)]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted)]" aria-hidden />
          <p
            id={titleId}
            className="ml-3 text-xs font-medium text-[var(--muted-foreground)]"
          >
            {panel.chromeTitle}
          </p>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[7.5rem_1fr]">
          <TabButtons
            activeIndex={activeIndex}
            onSelect={selectTab}
            orientation="horizontal"
            labelledBy={titleId}
            tabIdPrefix={`${idPrefix}-h`}
            panelId={panelId}
            progressKey={panelKey}
          />
          <TabButtons
            activeIndex={activeIndex}
            onSelect={selectTab}
            orientation="vertical"
            labelledBy={titleId}
            tabIdPrefix={`${idPrefix}-v`}
            panelId={panelId}
            progressKey={panelKey}
          />
          <div
            key={panelKey}
            role="tabpanel"
            id={panelId}
            aria-labelledby={`${idPrefix}-v-tab-${panel.id}`}
            className="landing-mock-panel space-y-3"
          >
            <div className="grid grid-cols-3 gap-2">
              {panel.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-[var(--muted)]/70 px-3 py-2.5"
                >
                  <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted-foreground)]">
                    {stat.label}
                  </p>
                  <p className="landing-mock-stat mt-1 font-[family-name:var(--font-display)] text-lg tabular-nums tracking-tight text-[var(--foreground)]">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
              <p className="text-xs font-medium text-[var(--foreground)]">
                {panel.highlight.title}
              </p>
              {typeof panel.highlight.progress === "number" ? (
                <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out"
                    style={{ width: `${panel.highlight.progress}%` }}
                  />
                </div>
              ) : null}
              <p className="text-[0.7rem] text-[var(--muted-foreground)]">
                {panel.highlight.caption}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {panel.rows.map((row) => (
                <div
                  key={row.title}
                  className="rounded-xl border border-[var(--border)] px-3 py-2.5"
                >
                  <p className="truncate text-xs font-medium text-[var(--foreground)]">
                    {row.title}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-[var(--muted-foreground)]">
                    {row.meta}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
