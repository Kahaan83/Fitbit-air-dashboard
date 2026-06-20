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
import { MetricInfo } from "@/components/MetricInfo";
import { EmptyChartState } from "./EmptyChartState";
import { cssVar } from "@/lib/cssVar";

export function SkinTempChart() {
  const { skinTemp } = useChartData();

  const colorTextSecondary = cssVar("--text-secondary") || "#888888";
  const colorBorderSubtle = "rgba(255,255,255,0.04)";
  const colorBorderMedium = "rgba(255,255,255,0.08)";
  const colorBgSurface = "#1C1C1C";
  const colorTextPrimary = "#FFFFFF";
  const colorAccentRed = "#FF3B5C";
  const colorAccentBlue = "#3B7FD4";

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
      className="rounded-2xl border-[0.5px] border-[rgba(255,255,255,0.08)] bg-[#111111] p-[20px_24px] min-w-0"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-[#888888] uppercase">
          SKIN TEMPERATURE
        </span>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-[10px] font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1 text-[#FF3B5C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B5C]" /> Elevated
            </span>
            <span className="flex items-center gap-1 text-[#3B7FD4]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B7FD4]" /> Suppressed
            </span>
          </div>
          <MetricInfo metricKey="sleep_temp_deviation" />
        </div>
      </div>

      <div className="h-[280px] w-full" role="img" aria-label="Sleep Skin Temperature Deviation chart">
        {hasData ? (
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
                labelClassName="text-[#888888] text-xs font-mono"
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
