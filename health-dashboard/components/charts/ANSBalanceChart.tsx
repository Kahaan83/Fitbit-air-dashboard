"use client";

import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Cell,
} from "recharts";
import { useChartData } from "@/lib/useChartData";
import { useDashboardStore } from "@/lib/store";
import { MetricInfo } from "@/components/MetricInfo";
import { EmptyChartState } from "./EmptyChartState";

const css = (v: string) => {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
};

export function ANSBalanceChart() {
  const { ansBalance } = useChartData();
  const theme = useDashboardStore((state) => state.theme);

  const colorTextSecondary = css("--text-secondary") || "#9090A8";
  const colorBorderSubtle = css("--border-subtle") || "rgba(124,109,250,0.08)";
  const colorBorderMedium = css("--border-medium") || "rgba(124,109,250,0.25)";
  const colorBgSurface = css("--bg-surface") || "#111118";
  const colorTextPrimary = css("--text-primary") || "#E8E8F0";
  const colorAccentPrimary = css("--accent-primary") || "#7C6DFA";
  const colorAccentRed = css("--accent-red") || "#F4546A";

  const formatXAxis = (tickItem: string) => {
    try {
      const parts = tickItem.split("-");
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } catch {
      return tickItem;
    }
  };

  // Prepare data for ScatterChart (convert date string index to numeric x value if needed,
  // or use category axis. In ScatterChart, using date as string category is supported
  // if we set type="category" on XAxis).
  const data = ansBalance.map((d: any) => ({
    ...d,
    // Add custom color indicator
    isNormal: d.lf_hf_ratio >= 1.0 && d.lf_hf_ratio <= 2.0,
  }));

  return (
    <div
      data-testid="ans-chart"
      className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5 min-w-0"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">ANS Autonomic Balance</h3>
            <MetricInfo metricKey="lf_hf_ratio" />
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Low-Frequency (Sympathetic) / High-Frequency (Parasympathetic) Power Ratio</p>
        </div>
        <div className="flex gap-3 text-xs font-medium">
          <span className="flex items-center gap-1 text-[var(--accent-primary)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" /> Normal Balance (1.0–2.0)
          </span>
          <span className="flex items-center gap-1 text-[var(--accent-red)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-red)]" /> Out of Range (Stress/Fatigue)
          </span>
        </div>
      </div>

      <div className="h-64 w-full" role="img" aria-label="ANS Autonomic Balance chart">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colorBorderSubtle} vertical={false} />
              <XAxis
                type="category"
                dataKey="date"
                name="Date"
                stroke={colorTextSecondary}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatXAxis}
              />
              <YAxis
                type="number"
                dataKey="lf_hf_ratio"
                name="LF/HF Ratio"
                domain={[0.4, 3.0]}
                stroke={colorTextSecondary}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              {/* Highlight normal range (1.0 - 2.0) with subtle overlay */}
              <ReferenceArea
                y1={1.0}
                y2={2.0}
                fill={colorAccentPrimary}
                fillOpacity={0.05}
                stroke={colorAccentPrimary}
                strokeOpacity={0.15}
                strokeDasharray="3 3"
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: colorBorderMedium }}
                contentStyle={{
                  backgroundColor: colorBgSurface,
                  borderColor: colorBorderMedium,
                  borderRadius: "6px",
                }}
                labelClassName="text-[var(--text-secondary)] text-xs font-mono"
                itemStyle={{ fontSize: "12px", color: colorTextPrimary }}
                formatter={(value: any, name: any) => {
                  if (name === "LF/HF Ratio") return [`${value}`, "LF/HF Balance"];
                  return [value, name];
                }}
              />
              <Scatter name="ANS Balance" data={data}>
                {data.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isNormal ? colorAccentPrimary : colorAccentRed}
                    stroke={entry.isNormal ? colorAccentPrimary : colorAccentRed}
                    strokeOpacity={0.5}
                    strokeWidth={2}
                    r={entry.isNormal ? 5 : 6}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState subtitle="ANS balance calculation requires continuous intraday heart rate variability samples." />
        )}
      </div>
    </div>
  );
}
export default ANSBalanceChart;
