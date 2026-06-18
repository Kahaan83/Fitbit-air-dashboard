"use client";

import React from "react";
import HRVTrendChart from "@/components/charts/HRVTrendChart";
import VO2MaxChart from "@/components/charts/VO2MaxChart";
import AcuteStressHeatmap from "@/components/charts/AcuteStressHeatmap";
import { MetricInfo } from "@/components/MetricInfo";
import ChartErrorBoundary from "@/components/ChartErrorBoundary";
import { Activity, Zap, TrendingUp } from "lucide-react";
import { useChartData } from "@/lib/useChartData";

export default function OverviewPage() {
  const { hrv, vo2Max, acuteStress } = useChartData();

  // Compute brief summary stats
  const latestHRV = hrv[hrv.length - 1]?.value || 0;
  const latestVO2 = vo2Max[vo2Max.length - 1]?.vo2_max || 0;
  const stressCount = acuteStress.length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Title & Heading */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Physiological Overview</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time biometric analytics, autonomic feedback, and acute stress signatures.
          </p>
        </div>
      </div>

      {/* Summary Scorecards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: HRV */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Latest HRV (RMSSD)</span>
              <MetricInfo metricKey="hrv_overview" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-black font-mono text-white">{latestHRV}</span>
              <span className="text-xs text-slate-400">ms</span>
            </div>
            <span className={`text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded ${
              latestHRV >= 50 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>
              {latestHRV >= 50 ? "Optimal Recovery" : "Suppressed Recovery"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-violet-600/10 flex items-center justify-center border border-violet-500/20 text-violet-400">
            <Activity className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: VO2 Max */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Cardiovascular VO2 Max</span>
              <MetricInfo metricKey="vo2max" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-black font-mono text-white">{latestVO2}</span>
              <span className="text-xs text-slate-400">ml/kg/min</span>
            </div>
            <span className="text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
              Good Fitness Zone
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Card 3: Acute Stress */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Detected Stress Events</span>
              <MetricInfo metricKey="acute_stress" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-black font-mono text-white">{stressCount}</span>
              <span className="text-xs text-slate-400">events / 30d</span>
            </div>
            <span className={`text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded ${
              stressCount > 6 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
            }`}>
              {stressCount > 6 ? "High Stress Load" : "Balanced Load"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-orange-600/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
            <Zap className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ChartErrorBoundary name="Heart Rate Variability Trend">
          <HRVTrendChart />
        </ChartErrorBoundary>
        <ChartErrorBoundary name="VO2 Max Trend">
          <VO2MaxChart />
        </ChartErrorBoundary>
      </div>

      {/* Full-width Heatmap grid */}
      <div className="w-full">
        <ChartErrorBoundary name="Acute Stress Heatmap">
          <AcuteStressHeatmap />
        </ChartErrorBoundary>
      </div>
    </div>
  );
}
