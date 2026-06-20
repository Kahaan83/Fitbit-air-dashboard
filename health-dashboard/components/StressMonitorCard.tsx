"use client";

import React from "react";
import { ChevronRight } from "lucide-react";

type StressMonitorCardProps = {
  score: number;      // 0.0–3.0
  label: string;      // "LOW" | "MEDIUM" | "HIGH"
  peakTime: string;   // e.g. "4:15 PM"
  onClick?: () => void;
};

export function StressMonitorCard({
  score,
  label,
  peakTime,
  onClick,
}: StressMonitorCardProps) {
  const getLabelColor = (lvl: string) => {
    switch (lvl.toUpperCase()) {
      case "LOW":
        return "#00FF87";
      case "MEDIUM":
        return "#FFB800";
      case "HIGH":
        return "#FF3B5C";
      default:
        return "#888888";
    }
  };

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
          STRESS MONITOR
        </span>
        <ChevronRight className="h-4 w-4 text-[#444444]" />
      </div>

      {/* Status Row */}
      <div className="flex items-center gap-3">
        {/* Status Badge */}
        <div className="rounded-[6px] bg-[#1A3D2B] px-2 py-1.5 flex items-center justify-center font-bold text-sm text-[#00FF87] min-w-[28px] text-center">
          {score.toFixed(1)}
        </div>
        {/* Status Text & Subtitle */}
        <div className="flex flex-col">
          <span
            className="text-sm font-bold tracking-wide"
            style={{ color: getLabelColor(label) }}
          >
            {label} STRESS
          </span>
          <span className="text-[13px] text-[#888888] mt-0.5">
            Peak at {peakTime}
          </span>
        </div>
      </div>
    </div>
  );
}

export default StressMonitorCard;
