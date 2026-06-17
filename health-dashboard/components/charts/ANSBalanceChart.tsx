"use client";

import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Cell,
} from "recharts";
import { useChartData } from "@/lib/useChartData";

export function ANSBalanceChart() {
  const { ansBalance } = useChartData();

  const formatXAxis = (tickItem: string) => {
    try {
      const parts = tickItem.split("-");
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } catch {
      return tickItem;
    }
  };

  // Prepare data for ScatterChart (convert date string index to numeric x value if needed,
  // or use category axis. In ScatterChart, using date as string category is supported
  // if we set type="category" on XAxis).
  const data = ansBalance.map((d: any) => ({
    ...d,
    // Add custom color indicator
    isNormal: d.lf_hf_ratio >= 1.0 && d.lf_hf_ratio <= 2.0,
  }));

  return (
    <div
      data-testid="ans-chart"
      className="glow-card rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-sm shadow-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">ANS Autonomic Balance</h3>
          <p className="text-xs text-slate-400">Low-Frequency (Sympathetic) / High-Frequency (Parasympathetic) Power Ratio</p>
        </div>
        <div className="flex gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1 text-indigo-400">
            <span className="h-2 w-2 rounded-full bg-indigo-400" /> Normal Balance (1.0–2.0)
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Out of Range (Stress/Fatigue)
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              type="category"
              dataKey="date"
              name="Date"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatXAxis}
            />
            <YAxis
              type="number"
              dataKey="lf_hf_ratio"
              name="LF/HF Ratio"
              domain={[0.4, 3.0]}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            {/* Highlight normal range (1.0 - 2.0) with subtle overlay */}
            <ReferenceArea
              y1={1.0}
              y2={2.0}
              fill="rgba(99, 102, 241, 0.05)"
              stroke="rgba(99, 102, 241, 0.15)"
              strokeDasharray="3 3"
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.1)" }}
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: "8px",
              }}
              labelClassName="text-slate-400 text-xs font-mono"
              itemStyle={{ fontSize: "12px" }}
              formatter={(value: any, name: any) => {
                if (name === "LF/HF Ratio") return [`${value}`, "LF/HF Balance"];
                return [value, name];
              }}
            />
            <Scatter name="ANS Balance" data={data}>
              {data.map((entry: any, index: number) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isNormal ? "#6366f1" : "#ef4444"}
                  stroke={entry.isNormal ? "rgba(99,102,241,0.5)" : "rgba(239,68,68,0.5)"}
                  strokeWidth={2}
                  r={entry.isNormal ? 5 : 6}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export default ANSBalanceChart;
