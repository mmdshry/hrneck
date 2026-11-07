"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "@/components/ui/panel";

export function ReportChart({ summary }: { summary: Record<string, number> }) {
  const data = ["sent", "opened", "clicked", "submitted", "reported"].map(
    (key) => ({ name: key, value: summary[key] ?? 0 }),
  );

  return (
    <Panel className="mt-8 h-72 w-full p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
            }}
          />
          <Bar dataKey="value" fill="var(--accent, #059669)" radius={6} />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}
