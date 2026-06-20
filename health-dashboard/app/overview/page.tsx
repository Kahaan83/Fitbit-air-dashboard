"use client";

import React, { useState, useMemo } from "react";
import Header from "@/components/Header";
import WhoopRing from "@/components/ui/WhoopRing";
import HealthMonitorCard from "@/components/HealthMonitorCard";
import StressMonitorCard from "@/components/StressMonitorCard";
import HRVTrendChart from "@/components/charts/HRVTrendChart";
import HRZoneChart from "@/components/charts/HRZoneChart";
import SleepDebtChart from "@/components/charts/SleepDebtChart";
import { useChartData } from "@/lib/useChartData";
import { useDashboardStore } from "@/lib/store";
import { useRouter } from "next/navigation";

export default function OverviewPage() {
  const router = useRouter();
  const [dateOffset, setDateOffset] = useState(0);

  const {
    hrv,
    recoveryScore,
    sleepEfficiency,
    spo2Nocturnal,
    skinTemp,
    acuteStress,
  } = useChartData();
  const { liveData, settings } = useDashboardStore();

  const formattedDate = useMemo(() => {
    if (dateOffset === 0) return "Today";
    if (dateOffset === -1) return "Yesterday";
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }, [dateOffset]);

  const handlePrev = () => setDateOffset((prev) => prev - 1);
  const handleNext = () => setDateOffset((prev) => Math.min(0, prev + 1));

  // Compute stats
  const latestHRV = hrv[hrv.length - 1]?.value || 0;
  const stressCount = acuteStress.length;

  // Derive metrics for Health Monitor
  const spo2Dates = Object.keys(spo2Nocturnal).sort((a, b) => a.localeCompare(b));
  const latestSpO2Date = spo2Dates[spo2Dates.length - 1];
  const latestSpO2Readings = latestSpO2Date ? spo2Nocturnal[latestSpO2Date] || [] : [];
  const latestSpO2 = latestSpO2Readings.length > 0
    ? (latestSpO2Readings[latestSpO2Readings.length - 1]?.value || 97.4)
    : 97.4;
  const latestTemp = skinTemp.length > 0 ? (skinTemp[skinTemp.length - 1]?.value || 0) : 0.12;
  const rhrArray = liveData?.daily_resting_hr || [];
  const latestRHR = rhrArray.length > 0 ? (rhrArray[rhrArray.length - 1]?.value || settings.restingHR) : settings.restingHR;

  const totalMetrics = 4;
  let metricsInRange = 0;
  if (latestHRV >= 50) metricsInRange++;
  if (latestSpO2 >= 95) metricsInRange++;
  if (latestRHR <= 75) metricsInRange++;
  if (Math.abs(latestTemp) <= 0.4) metricsInRange++;

  // Derive metrics for Stress Monitor
  const stressScore = Math.min(3.0, Math.max(0.1, (stressCount * 0.3)));
  const stressLabel = stressScore > 2.0 ? "HIGH" : stressScore > 1.0 ? "MEDIUM" : "LOW";
  let stressPeak = "4:15 PM";
  if (acuteStress.length > 0) {
    const lastEvent = acuteStress[acuteStress.length - 1];
    if (lastEvent?.start) {
      try {
        const dateObj = new Date(lastEvent.start);
        stressPeak = dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      } catch (e) {}
    }
  }

  return (
    <div style={{ background: "#000", minHeight: "100vh" }}>
      <Header date={formattedDate} onPrev={handlePrev} onNext={handleNext} />

      {/* Main grid — 2 columns */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: 20,
        padding: "24px 32px",
      }}>

        {/* LEFT: charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <HRVTrendChart />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <HRZoneChart />
            <SleepDebtChart />
          </div>
        </div>

        {/* RIGHT: scores + monitor cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Three rings stacked */}
          <div style={{
            background: "#111",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "24px 20px",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
          }}>
            <WhoopRing
              value={sleepEfficiency || 93}
              label="SLEEP"
              unit="%"
              color="#3B7FD4"
              size={100}
              onClick={() => router.push("/sleep")}
            />
            <WhoopRing
              value={recoveryScore || 76}
              label="RECOVERY"
              unit="%"
              color="#00FF87"
              size={120}
              onClick={() => router.push("/recovery")}
            />
            <WhoopRing
              value={14.2}
              label="STRAIN"
              unit=""
              color="#3B7FD4"
              size={100}
              max={21}
            />
          </div>

          <HealthMonitorCard
            metricsInRange={metricsInRange}
            totalMetrics={totalMetrics}
            onClick={() => router.push("/health-monitor")}
          />
          <StressMonitorCard
            score={stressScore}
            label={stressLabel}
            peakTime={stressPeak}
            onClick={() => router.push("/stress")}
          />
        </div>
      </div>
    </div>
  );
}
