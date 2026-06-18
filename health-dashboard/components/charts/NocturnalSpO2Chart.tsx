"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useChartData } from "@/lib/useChartData";
import { MetricInfo } from "@/components/MetricInfo";

export function NocturnalSpO2Chart() {
  const { spo2Nocturnal } = useChartData();
  const availableDates = Object.keys(spo2Nocturnal).sort((a, b) => b.localeCompare(a)); // Newest first

  const [selectedDate, setSelectedDate] = useState("");

  // Default to the most recent night available
  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  const currentData = selectedDate ? spo2Nocturnal[selectedDate] || [] : [];

  // Calculate dynamic stops for hypoxemia split at 90%
  const values = currentData.map((d: any) => d.value);
  const minVal = Math.min(...values, 85);
  const maxVal = Math.max(...values, 100);

  const threshold = 90;
  let offset = 1; // Default to all optimal
  if (maxVal !== minVal) {
    // Top is maxVal, bottom is minVal.
    // So percentage from top to threshold 90 is: (maxVal - 90) / (maxVal - minVal)
    offset = (maxVal - threshold) / (maxVal - minVal);
  }
  offset = Math.max(0, Math.min(1, offset));

  return (
    <div
      data-testid="spo2-chart"
      className="rounded-xl border border-white/8 bg-slate-900/60 p-5"
    >
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-white">Nocturnal Oxygen Saturation (SpO2)</h3>
            <MetricInfo metricKey="spo2" />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Continuous 5-minute resolution during sleep</p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-400">Select Night:</label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer"
          >
            {availableDates.map((d: string) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentData.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-slate-500 text-xs">
          No nocturnal readings available for this date.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                {/* Area Fill Gradient */}
                <linearGradient id="spo2Fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset={offset} stopColor="#06b6d4" stopOpacity={0.1} />
                  <stop offset={offset} stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset={1} stopColor="#ef4444" stopOpacity={0.1} />
                </linearGradient>
                {/* Stroke Line Gradient */}
                <linearGradient id="spo2Stroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor="#06b6d4" stopOpacity={1} />
                  <stop offset={offset} stopColor="#06b6d4" stopOpacity={1} />
                  <stop offset={offset} stopColor="#ef4444" stopOpacity={1} />
                  <stop offset={1} stopColor="#ef4444" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={24} // Only display a few hours ticks
              />
              <YAxis
                domain={[Math.floor(minVal - 2), 100]}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                }}
                labelClassName="text-slate-400 text-xs font-mono"
                itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}
                formatter={(value: any) => [`${value}%`, "Oxygen Saturation"]}
              />
              {/* Critical Hypoxemia Threshold Reference Line */}
              <ReferenceLine
                y={90}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{
                  value: "Hypoxemia Threshold (90%)",
                  fill: "#ef4444",
                  fontSize: 10,
                  position: "top",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="url(#spo2Stroke)"
                strokeWidth={2}
                fill="url(#spo2Fill)"
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-white/5 bg-slate-950/40 p-3 flex justify-between items-center text-xs">
        <span className="text-slate-400">Night Analysis summary:</span>
        <div className="flex gap-4 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Min SpO2:</span>
            <span className={`font-bold ${values.some(v => v < 90) ? "text-red-400" : "text-cyan-400"}`}>
              {values.length > 0 ? Math.min(...values) : "—"}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Average:</span>
            <span className="font-bold text-slate-200">
              {values.length > 0 ? (values.reduce((a: number, b: number) => a + b, 0) / values.length).toFixed(1) : "—"}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
export default NocturnalSpO2Chart;
