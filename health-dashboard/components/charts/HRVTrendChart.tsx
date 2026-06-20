"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartData } from "@/lib/useChartData";
import { MetricInfo } from "@/components/MetricInfo";
import { EmptyChartState } from "./EmptyChartState";
import { cssVar } from "@/lib/cssVar";

export function HRVTrendChart() {
  const { hrv } = useChartData();

  const colorTextSecondary = cssVar("--text-secondary") || "#888888";
  const colorBorderSubtle = "rgba(255,255,255,0.04)";
  const colorBorderMedium = "rgba(255,255,255,0.08)";
  const colorBgSurface = "#1C1C1C";
  const colorTextPrimary = "#FFFFFF";

  const hasData = hrv && hrv.length > 0;

  let minVal = 20;
  let maxVal = 80;
  if (hasData) {
    const values = hrv.map((d: any) => d.value);
    minVal = Math.min(...values, 20);
    maxVal = Math.max(...values, 80);
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
      className="rounded-2xl border-[0.5px] border-[rgba(255,255,255,0.08)] bg-[#111111] p-[20px_24px] min-w-0"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-[#888888] uppercase">
          HRV RECOVERY TREND
        </span>
        <MetricInfo metricKey="hrv" />
      </div>

      <div className="h-[320px] w-full" role="img" aria-label="HRV Recovery Trend chart">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hrv} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="hrvAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00FF87" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00FF87" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                domain={[Math.floor(minVal - 5), Math.ceil(maxVal + 5)]}
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
                formatter={(value: any) => [`${value} ms`, "RMSSD"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#00FF87"
                strokeWidth={2}
                fill="url(#hrvAreaGrad)"
                dot={{ r: 3, fill: "#00FF87", strokeWidth: 1 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState subtitle="HRV data requires tracked HRV recordings." />
        )}
      </div>
    </div>
  );
}

export default HRVTrendChart;
