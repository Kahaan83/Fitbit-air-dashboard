"use client";

import React from "react";
import { Check, ChevronRight } from "lucide-react";

type HealthMonitorCardProps = {
  metricsInRange: number;
  totalMetrics: number;
  onClick?: () => void;
};

export function HealthMonitorCard({
  metricsInRange,
  totalMetrics,
  onClick,
}: HealthMonitorCardProps) {
  const isWithinRange = metricsInRange === totalMetrics;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border-[0.5px] border-[rgba(255,255,255,0.08)] bg-[#1C1C1C] p-5 select-none transition-all ${
        onClick ? "cursor-pointer hover:bg-[#252525] active:scale-[0.99]" : ""
      }`}
    >
      {/* Title Row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] font-semibold tracking-[0.08em] text-[#888888] uppercase">
          HEALTH MONITOR
        </span>
        <ChevronRight className="h-4 w-4 text-[#444444]" />
      </div>

      {/* Status Row */}
      <div className="flex items-center gap-3">
        {/* Status Badge */}
        <div className="rounded-[6px] bg-[#1A3D2B] px-2 py-1.5 flex items-center justify-center">
          <Check className="h-4 w-4 text-[#FFFFFF]" />
        </div>
        {/* Status Text & Subtitle */}
        <div className="flex flex-col">
          <span
            className="text-sm font-bold tracking-wide"
            style={{ color: isWithinRange ? "#00FF87" : "#FF3B5C" }}
          >
            {isWithinRange ? "WITHIN RANGE" : "OUT OF RANGE"}
          </span>
          <span className="text-[13px] text-[#888888] mt-0.5">
            {metricsInRange}/{totalMetrics} Metrics
          </span>
        </div>
      </div>
    </div>
  );
}

export default HealthMonitorCard;
