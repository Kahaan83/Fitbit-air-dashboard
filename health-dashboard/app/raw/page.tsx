"use client";

import React, { useMemo } from "react";
import { useDashboardStore } from "@/lib/store";
import * as mock from "@/lib/mockData";
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
    rose: "#f43f5e",
    violet: "#8b5cf6",
    sky: "#0ea5e9",
    amber: "#f59e0b",
    emerald: "#10b981",
    indigo: "#6366f1",
  };
  const stroke = colorMap[color] ?? "#8b5cf6";

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
function MetricCard({ icon, label, value, unit, sub, color, sparkPoints, latestTime }: MetricCardProps) {
  const borderMap: Record<string, string> = {
    rose:    "border-rose-500/20 bg-rose-500/5",
    violet:  "border-violet-500/20 bg-violet-500/5",
    sky:     "border-sky-500/20 bg-sky-500/5",
    amber:   "border-amber-500/20 bg-amber-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    indigo:  "border-indigo-500/20 bg-indigo-500/5",
  };
  const iconMap: Record<string, string> = {
    rose:    "bg-rose-600/10 text-rose-400 border-rose-500/20",
    violet:  "bg-violet-600/10 text-violet-400 border-violet-500/20",
    sky:     "bg-sky-600/10 text-sky-400 border-sky-500/20",
    amber:   "bg-amber-600/10 text-amber-400 border-amber-500/20",
    emerald: "bg-emerald-600/10 text-emerald-400 border-emerald-500/20",
    indigo:  "bg-indigo-600/10 text-indigo-400 border-indigo-500/20",
  };
  const valueMap: Record<string, string> = {
    rose:    "text-rose-300",
    violet:  "text-violet-300",
    sky:     "text-sky-300",
    amber:   "text-amber-300",
    emerald: "text-emerald-300",
    indigo:  "text-indigo-300",
  };

  return (
    <div
      className={`rounded-2xl border backdrop-blur-sm shadow-xl p-5 flex flex-col gap-3 ${borderMap[color] ?? ""} bg-slate-900/50`}
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
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</span>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className={`text-4xl font-black font-mono tabular-nums ${valueMap[color] ?? "text-white"}`}>
            {value}
          </span>
          <span className="text-sm text-slate-400 font-medium">{unit}</span>
        </div>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>

      {/* Bottom: last reading time */}
      {latestTime && (
        <div className="flex items-center gap-1 text-[10px] text-slate-600 border-t border-white/5 pt-2">
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
    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6 text-center text-slate-500 text-sm">
      No data available for <span className="font-semibold text-slate-400">{title}</span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-xl">
      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
        <Database className="h-4 w-4 text-indigo-400" />
        <span className="text-sm font-semibold text-slate-200">{title}</span>
        <span className="ml-auto text-xs text-slate-500 font-mono">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((c) => (
                <th key={c.label} className="px-4 py-2.5 text-left text-slate-500 font-semibold uppercase tracking-wider">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(-50).reverse().map((row, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                {columns.map((c) => (
                  <td key={c.label} className="px-4 py-2 font-mono text-slate-300">
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
  const { dataMode, liveData, lastSync } = useDashboardStore();

  const isLive = dataMode === "live" && liveData != null;

  // ── Derive numeric values from live or mock data ─────────────────────────────
  const heartRateArr: any[] = isLive ? (liveData.heart_rate || []) : [];
  const hrvArr: any[] = isLive ? (liveData.hrv || []) : [];
  const spo2Arr: any[] = isLive ? (liveData.spo2 || liveData.daily_spo2 || []) : [];
  const dailySpo2Arr: any[] = isLive ? (liveData.daily_spo2 || []) : [];
  const restingHRArr: any[] = isLive ? (liveData.daily_resting_hr || []) : [];
  const sleepTempArr: any[] = isLive ? (liveData.sleep_temp || []) : [];
  const stepsArr: any[] = isLive ? (liveData.steps || []) : [];
  const sleepArr: any[] = isLive ? (liveData.sleep || []) : [];

  // Mock fallback scalars
  const mockLatestHRV = mock.mockHRV[mock.mockHRV.length - 1]?.value ?? 51;
  const mockLatestTemp = mock.mockSkinTemp[mock.mockSkinTemp.length - 1]?.value ?? 0.12;
  const mockLatestSleep = mock.mockSleepDebt[mock.mockSleepDebt.length - 1]?.actual_hours ?? 7.4;

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
    : 58;

  const rawTemp = sleepTempArr.length
    ? sleepTempArr[sleepTempArr.length - 1].value
    : mockLatestTemp;
  // Sanity check: if value > 10, API is returning absolute temperature, not deviation
  const tempIsAbsolute = isLive && Math.abs(rawTemp) > 10;
  const latestTemp = tempIsAbsolute ? rawTemp : rawTemp;

  const todaySteps = useMemo(() => {
    if (!stepsArr.length) return 6820;
    const today = new Date().toISOString().slice(0, 10);
    return stepsArr
      .filter((s) => (s.timestamp || "").startsWith(today))
      .reduce((acc, s) => acc + (s.value || 0), 0);
  }, [stepsArr]);

  const latestSleepHours = sleepArr.length
    ? (sleepArr[sleepArr.length - 1].value?.total_sleep_minutes ?? 0) / 60
    : mockLatestSleep;

  // Sparkline data
  const hrSparkPoints = heartRateArr.slice(-40).map((d) => d.value);
  const hrvSparkPoints = isLive
    ? hrvArr.slice(-30).map((d) => d.value)
    : mock.mockHRV.slice(-30).map((d) => d.value);
  const spo2SparkPoints = spo2Arr.slice(-30).map((d) => d.value);
  const tempSparkPoints = isLive
    ? sleepTempArr.slice(-20).map((d) => d.value)
    : mock.mockSkinTemp.slice(-20).map((d) => d.value);

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
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Raw Metrics</h1>
          <p className="text-slate-400 text-sm mt-1">
            All raw physiological data streams — direct from Google Health API v4.
          </p>
        </div>
        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border self-start md:self-auto ${
          isLive
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-slate-800/80 border-slate-700 text-slate-400"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${isLive ? "bg-emerald-400" : "bg-slate-500"}`} />
          {isLive ? `Live · Synced ${lastSync ? new Date(lastSync).toLocaleTimeString() : "—"}` : "Sample Data Mode"}
        </div>
      </div>

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
        />
      </div>

      {/* ── Sleep Summary (if data available) ────────────────────────── */}
      {(sleepArr.length > 0 || !isLive) && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-sm shadow-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-indigo-400" />
            <h2 className="font-semibold text-slate-200 text-sm">Sleep Sessions</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Total Sleep",
                value: `${latestSleepHours.toFixed(1)}h`,
                sub: isLive ? "Last night" : "Sample",
                color: "indigo" as const,
              },
              ...(isLive && sleepArr.length
                ? (() => {
                    const s = sleepArr[sleepArr.length - 1].value;
                    const stages = s?.stages || {};
                    return [
                      { label: "REM", value: `${Math.round((stages.rem || 0) / 60 * 10) / 10}h`, sub: "REM sleep", color: "violet" as const },
                      { label: "Deep", value: `${Math.round((stages.deep || 0) / 60 * 10) / 10}h`, sub: "Deep sleep", color: "sky" as const },
                      { label: "Awake", value: `${Math.round((stages.awake || 0))}m`, sub: "Awake time", color: "amber" as const },
                    ];
                  })()
                : [
                    { label: "REM", value: "1.8h", sub: "Sample", color: "violet" as const },
                    { label: "Deep", value: "1.2h", sub: "Sample", color: "sky" as const },
                    { label: "Awake", value: "18m", sub: "Sample", color: "amber" as const },
                  ]),
            ].map((item) => {
              const colorCls: Record<string, string> = {
                indigo: "text-indigo-300",
                violet: "text-violet-300",
                sky: "text-sky-300",
                amber: "text-amber-300",
              };
              return (
                <div key={item.label} className="rounded-xl border border-white/5 bg-white/3 p-3">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{item.label}</span>
                  <div className={`text-2xl font-black font-mono mt-1 ${colorCls[item.color] ?? "text-white"}`}>{item.value}</div>
                  <span className="text-[10px] text-slate-600">{item.sub}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Raw Data Tables ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-300 flex items-center gap-2">
          <Database className="h-4 w-4 text-indigo-400" />
          Raw Data Tables
          <span className="text-xs text-slate-500 font-normal">(Most recent 50 records shown per stream)</span>
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
