"use client";

import React from "react";
import {
  BarChart,
  Bar,
  Cell,
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

export function SkinTempChart() {
  const { skinTemp } = useChartData();
  const theme = useDashboardStore((state) => state.theme);

  const colorTextSecondary = css("--text-secondary") || "#9090A8";
  const colorBorderSubtle = css("--border-subtle") || "rgba(124,109,250,0.08)";
  const colorBorderMedium = css("--border-medium") || "rgba(124,109,250,0.25)";
  const colorBgSurface = css("--bg-surface") || "#111118";
  const colorTextPrimary = css("--text-primary") || "#E8E8F0";
  const colorAccentAmber = css("--accent-amber") || "#F59E0B";
  const colorAccentSky = css("--accent-sky") || "#38BDF8";

  const formatXAxis = (tickItem: string) => {
    try {
      const parts = tickItem.split("-");
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } catch {
      return tickItem;
    }
  };

  const hasData = skinTemp && skinTemp.length > 0;
  let minVal = -1.0;
  let maxVal = 1.0;

  if (hasData) {
    const values = skinTemp.map((d: any) => d.value);
    minVal = Math.min(...values, -1.0);
    maxVal = Math.max(...values, 1.0);
  }

  return (
    <div
      data-testid="skin-temp-chart"
      className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5 min-w-0"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Sleep Skin Temperature Deviation</h3>
            <MetricInfo metricKey="sleep_temp_deviation" />
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Nightly variation relative to 7-day personal baseline (°C)</p>
        </div>
        <div className="flex gap-3 text-xs font-medium">
          <span className="flex items-center gap-1 text-[var(--accent-amber)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-amber)]" /> Elevated (&gt;0°C)
          </span>
          <span className="flex items-center gap-1 text-[var(--accent-sky)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-sky)]" /> Suppressed (&lt;0°C)
          </span>
        </div>
      </div>

      <div className="h-64 w-full" role="img" aria-label="Sleep Skin Temperature Deviation chart">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={skinTemp} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
                domain={[Math.floor(minVal * 1.5 * 10) / 10, Math.ceil(maxVal * 1.5 * 10) / 10]}
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
                formatter={(value: any) => [`${value > 0 ? "+" : ""}${value} °C`, "Deviation"]}
              />
              <ReferenceLine y={0} stroke={colorBorderMedium} />
              <Bar dataKey="value">
                {skinTemp.map((entry: any, index: number) => {
                  const color = entry.value >= 0 ? colorAccentAmber : colorAccentSky;
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState subtitle="Sleep temperature deviation requires a device with skin temperature sensors (Fitbit Sense/Charge 5+)." />
        )}
      </div>
    </div>
  );
}
export default SkinTempChart;
