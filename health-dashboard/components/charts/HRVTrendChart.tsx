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

export function HRVTrendChart() {
  const { hrv } = useChartData();
  const theme = useDashboardStore((state) => state.theme);

  const colorTextSecondary = css("--text-secondary") || "#9090A8";
  const colorBorderSubtle = css("--border-subtle") || "rgba(124,109,250,0.08)";
  const colorBorderMedium = css("--border-medium") || "rgba(124,109,250,0.25)";
  const colorBgSurface = css("--bg-surface") || "#111118";
  const colorTextPrimary = css("--text-primary") || "#E8E8F0";
  const colorAccentGreen = css("--accent-green") || "#22D3A5";
  const colorAccentAmber = css("--accent-amber") || "#F59E0B";

  const hasData = hrv && hrv.length > 0;

  // Calculate dynamic stops for green/orange split at 50ms
  // Find min/max values to normalize the gradient offset
  let minVal = 20;
  let maxVal = 80;
  
  // Calculate percentage offset where Y = 50 is relative to min/max
  const threshold = 50;
  let offset = 0.5;
  let stop1Color = colorAccentGreen;
  let stop2Color = colorAccentGreen;
  let stop3Color = colorAccentAmber;
  let stop4Color = colorAccentAmber;

  if (hasData) {
    const values = hrv.map((d: any) => d.value);
    minVal = Math.min(...values, 20);
    maxVal = Math.max(...values, 80);
    if (maxVal !== minVal) {
      // Recharts gradients flow top-down (0 = top, 1 = bottom)
      // So Y=50 is: (max - 50) / (max - min)
      offset = (maxVal - threshold) / (maxVal - minVal);
    }
    offset = Math.max(0, Math.min(1, offset));

    const hasAbove = hrv.some((d: any) => d.value >= threshold);
    const hasBelow = hrv.some((d: any) => d.value < threshold);

    if (!hasBelow || offset < 0.05) {
      offset = 0;
      stop1Color = colorAccentGreen;
      stop2Color = colorAccentGreen;
      stop3Color = colorAccentGreen;
      stop4Color = colorAccentGreen;
    } else if (!hasAbove || offset > 0.95) {
      offset = 1;
      stop1Color = colorAccentAmber;
      stop2Color = colorAccentAmber;
      stop3Color = colorAccentAmber;
      stop4Color = colorAccentAmber;
    }
  }

  const formatXAxis = (tickItem: string) => {
    try {
      const parts = tickItem.split("-");
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } catch {
      return tickItem;
    }
  };

  return (
    <div
      data-testid="hrv-chart"
      className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">HRV Recovery Trend</h3>
            <MetricInfo metricKey="hrv" />
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Daily RMSSD (ms) — 30 Day History</p>
        </div>
        <div className="flex gap-3 text-xs font-medium">
          <span className="flex items-center gap-1 text-[var(--accent-green)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-green)]" /> Optimal (&gt;50ms)
          </span>
          <span className="flex items-center gap-1 text-[var(--accent-amber)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-amber)]" /> Fatigued (&lt;50ms)
          </span>
        </div>
      </div>

      <div className="h-64 w-full" role="img" aria-label="HRV Recovery Trend chart">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hrv} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="hrvSplit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor={stop1Color} stopOpacity={1} />
                  <stop offset={offset} stopColor={stop2Color} stopOpacity={1} />
                  <stop offset={offset} stopColor={stop3Color} stopOpacity={1} />
                  <stop offset={1} stopColor={stop4Color} stopOpacity={1} />
                </linearGradient>
              </defs>
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
                domain={[minVal - 5, maxVal + 5]}
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
                itemStyle={{ color: colorTextPrimary, fontSize: "12px", fontWeight: "bold" }}
                formatter={(value: any) => [`${value} ms`, "RMSSD"]}
              />
              <ReferenceLine
                y={50}
                stroke={colorBorderMedium}
                strokeDasharray="4 4"
                label={{
                  value: "Baseline (50ms)",
                  fill: colorTextSecondary,
                  fontSize: 10,
                  position: "top",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="url(#hrvSplit)"
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 1 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState subtitle="HRV data requires a Fitbit Sense or Charge 5+. Sync a wider date range or check your tracker options." />
        )}
      </div>
    </div>
  );
}
export default HRVTrendChart;
