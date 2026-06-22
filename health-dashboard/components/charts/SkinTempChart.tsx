"use client";

import React, { useState, useEffect } from "react";
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
import { MetricInfo } from "@/components/MetricInfo";
import { EmptyChartState } from "./EmptyChartState";
import { useDashboardStore } from "@/lib/store";

export function SkinTempChart() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { skinTemp } = useChartData();
  const theme = useDashboardStore((state) => state.theme);

  const colorTextSecondary = theme === "whoop" ? "#888888" : "#9090A8";
  const colorBorderSubtle = theme === "whoop" ? "rgba(255,255,255,0.04)" : "rgba(124,109,250,0.08)";
  const colorBorderMedium = theme === "whoop" ? "rgba(255,255,255,0.14)" : "rgba(124,109,250,0.25)";
  const colorBgSurface = theme === "whoop" ? "#0A0A0A" : "#111118";
  const colorTextPrimary = theme === "whoop" ? "#FFFFFF" : "#E8E8F0";
  const colorAccentRed = theme === "whoop" ? "#FF3B5C" : "#F4546A";
  const colorAccentBlue = theme === "whoop" ? "#00D4FF" : "#38BDF8";

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
      className="rounded-2xl border-[0.5px] border-[var(--border-soft)] bg-[var(--bg-card)] p-[20px_24px] min-w-0"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
          SKIN TEMPERATURE
        </span>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-[10px] font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1 text-[var(--accent-red)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-red)]" /> Elevated
            </span>
            <span className="flex items-center gap-1 text-[var(--accent-sky)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-sky)]" /> Suppressed
            </span>
          </div>
          <MetricInfo metricKey="sleep_temp_deviation" />
        </div>
      </div>

      <div className="h-[280px] w-full" role="img" aria-label="Sleep Skin Temperature Deviation chart">
        {!mounted ? null : hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={skinTemp} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
                domain={[Math.floor(minVal * 1.5 * 10) / 10, Math.ceil(maxVal * 1.5 * 10) / 10]}
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
                formatter={(value: any) => [`${value > 0 ? "+" : ""}${value} °C`, "Deviation"]}
              />
              <ReferenceLine y={0} stroke={colorBorderMedium} />
              <Bar dataKey="value">
                {skinTemp.map((entry: any, index: number) => {
                  const color = entry.value >= 0 ? colorAccentRed : colorAccentBlue;
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
