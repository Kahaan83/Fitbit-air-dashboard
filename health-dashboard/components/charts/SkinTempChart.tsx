"use client";

import React from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useChartData } from "@/lib/useChartData";
import { MetricInfo } from "@/components/MetricInfo";

export function SkinTempChart() {
  const { skinTemp } = useChartData();

  const formatXAxis = (tickItem: string) => {
    try {
      const parts = tickItem.split("-");
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } catch {
      return tickItem;
    }
  };

  const values = skinTemp.map((d: any) => d.value);
  const minVal = Math.min(...values, -1.0);
  const maxVal = Math.max(...values, 1.0);

  return (
    <div
      data-testid="skin-temp-chart"
      className="rounded-xl border border-white/8 bg-slate-900/60 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-white">Sleep Skin Temperature Deviation</h3>
            <MetricInfo metricKey="sleep_temp_deviation" />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Nightly variation relative to 7-day personal baseline (°C)</p>
        </div>
        <div className="flex gap-3 text-xs font-medium">
          <span className="flex items-center gap-1 text-amber-500">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Elevated (&gt;0°C)
          </span>
          <span className="flex items-center gap-1 text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> Suppressed (&lt;0°C)
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={skinTemp} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatXAxis}
            />
            <YAxis
              domain={[Math.floor(minVal * 1.5 * 10) / 10, Math.ceil(maxVal * 1.5 * 10) / 10]}
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
              formatter={(value: any) => [`${value > 0 ? "+" : ""}${value} °C`, "Deviation"]}
            />
            <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.2)" />
            <Bar dataKey="value">
              {skinTemp.map((entry: any, index: number) => {
                const color = entry.value >= 0 ? "#f59e0b" : "#38bdf8";
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export default SkinTempChart;
