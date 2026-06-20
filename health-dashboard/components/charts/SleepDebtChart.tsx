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
import { EmptyChartState } from "./EmptyChartState";

const css = (v: string) => {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
};

export function SleepDebtChart() {
  const { sleepDebt } = useChartData();
  const { settings, theme } = useDashboardStore();
  const target = settings.targetSleepHours;

  const colorTextSecondary = css("--text-secondary") || "#9090A8";
  const colorBorderSubtle = css("--border-subtle") || "rgba(124,109,250,0.08)";
  const colorBorderMedium = css("--border-medium") || "rgba(124,109,250,0.25)";
  const colorBgSurface = css("--bg-surface") || "#111118";
  const colorTextPrimary = css("--text-primary") || "#E8E8F0";
  const colorChartSleep = css("--chart-sleep") || "#38BDF8";
  const colorAccentRed = css("--accent-red") || "#F4546A";

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
      className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5 min-w-0"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Sleep Duration & Deficit</h3>
            <MetricInfo metricKey="sleep_debt" />
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Nightly sleep hours vs. target ({target}h)</p>
        </div>
        <div className="flex gap-3 text-xs font-medium">
          <span className="flex items-center gap-1 text-[var(--chart-sleep)]">
            <span className="h-2 w-2 rounded-full bg-[var(--chart-sleep)]" /> Sleep Duration
          </span>
          <span className="flex items-center gap-1 text-[var(--accent-red)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-red)]" /> Sleep Deficit
          </span>
        </div>
      </div>

      <div className="h-64 w-full" role="img" aria-label="Sleep Duration & Deficit chart">
        {sleepDebt && sleepDebt.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colorBorderSubtle} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={colorTextSecondary}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatXAxis}
              />
              <YAxis
                domain={[0, 12]}
                stroke={colorTextSecondary}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: colorBgSurface,
                  borderColor: colorBorderMedium,
                  borderRadius: "6px",
                }}
                labelClassName="text-[var(--text-secondary)] text-xs font-mono"
                itemStyle={{ fontSize: "12px", fontWeight: "bold", color: colorTextPrimary }}
                formatter={(value: any, name: any) => {
                  if (name === "actual_sleep") return [`${value} hrs`, "Time Slept"];
                  if (name === "deficit" && value > 0) return [`${value} hrs`, "Deficit"];
                  if (name === "surplus" && value > 0) return [`${value} hrs`, "Surplus"];
                  return [value, name];
                }}
              />
              <ReferenceLine
                y={target}
                stroke={colorTextSecondary}
                strokeDasharray="4 4"
                label={{
                  value: `Target (${target}h)`,
                  fill: colorTextPrimary,
                  fontSize: 10,
                  position: "right",
                }}
              />
              {/* Stack actual sleep and deficit */}
              <Bar dataKey="actual_sleep" stackId="sleep" fill={colorChartSleep} radius={[2, 2, 0, 0]} />
              <Bar dataKey="deficit" stackId="sleep" fill={colorAccentRed} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState subtitle="Sleep duration data requires tracked sleep sessions. Try syncing a wider date range or check your tracker connection." />
        )}
      </div>
    </div>
  );
}
export default SleepDebtChart;
