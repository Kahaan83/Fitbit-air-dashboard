"use client";

import React from "react";
import { useDashboardStore } from "@/lib/store";
import { Heart, Activity, Moon, Thermometer } from "lucide-react";
import { MetricInfo } from "@/components/MetricInfo";

export function DataStreamsStrip() {
  const { dataMode, liveData } = useDashboardStore();

  const getQualityColor = (streamName: string) => {
    if (dataMode === "sample") return "bg-emerald-500 shadow-emerald-500/20";
    if (!liveData) return "bg-red-500 shadow-red-500/20";

    let hasData = false;
    switch (streamName) {
      case "Heart Rate":
        hasData = (liveData.heart_rate || []).length > 0;
        break;
      case "HRV":
        hasData = (liveData.hrv || []).length > 0;
        break;
      case "SpO2":
        hasData = (liveData.spo2 || []).length > 0;
        break;
      case "Skin Temp":
        hasData = (liveData.sleep_temp || []).length > 0;
        break;
      default:
        break;
    }

    return hasData ? "bg-emerald-500 shadow-emerald-500/20" : "bg-amber-500 shadow-amber-500/20";
  };

  const getLatestValue = (streamName: string): string => {
    if (dataMode === "sample") {
      switch (streamName) {
        case "Heart Rate": return "72 bpm";
        case "HRV": return "51 ms";
        case "SpO2": return "97.4%";
        case "Skin Temp": return "+0.12°C";
      }
    }
    if (!liveData) return "—";
    switch (streamName) {
      case "Heart Rate": {
        const arr = liveData.heart_rate || [];
        if (!arr.length) return "—";
        return `${Math.round(arr[arr.length - 1].value)} bpm`;
      }
      case "HRV": {
        const arr = liveData.hrv || [];
        if (!arr.length) return "—";
        return `${Math.round(arr[arr.length - 1].value)} ms`;
      }
      case "SpO2": {
        const arr = liveData.spo2 || [];
        const darr = liveData.daily_spo2 || [];
        const src = arr.length ? arr : darr;
        if (!src.length) return "—";
        return `${src[src.length - 1].value.toFixed(1)}%`;
      }
      case "Skin Temp": {
        const arr = liveData.sleep_temp || [];
        if (!arr.length) return "—";
        const v = arr[arr.length - 1].value;
        if (Math.abs(v) > 10) return `${v.toFixed(1)}°C`;
        return `${v >= 0 ? "+" : ""}${v.toFixed(2)}°C`;
      }
      default: return "—";
    }
  };

  const streams = [
    { name: "Heart Rate", icon: Heart, key: "heart_rate" },
    { name: "HRV", icon: Activity, key: "hrv" },
    { name: "SpO2", icon: Moon, key: "spo2" },
    { name: "Skin Temp", icon: Thermometer, key: "skin_temp" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-white/10 bg-slate-900/30 p-4 backdrop-blur-sm shadow-md">
      <span className="text-slate-400 font-medium text-xs">Data Streams:</span>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        {streams.map((stream) => {
          const StreamIcon = stream.icon;
          const dotColor = getQualityColor(stream.name);
          return (
            <div key={stream.name} className="flex items-center gap-2 text-slate-300 font-mono">
              <span className={`h-2 w-2 rounded-full shadow-md ${dotColor}`} />
              <StreamIcon className="h-3.5 w-3.5 text-slate-400" />
              <div className="flex items-center gap-1">
                <span>{stream.name}</span>
                <MetricInfo metricKey={stream.key} size="sm" />
              </div>
              <span
                className={`font-bold tabular-nums ${
                  dataMode === "live" ? "text-emerald-400" : "text-slate-300"
                }`}
              >
                {getLatestValue(stream.name)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DataStreamsStrip;
