"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { useChartData } from "@/lib/useChartData";
import { useDashboardStore } from "@/lib/store";
import { MetricInfo } from "@/components/MetricInfo";
import { EmptyChartState } from "./EmptyChartState";

const css = (v: string) => {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
};

export function VO2MaxChart() {
  const { vo2Max } = useChartData();
  const theme = useDashboardStore((state) => state.theme);

  const colorTextSecondary = css("--text-secondary") || "#9090A8";
  const colorBorderSubtle = css("--border-subtle") || "rgba(124,109,250,0.08)";
  const colorBorderMedium = css("--border-medium") || "rgba(124,109,250,0.25)";
  const colorBgSurface = css("--bg-surface") || "#111118";
  const colorTextPrimary = css("--text-primary") || "#E8E8F0";
  const colorAccentPrimary = css("--accent-primary") || "#7C6DFA";
  const colorAccentGreen = css("--accent-green") || "#22D3A5";

  const formatXAxis = (tickItem: string) => {
    try {
      const parts = tickItem.split("-");
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } catch {
      return tickItem;
    }
  };

  const hasData = vo2Max && vo2Max.length > 0;
  let minVal = 40;
  let maxVal = 55;

  if (hasData) {
    const values = vo2Max.map((d: any) => d.vo2_max);
    minVal = Math.min(...values, 40);
    maxVal = Math.max(...values, 55);
  }

  return (
    <div
      data-testid="vo2-chart"
      className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5 min-w-0"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">VO2 Max Progression</h3>
            <MetricInfo metricKey="vo2max" />
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Cardiovascular fitness level estimation (ml/kg/min)</p>
        </div>
        <div className="flex gap-3 text-xs font-medium">
          <span className="flex items-center gap-1 text-[var(--accent-green)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-green)]/20 border border-[var(--accent-green)]/50" /> Excellent (&gt;52)
          </span>
          <span className="flex items-center gap-1 text-[var(--accent-primary)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/50" /> Good (42–52)
          </span>
        </div>
      </div>

      <div className="h-64 w-full" role="img" aria-label="VO2 Max Progression chart">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={vo2Max} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
                domain={[Math.floor(minVal - 2), Math.ceil(maxVal + 2)]}
                stroke={colorTextSecondary}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              {/* Good Zone (42 - 52) */}
              <ReferenceArea
                y1={42}
                y2={52}
                fill={colorAccentPrimary}
                fillOpacity={0.04}
                stroke={colorAccentPrimary}
                strokeOpacity={0.1}
                strokeDasharray="3 3"
              />
              {/* Excellent Zone (52+) */}
              <ReferenceArea
                y1={52}
                y2={60}
                fill={colorAccentGreen}
                fillOpacity={0.04}
                stroke={colorAccentGreen}
                strokeOpacity={0.1}
                strokeDasharray="3 3"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: colorBgSurface,
                  borderColor: colorBorderMedium,
                  borderRadius: "6px",
                }}
                labelClassName="text-[var(--text-secondary)] text-xs font-mono"
                itemStyle={{ color: colorTextPrimary, fontSize: "12px", fontWeight: "bold" }}
                formatter={(value: any) => [`${value} ml/kg/min`, "VO2 Max"]}
              />
              <Line
                type="monotone"
                dataKey="vo2_max"
                stroke={colorAccentPrimary}
                strokeWidth={3}
                dot={{ r: 3, fill: colorAccentPrimary }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState subtitle="VO2 Max estimation requires resting heart rate data. Sync a wider date range or check your resting HR settings." />
        )}
      </div>
    </div>
  );
}
export default VO2MaxChart;
