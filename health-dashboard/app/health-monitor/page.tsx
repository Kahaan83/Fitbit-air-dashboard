"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { useChartData } from "@/lib/useChartData";
import { useDashboardStore } from "@/lib/store";

export default function HealthMonitorPage() {
  const { hrv, spo2Nocturnal, skinTemp } = useChartData();
  const { liveData, settings } = useDashboardStore();

  const latestHRV = hrv[hrv.length - 1]?.value || 0;
  
  const spo2Dates = Object.keys(spo2Nocturnal).sort((a, b) => a.localeCompare(b));
  const latestSpO2Date = spo2Dates[spo2Dates.length - 1];
  const latestSpO2Readings = latestSpO2Date ? spo2Nocturnal[latestSpO2Date] || [] : [];
  const latestSpO2 = latestSpO2Readings.length > 0
    ? (latestSpO2Readings[latestSpO2Readings.length - 1]?.value || 97.4)
    : 97.4;

  const latestTemp = skinTemp.length > 0 ? (skinTemp[skinTemp.length - 1]?.value || 0) : 0.12;
  const rhrArray = liveData?.daily_resting_hr || [];
  const latestRHR = rhrArray.length > 0 ? (rhrArray[rhrArray.length - 1]?.value || settings.restingHR) : settings.restingHR;

  const metrics = [
    {
      name: "Heart Rate Variability",
      value: `${latestHRV} ms`,
      status: latestHRV >= 50 ? "Within Range" : "Below Baseline",
      inRange: latestHRV >= 50,
      baseline: ">= 50 ms",
    },
    {
      name: "Blood Oxygen (SpO2)",
      value: `${latestSpO2.toFixed(1)}%`,
      status: latestSpO2 >= 95 ? "Within Range" : "Below Baseline",
      inRange: latestSpO2 >= 95,
      baseline: ">= 95.0%",
    },
    {
      name: "Resting Heart Rate",
      value: `${latestRHR} bpm`,
      status: latestRHR <= 75 ? "Within Range" : "Elevated",
      inRange: latestRHR <= 75,
      baseline: `<= 75 bpm`,
    },
    {
      name: "Skin Temperature",
      value: `${latestTemp >= 0 ? "+" : ""}${latestTemp.toFixed(2)}°C`,
      status: Math.abs(latestTemp) <= 0.4 ? "Within Range" : "Elevated Deviation",
      inRange: Math.abs(latestTemp) <= 0.4,
      baseline: `±0.40°C`,
    },
  ];

  const allInRange = metrics.every((m) => m.inRange);

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
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Health Monitor</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Detailed metrics comparison against your physiological baselines.
        </p>
      </div>

      {/* Main card */}
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[#1C1C1C] p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <span className="text-sm font-semibold tracking-wide text-[#888888]">
            SYSTEM STATUS
          </span>
          <span
            className="text-sm font-bold tracking-wider"
            style={{ color: allInRange ? "#00FF87" : "#FF3B5C" }}
          >
            {allInRange ? "ALL SYSTEMS OPTIMAL" : "ATTENTION REQUIRED"}
          </span>
        </div>

        {/* Metrics List */}
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div
              key={metric.name}
              className="flex items-center justify-between p-4 rounded-xl bg-[#111111] border border-[var(--border-subtle)]"
            >
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {metric.name}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Baseline Target: {metric.baseline}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-sm font-bold text-[var(--text-primary)] block">
                    {metric.value}
                  </span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: metric.inRange ? "#00FF87" : "#FF3B5C" }}
                  >
                    {metric.status}
                  </span>
                </div>

                <div
                  className="rounded-[6px] p-1 flex items-center justify-center"
                  style={{
                    backgroundColor: metric.inRange ? "rgba(26, 61, 43, 0.6)" : "rgba(255, 59, 92, 0.1)",
                  }}
                >
                  {metric.inRange ? (
                    <Check className="h-4 w-4 text-[#00FF87]" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-[#FF3B5C]" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
