"use client";

import React from "react";
import NocturnalSpO2Chart from "@/components/charts/NocturnalSpO2Chart";
import SleepDebtChart from "@/components/charts/SleepDebtChart";
import { useChartData } from "@/lib/useChartData";
import ChartErrorBoundary from "@/components/ChartErrorBoundary";
import { MetricInfo } from "@/components/MetricInfo";
import { Moon, ShieldAlert, Award, Activity } from "lucide-react";
import DataStreamsStrip from "@/components/DataStreamsStrip";
import { SkeletonCard, SkeletonChart } from "@/components/Skeleton";
import { useDashboardStore } from "@/lib/store";

export default function SleepPage() {
  const { sleepDebt, spo2Nocturnal, remPct, goodSleepStreak, avgDeepSleep } = useChartData();
  const { dataMode, isLoadingLiveData } = useDashboardStore();

  // Compute sleep summary metrics
  const avgSlept = (sleepDebt.reduce((acc: number, curr: any) => acc + curr.actual_hours, 0) / sleepDebt.length) || 0;
  const avgDebt = (sleepDebt.reduce((acc: number, curr: any) => acc + curr.debt_hours, 0) / sleepDebt.length) || 0;

  // Compute hypoxemia events count (nights with any reading below 90%)
  const nightsCount = Object.keys(spo2Nocturnal).length;
  const dipNightsCount = Object.values(spo2Nocturnal).filter((readings) =>
    readings.some((r) => r.value < 90)
  ).length;

  return (
    <div className="space-y-8 animate-fadeIn p-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-normal text-[var(--text-primary)]">Sleep & Oxygen Saturation</h1>
        <p className="text-[var(--text-secondary)] text-[13px] mt-1">Sleep quality and oxygen saturation</p>
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
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Moon className="h-5 w-5 text-[var(--chart-sleep)]" />
              <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Average Sleep Duration</span>
              <MetricInfo metricKey="sleep_duration" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-semibold text-[var(--text-primary)]">{avgSlept.toFixed(1)}</span>
              <span className="text-xs text-[var(--text-secondary)]">hours</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              avgSlept >= 7.0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"
            }`}>
              {avgSlept >= 7.0 ? "Healthy Sleep Quantity" : "Insufficient Sleep"}
            </span>
          </div>
        </div>

        {/* Metric 2: Average Sleep Debt */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Award className="h-5 w-5 text-[var(--accent-primary)]" />
              <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Average Sleep Debt</span>
              <MetricInfo metricKey="sleep_debt" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className={`text-3xl font-semibold ${avgDebt > 0 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}`}>
                {avgDebt > 0 ? "+" : ""}
                {avgDebt.toFixed(1)}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">hours</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              avgDebt <= 0.5 ? "text-[var(--accent-green)]" : "text-[var(--accent-amber)]"
            }`}>
              {avgDebt <= 0.5 ? "Optimal Balance" : "High Debt Accumulating"}
            </span>
          </div>
        </div>

        {/* Metric 3: Nocturnal Hypoxemic Episodes */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="h-5 w-5 text-[var(--accent-red)]" />
              <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Hypoxemia Nights</span>
              <MetricInfo metricKey="hypoxemia" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-semibold text-[var(--text-primary)]">{dipNightsCount}</span>
              <span className="text-xs text-[var(--text-secondary)]">/ {nightsCount} nights</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              dipNightsCount > 0 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"
            }`}>
              {dipNightsCount > 0 ? "Oxygen Desaturation Detected" : "Optimal Blood Saturation"}
            </span>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Summary Scorecards Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dataMode === "live" && isLoadingLiveData ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Moon className="h-5 w-5 text-[var(--chart-sleep)]" />
              <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">REM %</span>
              <MetricInfo metricKey="rem_pct" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-semibold text-[var(--text-primary)]">{remPct}%</span>
              <span className="text-xs text-[var(--text-secondary)]">of sleep</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              remPct >= 18 && remPct <= 27 ? "text-[var(--accent-green)]" : "text-[var(--accent-amber)]"
            }`}>
              {remPct >= 18 && remPct <= 27 ? "Good REM Ratio" : "Suboptimal REM"}
            </span>
          </div>
        </div>

        {/* Card 2: Good sleep streak */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Award className="h-5 w-5 text-[var(--accent-primary)]" />
              <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Good sleep streak</span>
              <MetricInfo metricKey="good_sleep_streak" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className={`text-3xl font-semibold ${
                goodSleepStreak >= 5 ? "text-[var(--accent-green)]" : goodSleepStreak >= 2 ? "text-[var(--accent-amber)]" : "text-[var(--accent-red)]"
              }`}>{goodSleepStreak}</span>
              <span className="text-xs text-[var(--text-secondary)]">nights</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              goodSleepStreak >= 5 ? "text-[var(--accent-green)]" : goodSleepStreak >= 2 ? "text-[var(--accent-amber)]" : "text-[var(--accent-red)]"
            }`}>
              {goodSleepStreak >= 5 ? "Consistent Rest" : goodSleepStreak >= 2 ? "Moderate Routine" : "Rest Deficit"}
            </span>
          </div>
        </div>

        {/* Card 3: Avg deep sleep */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Activity className="h-5 w-5 text-[var(--chart-sleep)]" />
              <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Avg deep sleep</span>
              <MetricInfo metricKey="avg_deep_sleep" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className={`text-3xl font-semibold ${
                avgDeepSleep >= 60 ? "text-[var(--accent-green)]" : avgDeepSleep >= 40 ? "text-[var(--accent-amber)]" : "text-[var(--accent-red)]"
              }`}>{avgDeepSleep}</span>
              <span className="text-xs text-[var(--text-secondary)]">min/night</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              avgDeepSleep >= 60 ? "text-[var(--accent-green)]" : avgDeepSleep >= 40 ? "text-[var(--accent-amber)]" : "text-[var(--accent-red)]"
            }`}>
              {avgDeepSleep >= 60 ? "Optimal Deep Sleep" : avgDeepSleep >= 40 ? "Average Recovery" : "Needs Deeper Sleep"}
            </span>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Sleep Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {dataMode === "live" && isLoadingLiveData ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : (
          <>
            <ChartErrorBoundary name="Nocturnal SpO2 Levels">
              <NocturnalSpO2Chart />
            </ChartErrorBoundary>
            <ChartErrorBoundary name="Sleep Debt Accumulation">
              <SleepDebtChart />
            </ChartErrorBoundary>
          </>
        )}
      </div>
    </div>
  );
}
