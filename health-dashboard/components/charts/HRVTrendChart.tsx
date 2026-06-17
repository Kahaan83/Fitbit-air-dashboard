"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useChartData } from "@/lib/useChartData";

export function HRVTrendChart() {
  const { hrv } = useChartData();

  // Calculate dynamic stops for green/orange split at 50ms
  // Find min/max values to normalize the gradient offset
  const values = hrv.map((d: any) => d.value);
  const minVal = Math.min(...values, 20);
  const maxVal = Math.max(...values, 80);
  
  // Calculate percentage offset where Y = 50 is relative to min/max
  const threshold = 50;
  let offset = 0.5;
  if (maxVal !== minVal) {
    // Recharts gradients flow top-down (0 = top, 1 = bottom)
    // So Y=50 is: (max - 50) / (max - min)
    offset = (maxVal - threshold) / (maxVal - minVal);
  }
  offset = Math.max(0, Math.min(1, offset));

  const formatXAxis = (tickItem: string) => {
    try {
      const parts = tickItem.split("-");
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } catch {
      return tickItem;
    }
  };

  return (
    <div
      data-testid="hrv-chart"
      className="glow-card rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-sm shadow-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">HRV Recovery Trend</h3>
          <p className="text-xs text-slate-400">Daily RMSSD (ms) — 30 Day History</p>
        </div>
        <div className="flex gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Optimal (&gt;50ms)
          </span>
          <span className="flex items-center gap-1 text-amber-500">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Fatigued (&lt;50ms)
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={hrv} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="hrvSplit" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="#10b981" stopOpacity={1} />
                <stop offset={offset} stopColor="#10b981" stopOpacity={1} />
                <stop offset={offset} stopColor="#f59e0b" stopOpacity={1} />
                <stop offset={1} stopColor="#f59e0b" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatXAxis}
            />
            <YAxis
              domain={[minVal - 5, maxVal + 5]}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: "8px",
              }}
              labelClassName="text-slate-400 text-xs font-mono"
              itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}
              formatter={(value: any) => [`${value} ms`, "RMSSD"]}
            />
            <ReferenceLine
              y={50}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
              label={{
                value: "Baseline (50ms)",
                fill: "#94a3b8",
                fontSize: 10,
                position: "top",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="url(#hrvSplit)"
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 1 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export default HRVTrendChart;
