"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useDashboardStore } from "@/lib/store";
import {
  mockHRV,
  mockSpO2Nocturnal,
  mockSleepData,
  mockHeartRateZones,
  mockStressEvents,
  mockStepsData,
  mockSkinTemp,
  mockSleepDebt,
} from "@/lib/mockData";
import { MetricInfo } from "@/components/MetricInfo";
import DataStreamsStrip from "@/components/DataStreamsStrip";
import JSZip from "jszip";
import {
  Heart,
  Activity,
  Zap,
  Thermometer,
  BarChart2,
  TrendingDown,
  RefreshCw,
  Database,
  Moon,
  ChevronDown,
  Download,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit: string;
  sub?: string;
  trend?: "up" | "down" | "stable";
  color: string;        // tailwind color name e.g. "rose"
  sparkPoints?: number[]; // normalized 0-1 for the mini sparkline
  latestTime?: string;
  metricKey?: string;   // key into METRIC_INFO for the info tooltip
}

// ── Mini sparkline SVG ─────────────────────────────────────────────────────────
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const W = 120;
  const H = 36;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - ((p - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  });

  const colorMap: Record<string, string> = {
    rose: "var(--chart-hr)",
    violet: "var(--chart-hrv)",
    sky: "var(--chart-sleep)",
    amber: "var(--chart-stress)",
    emerald: "var(--accent-green)",
    indigo: "var(--accent-primary)",
  };
  const stroke = colorMap[color] ?? "var(--accent-primary)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="opacity-70">
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Single metric card ─────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, unit, sub, color, sparkPoints, latestTime, metricKey }: MetricCardProps) {
  const borderMap: Record<string, string> = {
    rose:    "border-[var(--chart-hr)]/20 bg-[var(--chart-hr)]/5",
    violet:  "border-[var(--chart-hrv)]/20 bg-[var(--chart-hrv)]/5",
    sky:     "border-[var(--chart-sleep)]/20 bg-[var(--chart-sleep)]/5",
    amber:   "border-[var(--chart-stress)]/20 bg-[var(--chart-stress)]/5",
    emerald: "border-[var(--accent-green)]/20 bg-[var(--accent-green)]/5",
    indigo:  "border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5",
  };
  const iconMap: Record<string, string> = {
    rose:    "bg-[var(--chart-hr)]/10 text-[var(--chart-hr)] border-[var(--chart-hr)]/20",
    violet:  "bg-[var(--chart-hrv)]/10 text-[var(--chart-hrv)] border-[var(--chart-hrv)]/20",
    sky:     "bg-[var(--chart-sleep)]/10 text-[var(--chart-sleep)] border-[var(--chart-sleep)]/20",
    amber:   "bg-[var(--chart-stress)]/10 text-[var(--chart-stress)] border-[var(--chart-stress)]/20",
    emerald: "bg-[var(--accent-green)]/10 text-[var(--accent-green)] border-[var(--accent-green)]/20",
    indigo:  "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/20",
  };
  const valueMap: Record<string, string> = {
    rose:    "text-[var(--chart-hr)]",
    violet:  "text-[var(--chart-hrv)]",
    sky:     "text-[var(--chart-sleep)]",
    amber:   "text-[var(--chart-stress)]",
    emerald: "text-[var(--accent-green)]",
    indigo:  "text-[var(--accent-primary)]",
  };

  return (
    <div
      className={`rounded-2xl border backdrop-blur-sm shadow-xl p-5 flex flex-col gap-3 ${borderMap[color] ?? ""} bg-[var(--bg-card)]/50`}
    >
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${iconMap[color] ?? ""}`}>
          {icon}
        </div>
        {sparkPoints && sparkPoints.length >= 2 && (
          <Sparkline points={sparkPoints} color={color} />
        )}
      </div>

      {/* Value */}
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">{label}</span>
          {metricKey && <MetricInfo metricKey={metricKey} size="sm" />}
        </div>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className={`text-4xl font-black font-mono tabular-nums ${valueMap[color] ?? "text-[var(--text-primary)]"}`}>
            {value}
          </span>
          <span className="text-sm text-[var(--text-secondary)] font-medium">{unit}</span>
        </div>
        {sub && <p className="text-xs text-[var(--text-secondary)] mt-1">{sub}</p>}
      </div>

      {/* Bottom: last reading time */}
      {latestTime && (
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] border-t border-[var(--border-subtle)] pt-2">
          <RefreshCw className="h-3 w-3" />
          <span>Latest: {latestTime}</span>
        </div>
      )}
    </div>
  );
}

// ── Raw data table ─────────────────────────────────────────────────────────────
function RawTable({ title, rows, columns }: {
  title: string;
  rows: Record<string, any>[];
  columns: { key: string; label: string; format?: (v: any) => string }[];
}) {
  if (!rows.length) return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/40 p-6 text-center text-[var(--text-secondary)] text-sm">
      No data available for <span className="font-semibold text-[var(--text-secondary)]">{title}</span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)]/40 backdrop-blur-sm overflow-hidden shadow-xl">
      <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
        <Database className="h-4 w-4 text-[var(--accent-primary)]" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        <span className="ml-auto text-xs text-[var(--text-secondary)] font-mono">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              {columns.map((c) => (
                <th key={c.label} className="px-4 py-2.5 text-left text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(-50).reverse().map((row, i) => (
              <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]/30 transition-colors">
                {columns.map((c) => (
                  <td key={c.label} className="px-4 py-2 font-mono text-[var(--text-secondary)]">
                    {c.format ? c.format(row[c.key]) : String(row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function RawMetricsPage() {
  const {
    dataMode,
    liveData,
    lastSync,
    settings,
    syncStartDate,
    syncEndDate,
    addToast,
  } = useDashboardStore();

  const [isExportOpen, setIsExportOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const isLive = dataMode === "live" && liveData != null;

  const getExportDaysText = () => {
    if (syncStartDate && syncEndDate) {
      const start = new Date(syncStartDate);
      const end = new Date(syncEndDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} days`;
    }
    return "30 days";
  };

  const handleExportJSON = () => {
    if (!isLive || !liveData) return;
    setIsExportOpen(false);

    try {
      const json = JSON.stringify(liveData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `fitbit-air-export-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const daysText = getExportDaysText();
      addToast(`Exported ${daysText} of data`, "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to generate JSON export.", "error");
    }
  };

  const convertToCSV = (headers: string[], rows: string[][]) => {
    const headerRow = headers.join(",");
    const dataRows = rows.map((row) => row.join(","));
    return [headerRow, ...dataRows].join("\n");
  };

  const handleExportCSV = async () => {
    if (!isLive || !liveData) return;
    setIsExportOpen(false);

    try {
      const zip = new JSZip();

      // 1. heart_rate.csv: datetime,bpm,zone
      const heartRateRows = (liveData.heart_rate || []).map((item: any) => {
        const bpm = Math.round(item.value || 0);
        const maxHR = settings.maxHR || 185;
        const pct = (bpm / maxHR) * 100;
        let zone = "Zone 1";
        if (pct > 85) zone = "Zone 5";
        else if (pct > 70) zone = "Zone 4";
        else if (pct > 60) zone = "Zone 3";
        else if (pct > 50) zone = "Zone 2";
        return [
          item.timestamp || "",
          bpm.toString(),
          zone,
        ];
      });
      const heartRateCSV = convertToCSV(["datetime", "bpm", "zone"], heartRateRows);

      // 2. hrv.csv: date,rmssd
      const hrvRows = (liveData.hrv || []).map((item: any) => {
        const date = (item.timestamp || "").split("T")[0];
        const rmssd = item.value || 0;
        return [
          date,
          rmssd.toString(),
        ];
      });
      const hrvCSV = convertToCSV(["date", "rmssd"], hrvRows);

      // 3. sleep.csv: date,duration_minutes,efficiency,stages
      const sleepRows = (liveData.sleep || []).map((item: any) => {
        const date = (item.timestamp || "").split("T")[0];
        const duration = item.value?.total_sleep_minutes || 0;
        const efficiency = duration > 0 ? Math.round((duration / (duration + 30)) * 100 * 10) / 10 : 0;
        const stages = item.value?.stages || {};
        const stagesStr = `"${JSON.stringify(stages).replace(/"/g, '""')}"`;
        return [
          date,
          duration.toString(),
          efficiency.toString(),
          stagesStr,
        ];
      });
      const sleepCSV = convertToCSV(["date", "duration_minutes", "efficiency", "stages"], sleepRows);

      // 4. spo2.csv: datetime,value
      const spo2Rows = (liveData.spo2 || []).map((item: any) => {
        return [
          item.timestamp || "",
          (item.value || 0).toString(),
        ];
      });
      const spo2CSV = convertToCSV(["datetime", "value"], spo2Rows);

      // 5. stress.csv: start,end,score
      const stressRows = (liveData.derived?.acute_stress || []).map((item: any) => {
        const severity = item.severity || "low";
        const score = severity === "high" ? 3 : severity === "medium" ? 2 : 1;
        return [
          item.start || "",
          item.end || "",
          score.toString(),
        ];
      });
      const stressCSV = convertToCSV(["start", "end", "score"], stressRows);

      zip.file("heart_rate.csv", heartRateCSV);
      zip.file("hrv.csv", hrvCSV);
      zip.file("sleep.csv", sleepCSV);
      zip.file("spo2.csv", spo2CSV);
      zip.file("stress.csv", stressCSV);

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `fitbit-air-export-${dateStr}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      const daysText = getExportDaysText();
      addToast(`Exported ${daysText} of data`, "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to generate CSV ZIP export.", "error");
    }
  };

  // ── Derive numeric values from live or mock data ─────────────────────────────
  const avgZone1HR = useMemo(() => {
    const zone1 = mockHeartRateZones.filter((d) => d.zone === "Zone 1");
    return zone1.length
      ? Math.round(zone1.reduce((sum, d) => sum + d.value, 0) / zone1.length)
      : 58;
  }, []);

  const mockRestingHRArr = useMemo(() => {
    return mockHRV.map((d, idx) => {
      const variation = Math.round(Math.sin(idx * 0.7) * 2);
      const value = idx === mockHRV.length - 1 ? avgZone1HR : avgZone1HR + variation;
      return {
        timestamp: d.date,
        value,
        data_type: "resting_hr",
      };
    });
  }, [avgZone1HR]);

  const mockSpo2Arr = useMemo(() => {
    return mockHRV.map(d => d.date).flatMap((date) => {
      const readings = mockSpO2Nocturnal[date] || [];
      return readings.map((r) => ({
        timestamp: `${date}T${r.time === "Daily Avg" ? "12:00" : r.time}:00Z`,
        value: r.value,
        data_type: "spo2",
      }));
    });
  }, []);

  const mockDailySpo2Arr = useMemo(() => {
    return mockHRV.map(d => d.date).map((date) => {
      const readings = mockSpO2Nocturnal[date] || [];
      const avg = readings.reduce((sum, r) => sum + r.value, 0) / (readings.length || 1);
      return {
        timestamp: date,
        value: Math.round(avg * 10) / 10,
        data_type: "daily_spo2",
      };
    });
  }, []);

  const heartRateArr: any[] = isLive ? (liveData.heart_rate || []) : mockHeartRateZones;
  const hrvArr: any[] = isLive ? (liveData.hrv || []) : mockHRV.map((d) => ({ timestamp: d.date, value: d.value, data_type: "hrv" }));
  const spo2Arr: any[] = isLive ? (liveData.spo2 || liveData.daily_spo2 || []) : mockSpo2Arr;
  const dailySpo2Arr: any[] = isLive ? (liveData.daily_spo2 || []) : mockDailySpo2Arr;
  const restingHRArr: any[] = isLive ? (liveData.daily_resting_hr || []) : mockRestingHRArr;
  const sleepTempArr: any[] = isLive ? (liveData.sleep_temp || []) : mockSkinTemp.map((d) => ({ timestamp: d.date, value: d.value, data_type: "sleep_temp" }));
  const stepsArr: any[] = isLive ? (liveData.steps || []) : mockStepsData;
  const sleepArr: any[] = isLive ? (liveData.sleep || []) : mockSleepData;

  // Mock fallback scalars
  const mockLatestHRV = mockHRV[mockHRV.length - 1]?.value ?? 51;
  const mockLatestTemp = mockSkinTemp[mockSkinTemp.length - 1]?.value ?? 0.12;
  const mockLatestSleep = mockSleepDebt[mockSleepDebt.length - 1]?.actual_hours ?? 7.4;

  const latestHR = heartRateArr.length
    ? Math.round(heartRateArr[heartRateArr.length - 1].value)
    : 72;

  const latestHRV = hrvArr.length
    ? Math.round(hrvArr[hrvArr.length - 1].value)
    : Math.round(mockLatestHRV);

  const latestSpo2 = spo2Arr.length
    ? spo2Arr[spo2Arr.length - 1].value.toFixed(1)
    : "97.4";

  const latestRestingHR = restingHRArr.length
    ? Math.round(restingHRArr[restingHRArr.length - 1].value)
    : avgZone1HR;

  const rawTemp = sleepTempArr.length
    ? sleepTempArr[sleepTempArr.length - 1].value
    : mockLatestTemp;
  // Sanity check: if value > 10, API is returning absolute temperature, not deviation
  const tempIsAbsolute = isLive && Math.abs(rawTemp) > 10;
  const latestTemp = tempIsAbsolute ? rawTemp : rawTemp;

  const todaySteps = useMemo(() => {
    if (!stepsArr.length) return 6820;
    const todayStr = isLive ? new Date().toLocaleDateString("en-CA") : "2025-06-15";
    return stepsArr
      .filter((s) => s.date === todayStr || (s.timestamp || "").startsWith(todayStr))
      .reduce((acc, s) => acc + (s.value || 0), 0);
  }, [stepsArr, isLive]);

  const latestSleepHours = sleepArr.length
    ? (sleepArr[sleepArr.length - 1].value?.total_sleep_minutes ?? 0) / 60
    : mockLatestSleep;

  // Sparkline data
  const hrSparkPoints = heartRateArr.slice(-40).map((d) => d.value);
  const hrvSparkPoints = hrvArr.slice(-30).map((d) => d.value);
  const spo2SparkPoints = spo2Arr.slice(-30).map((d) => d.value);
  const tempSparkPoints = sleepTempArr.slice(-20).map((d) => d.value);

  // Latest times
  const fmt = (ts?: string) => {
    if (!ts) return undefined;
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const lastHRTime = heartRateArr.length ? fmt(heartRateArr[heartRateArr.length - 1].timestamp) : undefined;
  const lastHRVTime = hrvArr.length ? fmt(hrvArr[hrvArr.length - 1].timestamp) : undefined;
  const lastSpo2Time = spo2Arr.length ? fmt(spo2Arr[spo2Arr.length - 1].timestamp) : undefined;
  const lastTempTime = sleepTempArr.length ? fmt(sleepTempArr[sleepTempArr.length - 1].timestamp) : undefined;
  const lastStepsTime = stepsArr.length ? fmt(stepsArr[stepsArr.length - 1].timestamp) : undefined;

  return (
    <div className="space-y-8 animate-fadeIn p-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-normal text-[var(--text-primary)]">Raw Metrics</h1>
          <p className="text-[var(--text-secondary)] text-[13px] mt-1">All data streams from Google Health API</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* Export Dropdown Button */}
          <div ref={dropdownRef} className="relative inline-block text-left">
            <div title={!isLive ? "Switch to live data to export." : undefined}>
              <button
                type="button"
                onClick={() => setIsExportOpen(!isExportOpen)}
                disabled={!isLive}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold tracking-wide transition-all uppercase shadow-md select-none focus:outline-none cursor-pointer ${
                  isLive
                    ? "border-[var(--accent-primary)]/45 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 shadow-[0_0_8px_-2px_rgba(124,109,250,0.2)]"
                    : "border-[var(--border-medium)] bg-[var(--bg-surface)] text-[var(--text-secondary)] cursor-not-allowed opacity-50"
                }`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${isExportOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {isExportOpen && isLive && (
              <div className="absolute right-0 mt-2 w-36 origin-top-right rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] shadow-2xl z-30 py-1 animate-fadeIn">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex w-full items-center px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors text-left cursor-pointer"
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="flex w-full items-center px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors text-left cursor-pointer"
                >
                  Download JSON
                </button>
              </div>
            )}
          </div>

          {/* Sync Status Badge */}
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border ${
            isLive
              ? "bg-[var(--accent-green)]/10 border-[var(--accent-green)]/30 text-[var(--accent-green)]"
              : "bg-[var(--bg-card)]/80 border-[var(--border-soft)] text-[var(--text-secondary)]"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${isLive ? "bg-[var(--accent-green)]" : "bg-[var(--text-tertiary)]"}`} />
            {isLive ? `Live · Synced ${lastSync ? new Date(lastSync).toLocaleTimeString() : "—"}` : "Sample Data Mode"}
          </div>
        </div>
      </div>

      {/* Data Streams Strip */}
      <DataStreamsStrip />

      {/* ── Metric Cards Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* Heart Rate */}
        <MetricCard
          icon={<Heart className="h-5 w-5" />}
          label="Heart Rate"
          value={latestHR}
          unit="bpm"
          sub={isLive ? "Latest intraday reading" : "Sample — typical resting value"}
          color="rose"
          sparkPoints={hrSparkPoints.length >= 2 ? hrSparkPoints : [68, 70, 72, 74, 71, 73, 72]}
          latestTime={lastHRTime}
          metricKey="heart_rate"
        />

        {/* HRV RMSSD */}
        <MetricCard
          icon={<Activity className="h-5 w-5" />}
          label="HRV (RMSSD)"
          value={latestHRV}
          unit="ms"
          sub={latestHRV >= 50 ? "Optimal recovery zone" : "Recovery suppressed"}
          color="violet"
          sparkPoints={hrvSparkPoints.length >= 2 ? hrvSparkPoints : undefined}
          latestTime={lastHRVTime}
          metricKey="hrv"
        />

        {/* SpO2 */}
        <MetricCard
          icon={<Moon className="h-5 w-5" />}
          label="Blood Oxygen (SpO2)"
          value={latestSpo2}
          unit="%"
          sub={parseFloat(latestSpo2) >= 95 ? "Normal range" : "Below normal — monitor closely"}
          color="sky"
          sparkPoints={spo2SparkPoints.length >= 2 ? spo2SparkPoints : [97.2, 97.4, 97.1, 97.6, 97.5, 97.3, 97.4]}
          latestTime={lastSpo2Time}
          metricKey="spo2"
        />

        {/* Resting HR */}
        <MetricCard
          icon={<TrendingDown className="h-5 w-5" />}
          label="Resting Heart Rate"
          value={latestRestingHR}
          unit="bpm"
          sub={latestRestingHR <= 60 ? "Excellent cardiovascular fitness" : "Within healthy range"}
          color="indigo"
          sparkPoints={restingHRArr.slice(-20).map((d) => d.value)}
          latestTime={restingHRArr.length ? fmt(restingHRArr[restingHRArr.length - 1].timestamp) : undefined}
          metricKey="resting_hr"
        />

        {/* Skin Temp */}
        <MetricCard
          icon={<Thermometer className="h-5 w-5" />}
          label={tempIsAbsolute ? "Sleep Skin Temp (Abs)" : "Sleep Skin Temp Δ"}
          value={tempIsAbsolute ? latestTemp.toFixed(1) : `${latestTemp >= 0 ? "+" : ""}${latestTemp.toFixed(2)}`}
          unit="°C"
          sub={
            tempIsAbsolute
              ? "Absolute body temp — API not returning deviation"
              : Math.abs(latestTemp) < 0.5 ? "Stable baseline — no illness signal" : "Elevated — track closely"
          }
          color={tempIsAbsolute ? "amber" : Math.abs(latestTemp) < 0.5 ? "emerald" : "amber"}
          sparkPoints={tempSparkPoints.length >= 2 ? tempSparkPoints : undefined}
          latestTime={lastTempTime}
          metricKey="skin_temp"
        />

        {/* Steps */}
        <MetricCard
          icon={<BarChart2 className="h-5 w-5" />}
          label="Steps Today"
          value={todaySteps.toLocaleString()}
          unit="steps"
          sub={todaySteps >= 10000 ? "Goal achieved!" : `${(10000 - todaySteps).toLocaleString()} steps to goal`}
          color="emerald"
          sparkPoints={stepsArr.slice(-12).map((d) => d.value)}
          latestTime={lastStepsTime}
          metricKey="steps"
        />
      </div>

      {/* ── Sleep Summary (if data available) ────────────────────────── */}
      {(sleepArr.length > 0 || !isLive) && (
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)]/40 backdrop-blur-sm shadow-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-[var(--accent-primary)]" />
            <h2 className="font-semibold text-[var(--text-primary)] text-sm">Sleep Sessions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Total Sleep",
                value: `${latestSleepHours.toFixed(1)}h`,
                sub: isLive ? "Last night" : "Sample",
                color: "indigo" as const,
                metricKey: "sleep_duration",
              },
              ...((isLive && sleepArr.length) || (!isLive && mockSleepData.length > 0)
                ? (() => {
                    const s = isLive 
                      ? sleepArr[sleepArr.length - 1].value 
                      : mockSleepData[mockSleepData.length - 1].value;
                    const stages = s?.stages || {};
                    return [
                      { label: "REM", value: `${Math.round((stages.rem || 0) / 60 * 10) / 10}h`, sub: isLive ? "REM sleep" : "Sample", color: "violet" as const, metricKey: "rem_sleep" },
                      { label: "Deep", value: `${Math.round((stages.deep || 0) / 60 * 10) / 10}h`, sub: isLive ? "Deep sleep" : "Sample", color: "sky" as const, metricKey: "deep_sleep" },
                      { label: "Awake", value: `${Math.round((stages.awake || 0))}m`, sub: isLive ? "Awake time" : "Sample", color: "amber" as const, metricKey: "awake_sleep" },
                    ];
                  })()
                : [
                    { label: "REM", value: "1.8h", sub: "Sample", color: "violet" as const, metricKey: "rem_sleep" },
                    { label: "Deep", value: "1.2h", sub: "Sample", color: "sky" as const, metricKey: "deep_sleep" },
                    { label: "Awake", value: "18m", sub: "Sample", color: "amber" as const, metricKey: "awake_sleep" },
                  ]),
            ].map((item) => {
              const colorCls: Record<string, string> = {
                indigo: "text-[var(--accent-primary)]",
                violet: "text-[var(--chart-hrv)]",
                sky: "text-[var(--chart-sleep)]",
                amber: "text-[var(--chart-stress)]",
              };
              return (
                <div key={item.label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/30 p-3">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] font-semibold">{item.label}</span>
                    <MetricInfo metricKey={item.metricKey} size="sm" />
                  </div>
                  <div className={`text-2xl font-black font-mono mt-1 ${colorCls[item.color] ?? "text-[var(--text-primary)]"}`}>{item.value}</div>
                  <span className="text-[10px] text-[var(--text-tertiary)]">{item.sub}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Raw Data Tables ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Database className="h-4 w-4 text-[var(--accent-primary)]" />
          Raw Data Tables
          <span className="text-xs text-[var(--text-secondary)] font-normal">(Most recent 50 records shown per stream)</span>
        </h2>

        {/* Heart Rate raw table */}
        <RawTable
          title="Heart Rate"
          rows={heartRateArr}
          columns={[
            { key: "timestamp", label: "Timestamp", format: (v) => v ? new Date(v).toLocaleString() : "—" },
            { key: "value", label: "BPM", format: (v) => v != null ? `${Math.round(v)} bpm` : "—" },
            { key: "data_type", label: "Type" },
          ]}
        />

        {/* HRV raw table */}
        <RawTable
          title="HRV (RMSSD Daily)"
          rows={hrvArr}
          columns={[
            { key: "timestamp", label: "Date" },
            { key: "value", label: "RMSSD (ms)", format: (v) => v != null ? `${Number(v).toFixed(1)} ms` : "—" },
            { key: "data_type", label: "Type" },
          ]}
        />

        {/* SpO2 raw table */}
        <RawTable
          title="Blood Oxygen (SpO2)"
          rows={spo2Arr}
          columns={[
            { key: "timestamp", label: "Timestamp", format: (v) => v ? new Date(v).toLocaleString() : "—" },
            { key: "value", label: "SpO2 (%)", format: (v) => v != null ? `${Number(v).toFixed(1)}%` : "—" },
            { key: "data_type", label: "Type" },
          ]}
        />

        {/* Daily SpO2 raw table */}
        {dailySpo2Arr.length > 0 && (
          <RawTable
            title="Daily Average SpO2"
            rows={dailySpo2Arr}
            columns={[
              { key: "timestamp", label: "Date" },
              { key: "value", label: "Avg SpO2 (%)", format: (v) => v != null ? `${Number(v).toFixed(1)}%` : "—" },
              { key: "data_type", label: "Type" },
            ]}
          />
        )}

        {/* Resting HR */}
        <RawTable
          title="Daily Resting Heart Rate"
          rows={restingHRArr}
          columns={[
            { key: "timestamp", label: "Date" },
            { key: "value", label: "Resting HR (bpm)", format: (v) => v != null ? `${Math.round(v)} bpm` : "—" },
            { key: "data_type", label: "Type" },
          ]}
        />

        {/* Skin Temp */}
        <RawTable
          title="Sleep Skin Temperature Deviation"
          rows={sleepTempArr}
          columns={[
            { key: "timestamp", label: "Date" },
            {
              key: "value",
              label: "Temp Δ (°C)",
              format: (v) => v != null ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}°C` : "—",
            },
            { key: "data_type", label: "Type" },
          ]}
        />

        {/* Steps */}
        <RawTable
          title="Steps"
          rows={stepsArr}
          columns={[
            { key: "timestamp", label: "Timestamp", format: (v) => v ? new Date(v).toLocaleString() : "—" },
            { key: "value", label: "Count", format: (v) => v != null ? Number(v).toLocaleString() : "—" },
            { key: "data_type", label: "Type" },
          ]}
        />

        {/* Sleep sessions */}
        <RawTable
          title="Sleep Sessions"
          rows={sleepArr}
          columns={[
            { key: "timestamp", label: "Date" },
            {
              key: "value",
              label: "Total Sleep",
              format: (v) => v?.total_sleep_minutes != null
                ? `${(v.total_sleep_minutes / 60).toFixed(1)}h`
                : "—",
            },
            {
              key: "value",
              label: "REM",
              format: (v) => v?.stages?.rem != null ? `${Math.round(v.stages.rem)}m` : "—",
            },
            {
              key: "value",
              label: "Deep",
              format: (v) => v?.stages?.deep != null ? `${Math.round(v.stages.deep)}m` : "—",
            },
          ]}
        />
      </div>
    </div>
  );
}
