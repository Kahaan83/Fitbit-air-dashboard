"use client";
import React, { useState, useEffect } from "react";
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

const getVar = (name: string) =>
  typeof window !== "undefined"
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : "";

export function ANSBalanceChart() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { ansBalance } = useChartData();

  const colorTextSecondary = getVar("--text-secondary");
  const colorBorderSubtle = getVar("--border-subtle");
  const colorBorderMedium = getVar("--border-medium");
  const colorBgSurface = getVar("--bg-surface");
  const colorTextPrimary = getVar("--text-primary");
  const colorHF = getVar("--accent-green");
  const colorLF = "#9747FF";
  const colorRatio = getVar("--accent-amber");

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
            title="Autonomic balance proxy derived from daily RMSSD. True LF/HF spectral analysis requires raw RR intervals."
          >
            ⓘ
          </span>
        </div>
        <MetricInfo metricKey="lf_hf_ratio" />
      </div>

      <div className="h-[280px] w-full" role="img" aria-label="ANS Autonomic Balance chart">
        {!mounted ? null : ansBalance && ansBalance.length > 0 ? (
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
                formatter={(value: any, name: any) => {
                  if (name === "sympathetic") return [`${value}%`, "Sympathetic (SNS)"];
                  if (name === "parasympathetic") return [`${value}%`, "Parasympathetic (PNS)"];
                  return [value, name];
                }}
              />
              <Bar dataKey="sympathetic" name="sympathetic" fill={colorLF} radius={[2, 2, 0, 0]} barSize={12} />
              <Bar dataKey="parasympathetic" name="parasympathetic" fill={colorHF} radius={[2, 2, 0, 0]} barSize={12} />
              <Line
                type="monotone"
                dataKey="parasympathetic"
                name="ANS Balance"
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
