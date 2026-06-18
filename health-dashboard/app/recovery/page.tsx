"use client";

import React from "react";
import ANSBalanceChart from "@/components/charts/ANSBalanceChart";
import SkinTempChart from "@/components/charts/SkinTempChart";
import { useChartData } from "@/lib/useChartData";
import ChartErrorBoundary from "@/components/ChartErrorBoundary";
import { MetricInfo } from "@/components/MetricInfo";
import { Activity, ShieldCheck, Thermometer } from "lucide-react";

export default function RecoveryPage() {
  const { ansBalance, skinTemp } = useChartData();

  // Compute brief summary metrics
  const avgLFHF = (ansBalance.reduce((acc: number, curr: any) => acc + curr.lf_hf_ratio, 0) / ansBalance.length) || 0;
  const recentTemp = skinTemp[skinTemp.length - 1]?.value || 0.0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Autonomic Recovery</h1>
          <p className="text-slate-400 text-sm mt-1">
            Autonomic nervous system (ANS) tone, sympathetic ratios, and thermal regulation logs.
          </p>
        </div>
      </div>

      {/* Summary Scorecards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metric 1: Average LF/HF Ratio */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Average LF/HF Ratio</span>
              <MetricInfo metricKey="lf_hf_ratio" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-black font-mono text-white">{avgLFHF.toFixed(2)}</span>
            </div>
            <span className={`text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded ${
              avgLFHF >= 1.0 && avgLFHF <= 2.0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            }`}>
              {avgLFHF >= 1.0 && avgLFHF <= 2.0 ? "Balanced Vagal Tone" : "Sympathetic Dominance"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
            <Activity className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 2: Skin Temp Deviation */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Latest Sleep Temp Deviation</span>
              <MetricInfo metricKey="sleep_temp_deviation" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-black font-mono text-white">
                {recentTemp > 0 ? "+" : ""}
                {recentTemp.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400">°C</span>
            </div>
            <span className={`text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded ${
              Math.abs(recentTemp) < 0.5 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>
              {Math.abs(recentTemp) < 0.5 ? "Stable Baseline" : "Slightly Elevated"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-orange-600/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
            <Thermometer className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Charts Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ChartErrorBoundary name="Autonomic Nervous System Balance">
          <ANSBalanceChart />
        </ChartErrorBoundary>
        <ChartErrorBoundary name="Skin Temperature Deviation">
          <SkinTempChart />
        </ChartErrorBoundary>
      </div>
    </div>
  );
}
