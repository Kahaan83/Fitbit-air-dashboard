"use client";

import React, { useState, useEffect } from "react";
import { useChartData } from "@/lib/useChartData";
import { getPastDates, AcuteStressEvent } from "@/lib/mockData";
import { X, Flame, AlertCircle } from "lucide-react";
import { MetricInfo } from "@/components/MetricInfo";
import { EmptyChartState } from "./EmptyChartState";
import { useDashboardStore } from "@/lib/store";

function generateDateRange(startStr: string, endStr: string): string[] {
  const datesList: string[] = [];
  const [sYear, sMonth, sDay] = startStr.split("-").map(Number);
  const [eYear, eMonth, eDay] = endStr.split("-").map(Number);
  
  const start = new Date(Date.UTC(sYear, sMonth - 1, sDay));
  const end = new Date(Date.UTC(eYear, eMonth - 1, eDay));
  
  const current = new Date(start);
  while (current <= end) {
    const yyyy = current.getUTCFullYear();
    const mm = String(current.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(current.getUTCDate()).padStart(2, "0");
    datesList.push(`${yyyy}-${mm}-${dd}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return datesList;
}

function getLast30DaysLocal(): string[] {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  baseDate.setDate(baseDate.getDate() - 29);
  
  const startStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}-${String(baseDate.getDate()).padStart(2, "0")}`;
  
  return generateDateRange(startStr, todayStr);
}

function getDayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

function getDayOfMonth(dateStr: string): number {
  const parts = dateStr.split("-");
  return parseInt(parts[2], 10);
}

function getDayOfWeekName(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function AcuteStressHeatmap() {
  const { acuteStress } = useChartData();
  const { dataMode } = useDashboardStore();
  const [mounted, setMounted] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dates = React.useMemo(() => {
    if (!mounted) return [];
    if (dataMode === "live") {
      if (acuteStress && acuteStress.length > 0) {
        const eventDates = acuteStress.map(e => new Date(e.start).toLocaleDateString("en-CA")).sort();
        const earliest = eventDates[0];
        const latest = eventDates[eventDates.length - 1];
        return generateDateRange(earliest, latest);
      } else {
        return getLast30DaysLocal();
      }
    }
    return getPastDates(30);
  }, [mounted, dataMode, acuteStress]);

  // Group events by YYYY-MM-DD
  const eventsByDate = React.useMemo(() => {
    return dates.reduce((acc: Record<string, AcuteStressEvent[]>, date: string) => {
      acc[date] = acuteStress.filter((e: AcuteStressEvent) => e.date === date);
      return acc;
    }, {} as Record<string, AcuteStressEvent[]>);
  }, [dates, acuteStress]);

  // Heatmap styling colors based on count
  const getCellColor = (count: number) => {
    if (count === 0) return "bg-[var(--border-subtle)] hover:bg-[var(--border-soft)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]";
    if (count === 1) return "bg-[var(--accent-amber)]/20 text-[var(--accent-amber)] hover:bg-[var(--accent-amber)]/30 border border-[var(--accent-amber)]/20";
    if (count === 2) return "bg-[var(--accent-amber)]/45 text-[var(--accent-amber)] hover:bg-[var(--accent-amber)]/55 border border-[var(--accent-amber)]/30";
    return "bg-[var(--accent-red)]/70 text-[var(--text-primary)] hover:bg-[var(--accent-red)]/80 border border-[var(--accent-red)]/40 animate-pulse";
  };

  const activeEvents = activeDate ? eventsByDate[activeDate] || [] : [];

  if (!mounted) {
    return (
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5 relative min-w-0 h-64 animate-pulse" />
    );
  }

  return (
    <div
      data-testid="stress-heatmap"
      className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5 relative min-w-0"
    >
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Acute Stress Heatmap</h3>
            <MetricInfo metricKey="acute_stress" />
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            Cross-references heart rate spikes against zero-movement intervals
          </p>
        </div>
        
        {/* Heatmap Legend */}
        <div className="flex flex-wrap gap-3 text-[10px] font-mono text-[var(--text-secondary)] font-medium">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[var(--border-subtle)] border border-[var(--border-soft)]" /> 0 Events
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[var(--accent-amber)]/30 border border-[var(--accent-amber)]/20" /> 1 Event
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[var(--accent-amber)]/50 border border-[var(--accent-amber)]/30" /> 2 Events
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[var(--accent-red)]/70 border border-[var(--accent-red)]/40" /> 3+ Events
          </span>
        </div>
      </div>

      {/* Grid Layout: 30 days mapped to a 7-column calendar-style view */}
      {acuteStress && acuteStress.length > 0 ? (
        <div className="grid grid-cols-7 gap-2 max-w-lg mx-auto md:mx-0">
          {/* Render Day headers for columns */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] py-1">
              {day}
            </div>
          ))}

          {/* Padding for grid alignment: align first date to correct weekday index */}
          {dates.length > 0 && Array.from({ length: getDayOfWeek(dates[0]) }).map((_, i) => (
            <div key={`pad-${i}`} className="h-11 rounded-lg bg-transparent" />
          ))}

          {/* Heatmap cells */}
          {dates.map((date) => {
            const dayEvents = eventsByDate[date] || [];
            const count = dayEvents.length;
            const labelDate = getDayOfMonth(date);
            return (
              <button
                key={date}
                onClick={() => setActiveDate(date)}
                className={`h-11 rounded-lg flex flex-col justify-between p-1.5 transition-all text-left group cursor-pointer ${getCellColor(
                  count
                )}`}
              >
                <span className="text-[10px] font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
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
      ) : (
        <div className="h-44 w-full flex items-center justify-center">
          <EmptyChartState subtitle="Acute stress detection requires both heart rate and step recordings. Sync your Fitbit data." />
        </div>
      )}

      {/* Detail Popover Panel on cell selection */}
      {activeDate && (
        <div className="absolute inset-0 bg-[var(--bg-surface)]/95 rounded-2xl p-6 z-20 flex flex-col transition-all duration-300">
          <div className="flex items-center justify-between border-b border-[var(--border-medium)] pb-3 mb-4">
            <div>
              <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-[var(--accent-amber)]" />
                Stress Log for {activeDate}
              </h4>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {getDayOfWeekName(activeDate)} day view
              </p>
            </div>
            <button
              onClick={() => setActiveDate(null)}
              className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--border-soft)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {activeEvents.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-[var(--text-secondary)] text-xs py-8">
                <AlertCircle className="h-8 w-8 text-[var(--text-tertiary)] mb-2" />
                No stress events detected. HRV and heart rate values were within optimal baseline ranges.
              </div>
            ) : (
              activeEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/40 p-3 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          event.severity === "high"
                            ? "bg-[var(--accent-red)]/20 text-[var(--accent-red)] border border-[var(--accent-red)]/30"
                            : event.severity === "medium"
                            ? "bg-[var(--accent-amber)]/25 text-[var(--accent-amber)] border border-[var(--accent-amber)]/30"
                            : "bg-[var(--accent-amber)]/15 text-[var(--accent-amber)] border border-[var(--accent-amber)]/20"
                        }`}
                      >
                        {event.severity} severity
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] font-medium">
                      {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[var(--text-secondary)]">Peak HR</span>
                    <p className="text-sm font-bold font-mono text-[var(--text-primary)]">{event.hr_peak} bpm</p>
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
