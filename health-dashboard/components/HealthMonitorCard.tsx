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
      className={`rounded-2xl border-[0.5px] border-[var(--border-soft)] bg-[var(--bg-card)] p-5 select-none transition-all ${
        onClick ? "cursor-pointer hover:bg-[var(--bg-card-hover)] active:scale-[0.99]" : ""
      }`}
    >
      {/* Title Row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
          HEALTH MONITOR
        </span>
        <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
      </div>

      {/* Status Row */}
      <div className="flex items-center gap-3">
        {/* Status Badge */}
        <div className="rounded-[6px] bg-[var(--accent-green)]/10 px-2 py-1.5 flex items-center justify-center">
          <Check className="h-4 w-4 text-[var(--accent-green)]" />
        </div>
        {/* Status Text & Subtitle */}
        <div className="flex flex-col">
          <span
            className="text-sm font-bold tracking-wide"
            style={{ color: isWithinRange ? "var(--accent-green)" : "var(--accent-red)" }}
          >
            {isWithinRange ? "WITHIN RANGE" : "OUT OF RANGE"}
          </span>
          <span className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            {metricsInRange}/{totalMetrics} Metrics
          </span>
        </div>
      </div>
    </div>
  );
}

export default HealthMonitorCard;
