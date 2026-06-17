"use client";

import React, { useState } from "react";
import { useChartData } from "@/lib/useChartData";
import { getPastDates, AcuteStressEvent } from "@/lib/mockData";
import { X, Flame, AlertCircle } from "lucide-react";
import { MetricInfo } from "@/components/MetricInfo";

export function AcuteStressHeatmap() {
  const { acuteStress } = useChartData();
  const dates = getPastDates(30);

  // Group events by YYYY-MM-DD
  const eventsByDate = dates.reduce((acc: Record<string, AcuteStressEvent[]>, date: string) => {
    acc[date] = acuteStress.filter((e: AcuteStressEvent) => e.date === date);
    return acc;
  }, {} as Record<string, AcuteStressEvent[]>);

  const [activeDate, setActiveDate] = useState<string | null>(null);

  // Heatmap styling colors based on count
  const getCellColor = (count: number) => {
    if (count === 0) return "bg-slate-800/40 hover:bg-slate-700/40 border border-white/5";
    if (count === 1) return "bg-amber-500/30 text-amber-300 hover:bg-amber-500/40 border border-amber-500/20";
    if (count === 2) return "bg-orange-500/50 text-orange-200 hover:bg-orange-500/60 border border-orange-500/30";
    return "bg-red-500/70 text-red-100 hover:bg-red-500/80 border border-red-500/40 animate-pulse";
  };

  const getDayOfWeekName = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  };

  const activeEvents = activeDate ? eventsByDate[activeDate] || [] : [];

  return (
    <div
      data-testid="stress-heatmap"
      className="glow-card rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-sm shadow-xl relative"
    >
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-bold text-white">Acute Stress Heatmap</h3>
            <MetricInfo metricKey="acute_stress" />
          </div>
          <p className="text-xs text-slate-400">
            Cross-references heart rate spikes against zero-movement intervals
          </p>
        </div>
        
        {/* Heatmap Legend */}
        <div className="flex flex-wrap gap-3 text-[10px] font-mono text-slate-400 font-semibold">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-slate-800/40 border border-white/5" /> 0 Events
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-amber-500/30 border border-amber-500/20" /> 1 Event
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-orange-500/50 border border-orange-500/30" /> 2 Events
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-red-500/70 border border-red-500/40" /> 3+ Events
          </span>
        </div>
      </div>

      {/* Grid Layout: 30 days mapped to a 7-column calendar-style view */}
      <div className="grid grid-cols-7 gap-2 max-w-lg mx-auto md:mx-0">
        {/* Render Day headers for columns */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 py-1">
            {day}
          </div>
        ))}

        {/* Padding for grid alignment: align first date to correct weekday index */}
        {Array.from({ length: new Date(dates[0]).getDay() }).map((_, i) => (
          <div key={`pad-${i}`} className="h-11 rounded-lg bg-transparent" />
        ))}

        {/* Heatmap cells */}
        {dates.map((date) => {
          const dayEvents = eventsByDate[date] || [];
          const count = dayEvents.length;
          const labelDate = new Date(date).getUTCDate();
          return (
            <button
              key={date}
              onClick={() => setActiveDate(date)}
              className={`h-11 rounded-lg flex flex-col justify-between p-1.5 transition-all text-left group cursor-pointer ${getCellColor(
                count
              )}`}
            >
              <span className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors">
                {labelDate}
              </span>
              {count > 0 && (
                <span className="self-end text-[10px] font-bold font-mono">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail Popover Panel on cell selection */}
      {activeDate && (
        <div className="absolute inset-0 bg-slate-950/90 rounded-2xl p-6 z-20 flex flex-col transition-all duration-300">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-orange-400" />
                Stress Log for {activeDate}
              </h4>
              <p className="text-[10px] text-slate-400">
                {getDayOfWeekName(activeDate)} day view
              </p>
            </div>
            <button
              onClick={() => setActiveDate(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {activeEvents.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-500 text-xs py-8">
                <AlertCircle className="h-8 w-8 text-slate-600 mb-2" />
                No stress events detected. HRV and heart rate values were within optimal baseline ranges.
              </div>
            ) : (
              activeEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-white/5 bg-white/5 p-3 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          event.severity === "high"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : event.severity === "medium"
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {event.severity} severity
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">
                      {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Peak HR</span>
                    <p className="text-sm font-bold font-mono text-white">{event.hr_peak} bpm</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default AcuteStressHeatmap;
