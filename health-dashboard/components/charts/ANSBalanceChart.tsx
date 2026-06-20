"use client";

import React from "react";
import {
  ComposedChart,
  Bar,
  Line,
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

export function ANSBalanceChart() {
  const { ansBalance } = useChartData();

  const colorTextSecondary = cssVar("--text-secondary") || "#888888";
  const colorBorderSubtle = "rgba(255,255,255,0.04)";
  const colorBorderMedium = "rgba(255,255,255,0.08)";
  const colorBgSurface = "#1C1C1C";
  const colorTextPrimary = "#FFFFFF";

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
      data-testid="ans-chart"
      className="rounded-2xl border-[0.5px] border-[rgba(255,255,255,0.08)] bg-[#111111] p-[20px_24px] min-w-0"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-[#888888] uppercase">
          ANS BALANCE
        </span>
        <MetricInfo metricKey="lf_hf_ratio" />
      </div>

      <div className="h-[280px] w-full" role="img" aria-label="ANS Autonomic Balance chart">
        {ansBalance && ansBalance.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={ansBalance} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
                yAxisId="power"
                stroke={colorTextSecondary}
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="ratio"
                orientation="right"
                stroke={colorTextSecondary}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[0, 3]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: colorBgSurface,
                  borderColor: colorBorderMedium,
                  borderRadius: "8px",
                }}
                labelClassName="text-[#888888] text-xs font-mono"
                itemStyle={{ fontSize: "12px", color: colorTextPrimary }}
              />
              <Bar yAxisId="power" dataKey="lf_power" name="LF Power" fill="#9747FF" radius={[2, 2, 0, 0]} barSize={12} />
              <Bar yAxisId="power" dataKey="hf_power" name="HF Power" fill="#00FF87" radius={[2, 2, 0, 0]} barSize={12} />
              <Line
                yAxisId="ratio"
                type="monotone"
                dataKey="lf_hf_ratio"
                name="LF/HF Ratio"
                stroke="#FFB800"
                strokeWidth={1.5}
                dot={{ r: 3, fill: "#FFB800" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState subtitle="ANS balance calculation requires continuous heart rate variability data." />
        )}
      </div>
    </div>
  );
}

export default ANSBalanceChart;
