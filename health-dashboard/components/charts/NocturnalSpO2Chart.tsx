"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
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

export function NocturnalSpO2Chart() {
  const { spo2Nocturnal, isSpO2Fallback } = useChartData();
  const theme = useDashboardStore((state) => state.theme);
  const availableDates = Object.keys(spo2Nocturnal).sort((a, b) => b.localeCompare(a)); // Newest first

  const [selectedDate, setSelectedDate] = useState("");

  const colorTextSecondary = css("--text-secondary") || "#9090A8";
  const colorBorderSubtle = css("--border-subtle") || "rgba(124,109,250,0.08)";
  const colorBorderMedium = css("--border-medium") || "rgba(124,109,250,0.25)";
  const colorBgSurface = css("--bg-surface") || "#111118";
  const colorTextPrimary = css("--text-primary") || "#E8E8F0";
  const colorChartSpo2 = css("--chart-spo2") || "#4ECDC4";
  const colorAccentRed = css("--accent-red") || "#F4546A";

  // Default to the most recent night available
  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  const currentData = selectedDate ? spo2Nocturnal[selectedDate] || [] : [];

  // Calculate dynamic stops for hypoxemia split at 90%
  const values = currentData.map((d: any) => d.value);
  let minVal = 85;
  let maxVal = 100;
  let offset = 1; // Default to all optimal

  if (values.length > 0) {
    minVal = Math.min(...values, 85);
    maxVal = Math.max(...values, 100);
    if (maxVal !== minVal) {
      // Top is maxVal, bottom is minVal.
      // So percentage from top to threshold 90 is: (maxVal - 90) / (maxVal - minVal)
      offset = (maxVal - 90) / (maxVal - minVal);
    }
    offset = Math.max(0, Math.min(1, offset));
  }

  return (
    <div
      data-testid="spo2-chart"
      className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5 min-w-0"
    >
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Nocturnal Oxygen Saturation (SpO2)</h3>
            <MetricInfo metricKey="spo2" />
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Continuous 5-minute resolution during sleep</p>
          {isSpO2Fallback && (
            <p className="text-[11px] text-[var(--accent-amber)] mt-1.5 font-medium">
              Showing daily averages — intraday SpO2 unavailable for this device.
            </p>
          )}
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">Select Night:</label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-base)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors cursor-pointer"
          >
            {availableDates.map((d: string) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentData.length === 0 ? (
        <div className="h-64 w-full">
          <EmptyChartState subtitle="Nocturnal SpO2 data requires active sleep records. Sync a wider date range or check your device settings." />
        </div>
      ) : (
        <>
          <div className="h-64 w-full" role="img" aria-label="Nocturnal Oxygen Saturation (SpO2) chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  {/* Area Fill Gradient */}
                  <linearGradient id="spo2Fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={0} stopColor={colorChartSpo2} stopOpacity={0.4} />
                    <stop offset={offset} stopColor={colorChartSpo2} stopOpacity={0.1} />
                    <stop offset={offset} stopColor={colorAccentRed} stopOpacity={0.4} />
                    <stop offset={1} stopColor={colorAccentRed} stopOpacity={0.1} />
                  </linearGradient>
                  {/* Stroke Line Gradient */}
                  <linearGradient id="spo2Stroke" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={0} stopColor={colorChartSpo2} stopOpacity={1} />
                    <stop offset={offset} stopColor={colorChartSpo2} stopOpacity={1} />
                    <stop offset={offset} stopColor={colorAccentRed} stopOpacity={1} />
                    <stop offset={1} stopColor={colorAccentRed} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colorBorderSubtle} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke={colorTextSecondary}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={24} // Only display a few hours ticks
                />
                <YAxis
                  domain={[Math.floor(minVal - 2), 100]}
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
                  formatter={(value: any) => [`${value}%`, "Oxygen Saturation"]}
                />
                {/* Critical Hypoxemia Threshold Reference Line */}
                <ReferenceLine
                  y={90}
                  stroke={colorAccentRed}
                  strokeDasharray="4 4"
                  label={{
                    value: "Hypoxemia Threshold (90%)",
                    fill: colorAccentRed,
                    fontSize: 10,
                    position: "top",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="url(#spo2Stroke)"
                  strokeWidth={2}
                  fill="url(#spo2Fill)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/40 p-3 flex justify-between items-center text-xs">
            <span className="text-[var(--text-secondary)]">Night Analysis summary:</span>
            <div className="flex gap-4 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--text-secondary)]">Min SpO2:</span>
                <span className={`font-bold ${values.some(v => v < 90) ? "text-[var(--accent-red)]" : "text-[var(--chart-spo2)]"}`}>
                  {values.length > 0 ? Math.min(...values) : "—"}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--text-secondary)]">Average:</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {values.length > 0 ? (values.reduce((a: number, b: number) => a + b, 0) / values.length).toFixed(1) : "—"}%
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export default NocturnalSpO2Chart;
