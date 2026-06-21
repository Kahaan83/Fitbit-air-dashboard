"use client";

import React, { useState, useMemo } from "react";
import Header from "@/components/Header";
import WhoopRing from "@/components/ui/WhoopRing";
import HRVTrendChart from "@/components/charts/HRVTrendChart";
import HRZoneChart from "@/components/charts/HRZoneChart";
import SleepDebtChart from "@/components/charts/SleepDebtChart";
import SkeletonCard from "@/components/ui/SkeletonCard";
import { useChartData } from "@/lib/useChartData";
import { useDashboardStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { computeStrainFromZones } from "@/lib/transforms";
import { mockStressEvents } from "@/lib/mockData";

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
  const { liveData, settings, dataMode, isLoadingLiveData } = useDashboardStore();

  const strainScore = useMemo(() => {
    if (dataMode === "sample") return 14.2;
    const zones = liveData?.heart_rate ?? [];
    if (!zones.length) return 0;
    const maxHR = settings.maxHR || 185;
    return computeStrainFromZones(zones, maxHR);
  }, [liveData, dataMode, settings.maxHR]);

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

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
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
          {isLoadingLiveData
            ? <SkeletonCard height={300} />
            : <HRVTrendChart />
          }

          {isLoadingLiveData
            ? <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                <SkeletonCard height={260} />
                <SkeletonCard height={260} />
              </div>
            : <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                <HRZoneChart />
                <SleepDebtChart />
              </div>
          }
        </div>

        {/* RIGHT: scores + monitor metrics in a single unified card */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            background: "var(--bg-card)",
            border: "0.5px solid var(--border-subtle)",
            borderRadius: 16,
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}>
            {/* Three rings */}
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
              <WhoopRing
                value={sleepEfficiency || 93}
                label="SLEEP"
                unit="%"
                color="var(--chart-sleep)"
                size={100}
                onClick={() => router.push("/sleep")}
              />
              <WhoopRing
                value={recoveryScore || 76}
                label="RECOVERY"
                unit="%"
                color="var(--chart-hrv)"
                size={120}
                onClick={() => router.push("/recovery")}
              />
              <WhoopRing
                value={strainScore}
                label="STRAIN"
                unit=""
                color="var(--chart-hr)"
                size={100}
                max={21}
              />
            </div>

            {/* Divider */}
            <div style={{ height: "0.5px", background: "var(--border-subtle)" }} />

            {/* Health Monitor row */}
            <div 
              onClick={() => router.push("/health-monitor")}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              className="hover:opacity-80 transition-opacity"
            >
              <span style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: "0.08em" }}>HEALTH MONITOR</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--accent-primary)", fontWeight: 500 }}>
                  {metricsInRange === totalMetrics ? "WITHIN RANGE" : "OUT OF RANGE"}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{metricsInRange}/{totalMetrics}</span>
              </div>
            </div>

            {/* Stress Monitor row */}
            <div 
              onClick={() => router.push("/stress")}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              className="hover:opacity-80 transition-opacity"
            >
              <span style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: "0.08em" }}>STRESS MONITOR</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: stressLabel === "LOW" ? "var(--accent-primary)" : stressLabel === "MEDIUM" ? "var(--accent-amber)" : "var(--accent-red)"
                }}>{stressScore.toFixed(1)}</span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{peakStressEvent.time}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
