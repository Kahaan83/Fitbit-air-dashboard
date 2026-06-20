"use client";

import React from "react";
import { useChartData } from "@/lib/useChartData";
import { MetricInfo } from "@/components/MetricInfo";
import WhoopRing from "@/components/ui/WhoopRing";

export function VO2MaxChart() {
  const { vo2Max } = useChartData();
  const latestVO2Max = vo2Max.length > 0 ? Math.round(vo2Max[vo2Max.length - 1].vo2_max * 10) / 10 : 48.5;

  return (
    <div
      data-testid="vo2-chart"
      className="rounded-2xl border-[0.5px] border-[rgba(255,255,255,0.08)] bg-[#111111] p-[20px_24px] min-w-0"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-[#888888] uppercase">
          VO2 MAX
        </span>
        <MetricInfo metricKey="vo2max" />
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center py-4">
        <WhoopRing label="VO2 MAX" value={latestVO2Max} max={80} unit="" color="#3B7FD4" />
        <p className="text-[13px] text-[#888888] text-center mt-4 font-medium">
          Top 23% for your age group
        </p>
      </div>
    </div>
  );
}

export default VO2MaxChart;
