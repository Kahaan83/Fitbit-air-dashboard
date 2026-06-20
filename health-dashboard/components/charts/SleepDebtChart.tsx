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
import { cssVar } from "@/lib/cssVar";

export function SleepDebtChart() {
  const { sleepDebt } = useChartData();
  const { settings } = useDashboardStore();
  const target = settings.targetSleepHours;

  const colorTextSecondary = cssVar("--text-secondary") || "#888888";
  const colorBorderSubtle = "rgba(255,255,255,0.04)";
  const colorBorderMedium = "rgba(255,255,255,0.08)";
  const colorBgSurface = "#1C1C1C";
  const colorTextPrimary = "#FFFFFF";
  const colorChartSleep = "#3B7FD4";
  const colorAccentRed = "#FF3B5C";

  const formatXAxis = (tickItem: string) => {
    try {
      const parts = tickItem.split("-");
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } catch {
      return tickItem;
    }
  };

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
      className="rounded-2xl border-[0.5px] border-[rgba(255,255,255,0.08)] bg-[#111111] p-[20px_24px] min-w-0"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-[#888888] uppercase">
          SLEEP DEBT
        </span>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-[10px] font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1 text-[#3B7FD4]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B7FD4]" /> Sleep
            </span>
            <span className="flex items-center gap-1 text-[#FF3B5C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B5C]" /> Deficit
            </span>
          </div>
          <MetricInfo metricKey="sleep_debt" />
        </div>
      </div>

      <div className="h-[320px] w-full" role="img" aria-label="Sleep Duration & Deficit chart">
        {sleepDebt && sleepDebt.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colorBorderSubtle} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={colorTextSecondary}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatXAxis}
              />
              <YAxis
                domain={[0, 12]}
                stroke={colorTextSecondary}
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: colorBgSurface,
                  borderColor: colorBorderMedium,
                  borderRadius: "8px",
                }}
                labelClassName="text-[#888888] text-xs font-mono"
                itemStyle={{ color: colorTextPrimary, fontSize: "12px", fontWeight: "bold" }}
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
                  fontSize: 9,
                  position: "right",
                }}
              />
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
