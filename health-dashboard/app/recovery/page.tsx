"use client";

import React from "react";
import ANSBalanceChart from "@/components/charts/ANSBalanceChart";
import SkinTempChart from "@/components/charts/SkinTempChart";
import { useChartData } from "@/lib/useChartData";
import ChartErrorBoundary from "@/components/ChartErrorBoundary";
import { MetricInfo } from "@/components/MetricInfo";
import { Activity, ShieldCheck, Thermometer } from "lucide-react";
import DataStreamsStrip from "@/components/DataStreamsStrip";
import { SkeletonCard, SkeletonChart } from "@/components/Skeleton";
import { useDashboardStore } from "@/lib/store";

export default function RecoveryPage() {
  const { ansBalance, skinTemp } = useChartData();
  const { dataMode, isLoadingLiveData } = useDashboardStore();

  // Compute brief summary metrics
  const avgLFHF = (ansBalance.reduce((acc: number, curr: any) => acc + curr.lf_hf_ratio, 0) / ansBalance.length) || 0;
  const recentTemp = skinTemp[skinTemp.length - 1]?.value || 0.0;

  return (
    <div className="space-y-8 animate-fadeIn p-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-normal text-[var(--text-primary)]">Autonomic Recovery</h1>
        <p className="text-[var(--text-secondary)] text-[13px] mt-1">Autonomic tone and thermal recovery</p>
      </div>

      {/* Data Streams Strip */}
      <DataStreamsStrip />

      {/* Summary Scorecards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dataMode === "live" && isLoadingLiveData ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Activity className="h-5 w-5 text-[var(--accent-primary)]" />
              <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Average LF/HF Ratio</span>
              <MetricInfo metricKey="lf_hf_ratio" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-semibold text-[var(--text-primary)]">{avgLFHF.toFixed(2)}</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              avgLFHF >= 1.0 && avgLFHF <= 2.0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"
            }`}>
              {avgLFHF >= 1.0 && avgLFHF <= 2.0 ? "Balanced Vagal Tone" : "Sympathetic Dominance"}
            </span>
          </div>
        </div>

        {/* Metric 2: Skin Temp Deviation */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Thermometer className="h-5 w-5 text-[var(--accent-amber)]" />
              <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Latest Sleep Temp Deviation</span>
              <MetricInfo metricKey="sleep_temp_deviation" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-semibold text-[var(--text-primary)]">
                {recentTemp > 0 ? "+" : ""}
                {recentTemp.toFixed(2)}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">°C</span>
            </div>
            <span className={`text-xs mt-2 inline-block font-medium ${
              Math.abs(recentTemp) < 0.5 ? "text-[var(--accent-green)]" : "text-[var(--accent-amber)]"
            }`}>
              {Math.abs(recentTemp) < 0.5 ? "Stable Baseline" : "Slightly Elevated"}
            </span>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Charts Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {dataMode === "live" && isLoadingLiveData ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : (
          <>
            <ChartErrorBoundary name="Autonomic Nervous System Balance">
              <ANSBalanceChart />
            </ChartErrorBoundary>
            <ChartErrorBoundary name="Skin Temperature Deviation">
              <SkinTempChart />
            </ChartErrorBoundary>
          </>
        )}
      </div>
    </div>
  );
}
