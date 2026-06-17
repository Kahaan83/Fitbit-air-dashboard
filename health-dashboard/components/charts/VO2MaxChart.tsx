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
  ReferenceArea,
} from "recharts";
import { useChartData } from "@/lib/useChartData";
import { MetricInfo } from "@/components/MetricInfo";

export function VO2MaxChart() {
  const { vo2Max } = useChartData();

  const formatXAxis = (tickItem: string) => {
    try {
      const parts = tickItem.split("-");
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } catch {
      return tickItem;
    }
  };

  const values = vo2Max.map((d: any) => d.vo2_max);
  const minVal = Math.min(...values, 40);
  const maxVal = Math.max(...values, 55);

  return (
    <div
      data-testid="vo2-chart"
      className="glow-card rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-sm shadow-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-bold text-white">VO2 Max Progression</h3>
            <MetricInfo metricKey="vo2max" />
          </div>
          <p className="text-xs text-slate-400">Cardiovascular fitness level estimation (ml/kg/min)</p>
        </div>
        <div className="flex gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500/20 border border-emerald-500/50" /> Excellent (&gt;52)
          </span>
          <span className="flex items-center gap-1 text-indigo-400">
            <span className="h-2 w-2 rounded-full bg-indigo-500/20 border border-indigo-500/50" /> Good (42–52)
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={vo2Max} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
              domain={[Math.floor(minVal - 2), Math.ceil(maxVal + 2)]}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            {/* Good Zone (42 - 52) */}
            <ReferenceArea
              y1={42}
              y2={52}
              fill="rgba(99, 102, 241, 0.04)"
              stroke="rgba(99, 102, 241, 0.1)"
              strokeDasharray="3 3"
            />
            {/* Excellent Zone (52+) */}
            <ReferenceArea
              y1={52}
              y2={60}
              fill="rgba(16, 185, 129, 0.04)"
              stroke="rgba(16, 185, 129, 0.1)"
              strokeDasharray="3 3"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: "8px",
              }}
              labelClassName="text-slate-400 text-xs font-mono"
              itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}
              formatter={(value: any) => [`${value} ml/kg/min`, "VO2 Max"]}
            />
            <Line
              type="monotone"
              dataKey="vo2_max"
              stroke="#a855f7"
              strokeWidth={3}
              dot={{ r: 3, fill: "#a855f7" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export default VO2MaxChart;
