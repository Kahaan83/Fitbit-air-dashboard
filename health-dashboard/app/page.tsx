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
import { useDashboardStore } from "@/lib/store";
import DataStreamsStrip from "@/components/DataStreamsStrip";
import { SkeletonCard, SkeletonChart } from "@/components/Skeleton";

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
  const { dataMode, isLoadingLiveData } = useDashboardStore();

  // Compute brief summary stats
  const latestHRV = hrv[hrv.length - 1]?.value || 0;
  const latestVO2 = vo2Max[vo2Max.length - 1]?.vo2_max || 0;
  const stressCount = acuteStress.length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Title & Heading */}
      <div>
        <h1 className="text-xl font-semibold tracking-normal text-white">Physiological Overview</h1>
        <p className="text-slate-400 text-[13px] mt-1">30-day physiological summary</p>
      </div>

      {/* Data Streams Strip */}
      <DataStreamsStrip />

      {/* Summary Scorecards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dataMode === "live" && isLoadingLiveData ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
        <div className="rounded-xl border border-white/8 bg-slate-900/60 p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Activity className="h-5 w-5 text-violet-400" />
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Latest HRV (RMSSD)</span>
              <MetricInfo metricKey="hrv_overview" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-semibold text-white">{latestHRV}</span>
              <span className="text-xs text-slate-400">ms</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              latestHRV >= 50 ? "text-emerald-400" : "text-amber-400"
            }`}>
              {latestHRV >= 50 ? "Optimal Recovery" : "Suppressed Recovery"}
            </span>
          </div>
        </div>

        {/* Card 2: VO2 Max */}
        <div className="rounded-xl border border-white/8 bg-slate-900/60 p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Cardiovascular VO2 Max</span>
              <MetricInfo metricKey="vo2max" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-semibold text-white">{latestVO2}</span>
              <span className="text-xs text-slate-400">ml/kg/min</span>
            </div>
            <span className="text-xs mt-2 inline-block font-medium text-indigo-400">
              Good Fitness Zone
            </span>
          </div>
        </div>

        {/* Card 3: Acute Stress */}
        <div className="rounded-xl border border-white/8 bg-slate-900/60 p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-5 w-5 text-orange-400" />
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Detected Stress Events</span>
              <MetricInfo metricKey="acute_stress" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-semibold text-white">{stressCount}</span>
              <span className="text-xs text-slate-400">events / 30d</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              stressCount > 6 ? "text-red-400" : "text-emerald-400"
            }`}>
              {stressCount > 6 ? "High Stress Load" : "Balanced Load"}
            </span>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Summary Scorecards Second Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {dataMode === "live" && isLoadingLiveData ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
        <div className="rounded-xl border border-white/8 bg-slate-900/60 p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <HeartPulse className="h-5 w-5 text-violet-400" />
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">7-day HRV avg</span>
              <MetricInfo metricKey="hrv_rolling" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-semibold text-white">{hrvRolling7}</span>
              <span className="text-xs text-slate-400">ms</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              hrvRolling7 >= 50 ? "text-emerald-400" : "text-amber-400"
            }`}>
              {hrvRolling7 >= 50 ? "Optimal Average" : "Suppressed Average"}
            </span>
          </div>
        </div>

        {/* Card 2: Recovery score */}
        <div className="rounded-xl border border-white/8 bg-slate-900/60 p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <BatteryCharging className="h-5 w-5 text-emerald-400" />
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Recovery score</span>
              <MetricInfo metricKey="recovery_score" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className={`text-3xl font-semibold ${
                recoveryScore >= 70 ? "text-emerald-400" : recoveryScore >= 50 ? "text-amber-400" : "text-red-400"
              }`}>{recoveryScore}</span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              recoveryScore >= 70 ? "text-emerald-400" : recoveryScore >= 50 ? "text-amber-400" : "text-red-400"
            }`}>
              {recoveryScore >= 70 ? "Ready for Action" : recoveryScore >= 50 ? "Moderate Recovery" : "Rest Required"}
            </span>
          </div>
        </div>

        {/* Card 3: Sleep efficiency */}
        <div className="rounded-xl border border-white/8 bg-slate-900/60 p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Moon className="h-5 w-5 text-sky-400" />
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Sleep efficiency</span>
              <MetricInfo metricKey="sleep_efficiency" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-semibold text-white">{sleepEfficiency}</span>
              <span className="text-xs text-slate-400">%</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              sleepEfficiency >= 85 ? "text-emerald-400" : "text-amber-400"
            }`}>
              {sleepEfficiency >= 85 ? "Good Efficiency" : "Restless Sleep"}
            </span>
          </div>
        </div>

        {/* Card 4: Step goal rate */}
        <div className="rounded-xl border border-white/8 bg-slate-900/60 p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Footprints className="h-5 w-5 text-teal-400" />
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Step goal rate</span>
              <MetricInfo metricKey="step_goal_rate" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-semibold text-white">{stepGoalHitRate}%</span>
              <span className="text-xs text-slate-400">days / 30</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              stepGoalHitRate >= 70 ? "text-emerald-400" : "text-amber-400"
            }`}>
              {stepGoalHitRate >= 70 ? "Consistent" : "Needs Focus"}
            </span>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {dataMode === "live" && isLoadingLiveData ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : (
          <>
            <ChartErrorBoundary name="Heart Rate Variability Trend">
              <HRVTrendChart />
            </ChartErrorBoundary>
            <ChartErrorBoundary name="VO2 Max Trend">
              <VO2MaxChart />
            </ChartErrorBoundary>
            <ChartErrorBoundary name="Heart Rate Zones">
              <HRZoneChart />
            </ChartErrorBoundary>
          </>
        )}
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
