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
        return "var(--accent-green)";
      case "MEDIUM":
        return "var(--accent-amber)";
      case "HIGH":
        return "var(--accent-red)";
      default:
        return "var(--text-secondary)";
    }
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border-[0.5px] border-[var(--border-soft)] bg-[var(--bg-card)] p-5 select-none transition-all ${
        onClick ? "cursor-pointer hover:bg-[var(--bg-card-hover)] active:scale-[0.99]" : ""
      }`}
    >
      {/* Title Row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
          STRESS MONITOR
        </span>
        <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
      </div>

      {/* Status Row */}
      <div className="flex items-center gap-3">
        {/* Status Badge */}
        <div 
          className="rounded-[6px] bg-[var(--bg-base)] border border-[var(--border-soft)] px-2 py-1.5 flex items-center justify-center font-bold text-sm min-w-[28px] text-center"
          style={{ color: getLabelColor(label) }}
        >
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
          <span className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Peak at {peakTime}
          </span>
        </div>
      </div>
    </div>
  );
}

export default StressMonitorCard;
