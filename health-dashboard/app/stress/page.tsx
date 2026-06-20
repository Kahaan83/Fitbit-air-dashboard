"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Zap, Sparkles } from "lucide-react";
import { useChartData } from "@/lib/useChartData";
import { useDashboardStore } from "@/lib/store";

export default function StressMonitorPage() {
  const { acuteStress } = useChartData();
  const stressCount = acuteStress.length;

  const stressScore = Math.min(3.0, Math.max(0.1, (stressCount * 0.3)));
  const stressLabel = stressScore > 2.0 ? "HIGH" : stressScore > 1.0 ? "MEDIUM" : "LOW";

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
    <div className="space-y-8 animate-fadeIn max-w-3xl mx-auto py-8">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Overview
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Stress Monitor</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Detailed metrics regarding detected physiological acute stress events.
        </p>
      </div>

      {/* Main card */}
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[#1C1C1C] p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <span className="text-sm font-semibold tracking-wide text-[#888888]">
            PHYSIOLOGICAL STRESS STATE
          </span>
          <span
            className="text-sm font-bold tracking-wider"
            style={{ color: getLabelColor(stressLabel) }}
          >
            {stressLabel} STRESS LOAD
          </span>
        </div>

        {/* Big Stress Score representation */}
        <div className="flex flex-col items-center justify-center py-6 bg-[#111111] rounded-xl border border-[var(--border-subtle)]">
          <span className="text-6xl font-bold text-[#FFFFFF]">{stressScore.toFixed(1)}</span>
          <span className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mt-1">
            Current Stress Index
          </span>
          <span
            className="text-xs font-bold uppercase tracking-wider mt-3 px-2 py-0.5 rounded bg-[#1A3D2B]"
            style={{ color: getLabelColor(stressLabel) }}
          >
            {stressLabel}
          </span>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide text-[#888888]">
            stress load details
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            The stress index is computed by evaluating anomalies in daily heart rate (elevations above resting baseline) relative to physical motion inputs (steps). Elevations without high steps represent physiological acute stress.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-[#111111] border border-[var(--border-subtle)] flex items-center gap-3">
              <Zap className="h-5 w-5 text-[#FFB800]" />
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Stress Events</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">{stressCount} events / 30d</span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#111111] border border-[var(--border-subtle)] flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#00FF87]" />
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Peak Time</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">4:15 PM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
