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
import { MetricInfo } from "@/components/MetricInfo";
import { EmptyChartState } from "./EmptyChartState";
import { useDashboardStore } from "@/lib/store";

export function NocturnalSpO2Chart() {
  const { spo2Nocturnal, isSpO2Fallback } = useChartData();
  const availableDates = Object.keys(spo2Nocturnal).sort((a, b) => b.localeCompare(a)); // Newest first

  const [selectedDate, setSelectedDate] = useState("");
  const theme = useDashboardStore((state) => state.theme);

  const colorTextSecondary = theme === "whoop" ? "#888888" : "#9090A8";
  const colorBorderSubtle = theme === "whoop" ? "rgba(255,255,255,0.04)" : "rgba(124,109,250,0.08)";
  const colorBorderMedium = theme === "whoop" ? "rgba(255,255,255,0.14)" : "rgba(124,109,250,0.25)";
  const colorBgSurface = theme === "whoop" ? "#0A0A0A" : "#111118";
  const colorTextPrimary = theme === "whoop" ? "#FFFFFF" : "#E8E8F0";
  const colorChartSpo2 = theme === "whoop" ? "#00D4FF" : "#4ECDC4";
  const colorAccentRed = theme === "whoop" ? "#FF3B5C" : "#F4546A";

  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  const currentData = selectedDate ? spo2Nocturnal[selectedDate] || [] : [];

  const values = currentData.map((d: any) => d.value);
  let minVal = 85;
  let maxVal = 100;
  let offset = 1;

  if (values.length > 0) {
    minVal = Math.min(...values, 85);
    maxVal = Math.max(...values, 100);
    if (maxVal !== minVal) {
      offset = (maxVal - 90) / (maxVal - minVal);
    }
    offset = Math.max(0, Math.min(1, offset));
  }

  return (
    <div
      data-testid="spo2-chart"
      className="rounded-2xl border-[0.5px] border-[var(--border-soft)] bg-[var(--bg-card)] p-[20px_24px] min-w-0"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
            NOCTURNAL SpO2
          </span>
          {isSpO2Fallback && (
            <span className="text-[10px] text-[var(--accent-amber)] font-semibold uppercase tracking-wider">
              (Averages Only)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {availableDates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Night:</span>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer font-semibold"
              >
                {availableDates.map((d: string) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
          <MetricInfo metricKey="spo2" />
        </div>
      </div>

      {currentData.length === 0 ? (
        <div className="h-[280px] w-full">
          <EmptyChartState subtitle="Nocturnal SpO2 data requires active sleep records. Sync a wider date range or check your device settings." />
        </div>
      ) : (
        <>
          <div className="h-[280px] w-full" role="img" aria-label="Nocturnal Oxygen Saturation (SpO2) chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="spo2Fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={0} stopColor={colorChartSpo2} stopOpacity={0.4} />
                    <stop offset={offset} stopColor={colorChartSpo2} stopOpacity={0.1} />
                    <stop offset={offset} stopColor={colorAccentRed} stopOpacity={0.4} />
                    <stop offset={1} stopColor={colorAccentRed} stopOpacity={0.1} />
                  </linearGradient>
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
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={24}
                />
                <YAxis
                  domain={[Math.floor(minVal - 2), 100]}
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
                  labelClassName="text-[var(--text-secondary)] text-xs font-mono"
                  itemStyle={{ color: colorTextPrimary, fontSize: "12px", fontWeight: "bold" }}
                  formatter={(value: any) => [`${value}%`, "Oxygen Saturation"]}
                />
                <ReferenceLine
                  y={90}
                  stroke={colorAccentRed}
                  strokeDasharray="4 4"
                  label={{
                    value: "Hypoxemia (90%)",
                    fill: colorAccentRed,
                    fontSize: 9,
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

          <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)]/40 p-3 flex justify-between items-center text-xs">
            <span className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px] font-semibold">Night Analysis summary:</span>
            <div className="flex gap-4 font-mono font-bold text-[var(--text-primary)]">
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--text-secondary)] font-normal font-sans text-[11px]">Min SpO2:</span>
                <span className={values.some(v => v < 90) ? "text-[var(--accent-red)]" : "text-[var(--accent-teal)]"}>
                  {values.length > 0 ? Math.min(...values) : "—"}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--text-secondary)] font-normal font-sans text-[11px]">Average:</span>
                <span>
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
