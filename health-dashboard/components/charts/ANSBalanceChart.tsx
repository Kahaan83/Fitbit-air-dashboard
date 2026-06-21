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
import { useDashboardStore } from "@/lib/store";

export function ANSBalanceChart() {
  const { ansBalance } = useChartData();
  const theme = useDashboardStore((state) => state.theme);

  const colorTextSecondary = theme === "whoop" ? "#888888" : "#9090A8";
  const colorBorderSubtle = theme === "whoop" ? "rgba(255,255,255,0.04)" : "rgba(124,109,250,0.08)";
  const colorBorderMedium = theme === "whoop" ? "rgba(255,255,255,0.14)" : "rgba(124,109,250,0.25)";
  const colorBgSurface = theme === "whoop" ? "#0A0A0A" : "#111118";
  const colorTextPrimary = theme === "whoop" ? "#FFFFFF" : "#E8E8F0";
  const colorHF = theme === "whoop" ? "#00FF9C" : "#22D3A5";
  const colorLF = "#9747FF";
  const colorRatio = theme === "whoop" ? "#FFB800" : "#F59E0B";

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
      className="rounded-2xl border-[0.5px] border-[var(--border-soft)] bg-[var(--bg-card)] p-[20px_24px] min-w-0"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
            ANS BALANCE
          </span>
          <span
            className="text-[11px] text-[var(--text-secondary)] cursor-help hover:text-[var(--text-primary)] transition-colors"
            title="True LF/HF spectral analysis requires raw RR intervals."
          >
            ⓘ
          </span>
        </div>
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
                stroke={colorTextSecondary}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: colorBgSurface,
                  borderColor: colorBorderMedium,
                  borderRadius: "8px",
                }}
                labelClassName="text-[var(--text-secondary)] text-xs font-mono"
                itemStyle={{ fontSize: "12px", color: colorTextPrimary }}
              />
              <Bar dataKey="sympathetic" name="Sympathetic" fill={colorLF} radius={[2, 2, 0, 0]} barSize={12} />
              <Bar dataKey="parasympathetic" name="Parasympathetic" fill={colorHF} radius={[2, 2, 0, 0]} barSize={12} />
              <Line
                type="monotone"
                dataKey="parasympathetic"
                name="ANS Balance (RMSSD proxy)"
                stroke={colorRatio}
                strokeWidth={1.5}
                dot={{ r: 3, fill: colorRatio }}
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
