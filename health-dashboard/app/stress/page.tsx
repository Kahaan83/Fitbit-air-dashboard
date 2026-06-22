"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Zap, Sparkles } from "lucide-react";
import { useChartData } from "@/lib/useChartData";
import { useDashboardStore } from "@/lib/store";
import { mockStressEvents } from "@/lib/mockData";

export default function StressMonitorPage() {
  const { acuteStress } = useChartData();
  const { dataMode, liveData } = useDashboardStore();
  const stressCount = acuteStress.length;

  const stressScore = Math.min(3.0, Math.max(0.1, (stressCount * 0.3)));
  const stressLabel = stressScore > 2.0 ? "HIGH" : stressScore > 1.0 ? "MEDIUM" : "LOW";

  const peakStressEvent = useMemo(() => {
    const events = dataMode === "live" ? (liveData?.derived?.acute_stress ?? []) : mockStressEvents;
    if (!events.length) return { score: 0, time: "--" };
    const peak = events.reduce((max: any, e: any) => {
      const eScore = e.hr_peak || e.score || 0;
      const maxScore = max.hr_peak || max.score || 0;
      return eScore > maxScore ? e : max;
    }, events[0]);
    return {
      score: peak.hr_peak || peak.score || 0,
      time: new Date(peak.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    };
  }, [liveData, dataMode]);

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
    <div className="space-y-8 animate-fadeIn max-w-3xl mx-auto py-8 px-8">
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
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <span className="text-sm font-semibold tracking-wide text-[var(--text-secondary)]">
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
        <div className="flex flex-col items-center justify-center py-6 bg-[var(--bg-base)] rounded-xl border border-[var(--border-subtle)]">
          <span className="text-6xl font-bold text-[var(--text-primary)]">{stressScore.toFixed(1)}</span>
          <span className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mt-1">
            Current Stress Index
          </span>
          <span
            className="text-xs font-bold uppercase tracking-wider mt-3 px-2 py-0.5 rounded border border-[var(--border-soft)]"
            style={{
              backgroundColor: "rgba(34, 211, 165, 0.1)",
              color: getLabelColor(stressLabel)
            }}
          >
            {stressLabel}
          </span>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            stress load details
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            The stress index is computed by evaluating anomalies in daily heart rate (elevations above resting baseline) relative to physical motion inputs (steps). Elevations without high steps represent physiological acute stress.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center gap-3">
              <Zap className="h-5 w-5 text-[var(--accent-amber)]" />
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Stress Events</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">{stressCount} events / 30d</span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[var(--accent-green)]" />
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Peak Time</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">{peakStressEvent.time}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
