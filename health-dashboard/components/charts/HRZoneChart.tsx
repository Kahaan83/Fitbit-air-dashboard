"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useDashboardStore } from "@/lib/store";
import { MetricInfo } from "@/components/MetricInfo";
import { EmptyChartState } from "./EmptyChartState";

const css = (v: string) => {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
};

export function HRZoneChart() {
  const dataMode = useDashboardStore((state) => state.dataMode);
  const settings = useDashboardStore((state) => state.settings);
  const liveData = useDashboardStore((state) => state.liveData);
  const theme = useDashboardStore((state) => state.theme);

  const colorBgSurface = css("--bg-surface") || "#111118";
  const colorBorderMedium = css("--border-medium") || "rgba(124,109,250,0.25)";
  const colorTextPrimary = css("--text-primary") || "#E8E8F0";

  const colorZone1 = css("--chart-zone1") || "#44445A";
  const colorZone2 = css("--chart-zone2") || "#2563EB";
  const colorZone3 = css("--chart-zone3") || "#22D3A5";
  const colorZone4 = css("--chart-zone4") || "#F59E0B";
  const colorZone5 = css("--chart-zone5") || "#F4546A";

  const heartRateData = liveData?.heart_rate || [];
  const maxHR = settings.maxHR || 185;

  let z1 = 0; // Rest
  let z2 = 0; // Fat burn
  let z3 = 0; // Aerobic
  let z4 = 0; // Threshold
  let z5 = 0; // Max

  if (dataMode === "sample" || heartRateData.length === 0) {
    z1 = 45;
    z2 = 25;
    z3 = 18;
    z4 = 9;
    z5 = 3;
  } else {
    heartRateData.forEach((d: any) => {
      const val = typeof d.value === "number" ? d.value : parseFloat(d.value);
      if (!isNaN(val)) {
        const pct = (val / maxHR) * 100;
        if (pct <= 50) z1++;
        else if (pct <= 60) z2++;
        else if (pct <= 70) z3++;
        else if (pct <= 85) z4++;
        else z5++;
      }
    });

    const total = z1 + z2 + z3 + z4 + z5;
    if (total > 0) {
      z1 = Math.round((z1 / total) * 100 * 10) / 10;
      z2 = Math.round((z2 / total) * 100 * 10) / 10;
      z3 = Math.round((z3 / total) * 100 * 10) / 10;
      z4 = Math.round((z4 / total) * 100 * 10) / 10;
      z5 = Math.round((z5 / total) * 100 * 10) / 10;
    } else {
      z1 = 45;
      z2 = 25;
      z3 = 18;
      z4 = 9;
      z5 = 3;
    }
  }

  const chartData = [
    {
      name: "HR Zones",
      zone1: z1,
      zone2: z2,
      zone3: z3,
      zone4: z4,
      zone5: z5,
    },
  ];

  const hasData = dataMode === "sample" || (heartRateData && heartRateData.length > 0);

  return (
    <div
      data-testid="hr-zone-chart"
      className="glow-card rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 backdrop-blur-sm shadow-xl flex flex-col justify-between"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Heart Rate Zones</h3>
            <MetricInfo metricKey="heart_rate" />
          </div>
          <p className="text-xs text-[var(--text-secondary)]">Time distribution across physiological zones</p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-40 w-full mt-2 flex items-center justify-center">
          <EmptyChartState subtitle="Heart rate zone analysis requires active heart rate recordings. Try syncing your Fitbit." />
        </div>
      ) : (
        <>
          <div className="h-12 w-full mt-2" role="img" aria-label="Heart Rate Zones chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  formatter={(value: any, name?: any) => {
                    const zoneNames: Record<string, string> = {
                      zone1: "Zone 1 (Rest)",
                      zone2: "Zone 2 (Fat Burn)",
                      zone3: "Zone 3 (Aerobic)",
                      zone4: "Zone 4 (Threshold)",
                      zone5: "Zone 5 (Max)",
                    };
                    const key = String(name || "");
                    return [`${value}%`, zoneNames[key] || key];
                  }}
                  contentStyle={{
                    backgroundColor: colorBgSurface,
                    borderColor: colorBorderMedium,
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: colorTextPrimary, fontSize: "12px", fontWeight: "bold" }}
                  cursor={false}
                />
                <Bar dataKey="zone1" stackId="a" fill={colorZone1} name="Rest" />
                <Bar dataKey="zone2" stackId="a" fill={colorZone2} name="Fat Burn" />
                <Bar dataKey="zone3" stackId="a" fill={colorZone3} name="Aerobic" />
                <Bar dataKey="zone4" stackId="a" fill={colorZone4} name="Threshold" />
                <Bar dataKey="zone5" stackId="a" fill={colorZone5} name="Max" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Custom Legend */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-semibold">
            <div className="flex flex-col p-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] items-center text-center">
              <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorZone1 }} />
                Zone 1 (Rest)
              </span>
              <span className="text-[var(--text-primary)] mt-0.5 font-bold font-mono">{z1}%</span>
            </div>
            <div className="flex flex-col p-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] items-center text-center">
              <span className="flex items-center gap-1.5 text-[var(--chart-zone2)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorZone2 }} />
                Zone 2 (Fat Burn)
              </span>
              <span className="text-[var(--text-primary)] mt-0.5 font-bold font-mono">{z2}%</span>
            </div>
            <div className="flex flex-col p-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] items-center text-center">
              <span className="flex items-center gap-1.5 text-[var(--chart-zone3)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorZone3 }} />
                Zone 3 (Aerobic)
              </span>
              <span className="text-[var(--text-primary)] mt-0.5 font-bold font-mono">{z3}%</span>
            </div>
            <div className="flex flex-col p-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] items-center text-center">
              <span className="flex items-center gap-1.5 text-[var(--chart-zone4)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorZone4 }} />
                Zone 4 (Threshold)
              </span>
              <span className="text-[var(--text-primary)] mt-0.5 font-bold font-mono">{z4}%</span>
            </div>
            <div className="flex flex-col p-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] items-center text-center col-span-2 sm:col-span-1">
              <span className="flex items-center gap-1.5 text-[var(--chart-zone5)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorZone5 }} />
                Zone 5 (Max)
              </span>
              <span className="text-[var(--text-primary)] mt-0.5 font-bold font-mono">{z5}%</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default HRZoneChart;
