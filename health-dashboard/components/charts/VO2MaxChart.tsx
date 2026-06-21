"use client";

import React from "react";
import { useChartData } from "@/lib/useChartData";
import { MetricInfo } from "@/components/MetricInfo";
import WhoopRing from "@/components/ui/WhoopRing";
import { useDashboardStore } from "@/lib/store";

function vo2Percentile(vo2max: number, age: number): number {
  // Approximate VO2Max percentile by age group
  // Based on ACSM fitness classification ranges
  const brackets: Record<string, number[][]> = {
    "20-29": [[25,5],[31,20],[37,40],[45,60],[50,80],[55,95]],
    "30-39": [[23,5],[29,20],[35,40],[43,60],[48,80],[52,95]],
    "40-49": [[21,5],[27,20],[33,40],[40,60],[45,80],[50,95]],
    "50-59": [[18,5],[24,20],[30,40],[37,60],[42,80],[46,95]],
  }
  const key = age < 30 ? "20-29" : age < 40 ? "30-39" : age < 50 ? "40-49" : "50-59"
  const scale = [...brackets[key]].reverse()
  for (const [threshold, pct] of scale) {
    if (vo2max >= threshold) return pct
  }
  return 5
}

export function VO2MaxChart() {
  const { vo2Max } = useChartData();
  const theme = useDashboardStore((state) => state.theme);
  const userAge = useDashboardStore((state) => state.userAge);
  const latestVO2Max = vo2Max.length > 0 ? Math.round(vo2Max[vo2Max.length - 1].vo2_max * 10) / 10 : 48.5;

  const colorAccentBlue = theme === "whoop" ? "#00D4FF" : "#38BDF8";
  const percentile = vo2Percentile(latestVO2Max, userAge ?? 30);

  return (
    <div
      data-testid="vo2-chart"
      className="rounded-2xl border-[0.5px] border-[var(--border-soft)] bg-[var(--bg-card)] p-[20px_24px] min-w-0"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
          VO2 MAX
        </span>
        <MetricInfo metricKey="vo2max" />
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center py-4">
        <WhoopRing label="VO2 MAX" value={latestVO2Max} max={80} unit="" color={colorAccentBlue} />
        <p className="text-[13px] text-[var(--text-secondary)] text-center mt-4 font-medium">
          Top {100 - percentile}% for your age group
        </p>
      </div>
    </div>
  );
}

export default VO2MaxChart;
