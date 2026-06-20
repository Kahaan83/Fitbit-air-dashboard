"use client";

import React from "react";
import { BarChart3 } from "lucide-react";

interface EmptyChartStateProps {
  title?: string;
  subtitle: string;
}

export function EmptyChartState({ title = "No data for this period", subtitle }: EmptyChartStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center p-6 rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-base)]/20 backdrop-blur-xs select-none">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--border-subtle)] text-[var(--text-secondary)]">
        <BarChart3 className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1">{title}</h4>
      <p className="text-xs text-[var(--text-secondary)] max-w-xs leading-relaxed">{subtitle}</p>
    </div>
  );
}

export default EmptyChartState;
