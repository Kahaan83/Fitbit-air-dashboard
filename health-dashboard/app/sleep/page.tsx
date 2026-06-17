"use client";

import React from "react";
import NocturnalSpO2Chart from "@/components/charts/NocturnalSpO2Chart";
import SleepDebtChart from "@/components/charts/SleepDebtChart";
import { useChartData } from "@/lib/useChartData";
import { Moon, ShieldAlert, Award } from "lucide-react";

export default function SleepPage() {
  const { sleepDebt, spo2Nocturnal } = useChartData();

  // Compute sleep summary metrics
  const avgSlept = (sleepDebt.reduce((acc: number, curr: any) => acc + curr.actual_hours, 0) / sleepDebt.length) || 0;
  const avgDebt = (sleepDebt.reduce((acc: number, curr: any) => acc + curr.debt_hours, 0) / sleepDebt.length) || 0;

  // Compute hypoxemia events count (nights with any reading below 90%)
  const nightsCount = Object.keys(spo2Nocturnal).length;
  const dipNightsCount = Object.values(spo2Nocturnal).filter((readings) =>
    readings.some((r) => r.value < 90)
  ).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Sleep & Oxygen Saturation</h1>
          <p className="text-slate-400 text-sm mt-1">
            Nocturnal blood oxygen tracking, sleep durations, and target deficits.
          </p>
        </div>
      </div>

      {/* Summary Scorecards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1: Average Sleep Duration */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Average Sleep Duration</span>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-black font-mono text-white">{avgSlept.toFixed(1)}</span>
              <span className="text-xs text-slate-400">hours</span>
            </div>
            <span className={`text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded ${
              avgSlept >= 7.0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            }`}>
              {avgSlept >= 7.0 ? "Healthy Sleep Quantity" : "Insufficient Sleep"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-violet-600/10 flex items-center justify-center border border-violet-500/20 text-violet-400">
            <Moon className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 2: Average Sleep Debt */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Average Sleep Debt</span>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className={`text-3xl font-black font-mono ${avgDebt > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {avgDebt > 0 ? "+" : ""}
                {avgDebt.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">hours</span>
            </div>
            <span className={`text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded ${
              avgDebt <= 0.5 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>
              {avgDebt <= 0.5 ? "Optimal Balance" : "High Debt Accumulating"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
            <Award className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 3: Nocturnal Hypoxemic Episodes */}
        <div className="glow-card rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Hypoxemia Nights</span>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-black font-mono text-white">{dipNightsCount}</span>
              <span className="text-xs text-slate-400">/ {nightsCount} nights</span>
            </div>
            <span className={`text-[10px] mt-2 inline-block font-semibold px-2 py-0.5 rounded ${
              dipNightsCount > 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
            }`}>
              {dipNightsCount > 0 ? "Oxygen Desaturation Detected" : "Optimal Blood Saturation"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-red-600/10 flex items-center justify-center border border-red-500/20 text-red-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Sleep Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <NocturnalSpO2Chart />
        <SleepDebtChart />
      </div>
    </div>
  );
}
