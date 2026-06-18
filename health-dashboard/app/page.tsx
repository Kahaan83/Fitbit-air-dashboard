"use client";

import React from "react";
import HRVTrendChart from "@/components/charts/HRVTrendChart";
import VO2MaxChart from "@/components/charts/VO2MaxChart";
import AcuteStressHeatmap from "@/components/charts/AcuteStressHeatmap";
import HRZoneChart from "@/components/charts/HRZoneChart";
import { MetricInfo } from "@/components/MetricInfo";
import ChartErrorBoundary from "@/components/ChartErrorBoundary";
import { Activity, Zap, TrendingUp, HeartPulse, BatteryCharging, Moon, Footprints } from "lucide-react";
import { useChartData } from "@/lib/useChartData";

export default function OverviewPage() {
  const {
    hrv,
    vo2Max,
    acuteStress,
    hrvRolling7,
    recoveryScore,
    sleepEfficiency,
    stepGoalHitRate,
  } = useChartData();

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

      {/* Summary Scorecards Second Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: 7-day HRV avg */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">7-day HRV avg</span>
              <MetricInfo metricKey="hrv_rolling" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-black font-mono text-white">{hrvRolling7}</span>
              <span className="text-xs text-slate-400">ms</span>
            </div>
            <span className={`text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded ${
              hrvRolling7 >= 50 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>
              {hrvRolling7 >= 50 ? "Optimal Average" : "Suppressed Average"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-violet-600/10 flex items-center justify-center border border-violet-500/20 text-violet-400">
            <HeartPulse className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Recovery score */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Recovery score</span>
              <MetricInfo metricKey="recovery_score" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className={`text-3xl font-black font-mono ${
                recoveryScore >= 70 ? "text-emerald-400" : recoveryScore >= 50 ? "text-amber-400" : "text-red-400"
              }`}>{recoveryScore}</span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
            <span className={`text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded ${
              recoveryScore >= 70 ? "bg-emerald-500/10 text-emerald-400" : recoveryScore >= 50 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
            }`}>
              {recoveryScore >= 70 ? "Ready for Action" : recoveryScore >= 50 ? "Moderate Recovery" : "Rest Required"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-600/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
            <BatteryCharging className="h-6 w-6" />
          </div>
        </div>

        {/* Card 3: Sleep efficiency */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Sleep efficiency</span>
              <MetricInfo metricKey="sleep_efficiency" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-black font-mono text-white">{sleepEfficiency}</span>
              <span className="text-xs text-slate-400">%</span>
            </div>
            <span className={`text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded ${
              sleepEfficiency >= 85 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>
              {sleepEfficiency >= 85 ? "Good Efficiency" : "Restless Sleep"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-sky-600/10 flex items-center justify-center border border-sky-500/20 text-sky-400">
            <Moon className="h-6 w-6" />
          </div>
        </div>

        {/* Card 4: Step goal rate */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Step goal rate</span>
              <MetricInfo metricKey="step_goal_rate" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-black font-mono text-white">{stepGoalHitRate}%</span>
              <span className="text-xs text-slate-400">days / 30</span>
            </div>
            <span className={`text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded ${
              stepGoalHitRate >= 70 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>
              {stepGoalHitRate >= 70 ? "Consistent" : "Needs Focus"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-teal-600/10 flex items-center justify-center border border-teal-500/20 text-teal-400">
            <Footprints className="h-6 w-6" />
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
        <ChartErrorBoundary name="Heart Rate Zones">
          <HRZoneChart />
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
