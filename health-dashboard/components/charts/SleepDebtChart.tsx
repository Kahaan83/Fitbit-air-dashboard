"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useChartData } from "@/lib/useChartData";
import { useDashboardStore } from "@/lib/store";
import { MetricInfo } from "@/components/MetricInfo";

export function SleepDebtChart() {
  const { sleepDebt } = useChartData();
  const { settings } = useDashboardStore();
  const target = settings.targetSleepHours;

  const formatXAxis = (tickItem: string) => {
    try {
      const parts = tickItem.split("-");
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } catch {
      return tickItem;
    }
  };

  // Prepare chart data:
  // - actual_sleep: amount slept (blue)
  // - deficit: sleep debt hours (red) if actual < target, else 0
  // - surplus: sleep hours exceeding target (green/cyan) if actual > target, else 0
  const chartData = sleepDebt.map((d: any) => {
    const act = d.actual_hours;
    const tgt = d.target_hours || target;
    const isDeficit = act < tgt;
    return {
      date: d.date,
      actual_sleep: act,
      deficit: isDeficit ? Math.round((tgt - act) * 10) / 10 : 0,
      surplus: !isDeficit ? Math.round((act - tgt) * 10) / 10 : 0,
    };
  });

  return (
    <div
      data-testid="sleep-debt-chart"
      className="rounded-xl border border-white/8 bg-slate-900/60 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-white">Sleep Duration & Deficit</h3>
            <MetricInfo metricKey="sleep_debt" />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Nightly sleep hours vs. target ({target}h)</p>
        </div>
        <div className="flex gap-3 text-xs font-medium">
          <span className="flex items-center gap-1 text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> Sleep Duration
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Sleep Deficit
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatXAxis}
            />
            <YAxis
              domain={[0, 12]}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: "6px",
              }}
              labelClassName="text-slate-400 text-xs font-mono"
              itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
              formatter={(value: any, name: any) => {
                if (name === "actual_sleep") return [`${value} hrs`, "Time Slept"];
                if (name === "deficit" && value > 0) return [`${value} hrs`, "Deficit"];
                if (name === "surplus" && value > 0) return [`${value} hrs`, "Surplus"];
                return [value, name];
              }}
            />
            <ReferenceLine
              y={target}
              stroke="rgba(255, 255, 255, 0.4)"
              strokeDasharray="4 4"
              label={{
                value: `Target (${target}h)`,
                fill: "#fff",
                fontSize: 10,
                position: "right",
              }}
            />
            {/* Stack actual sleep (blue) and deficit (red) */}
            <Bar dataKey="actual_sleep" stackId="sleep" fill="#38bdf8" radius={[2, 2, 0, 0]} />
            <Bar dataKey="deficit" stackId="sleep" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export default SleepDebtChart;
