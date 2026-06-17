"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardStore } from "@/lib/store";
import { Activity, ShieldCheck, Heart, Moon, Thermometer, Settings as SettingsIcon } from "lucide-react";

interface HeaderProps {
  onOpenSettings: () => void;
}

export function Header({ onOpenSettings }: HeaderProps) {
  const pathname = usePathname();
  const { dataMode, lastSync, liveData } = useDashboardStore();

  // Navigation tabs definition
  const navigation = [
    { name: "Overview", href: "/", icon: Activity },
    { name: "Recovery", href: "/recovery", icon: Heart },
    { name: "Sleep", href: "/sleep", icon: Moon },
  ];

  // Helper to determine stream quality
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-lg shadow-indigo-500/25">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              Fitbit Air
            </span>
            <span className="hidden rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400 sm:inline-block">
              API v4 Gateway
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navigation.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.name}</span>
                </Link>
              );
            })}

            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-white/5 hover:text-slate-200"
            >
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </nav>

          {/* Status Badge & Sync Info */}
          <div className="flex items-center gap-4">
            {/* Sync timestamp */}
            <div className="hidden text-right text-xs md:block">
              <span className="text-slate-500">Last Sync:</span>{" "}
              <span className="font-mono text-slate-300">
                {lastSync ? new Date(lastSync).toLocaleTimeString() : "—"}
              </span>
            </div>

            {/* Connection badge */}
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-all duration-300 ${
                dataMode === "live"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_-3px_rgba(16,185,129,0.2)]"
                  : "bg-slate-800/80 border-slate-700 text-slate-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                  dataMode === "live" ? "bg-emerald-400" : "bg-slate-400"
                }`}
              />
              {dataMode === "live" ? "Live Data" : "Sample Data"}
            </div>
          </div>
        </div>
      </div>

      {/* Data Quality Indicator Row */}
      <div className="border-t border-white/5 bg-slate-950/40 py-2">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-y-2 text-xs">
            <span className="text-slate-500 font-medium">Physiological Data Streams:</span>
            <div className="flex flex-wrap gap-4 sm:gap-6">
              {[
                { name: "Heart Rate", icon: Heart },
                { name: "HRV", icon: Activity },
                { name: "SpO2", icon: Moon },
                { name: "Skin Temp", icon: Thermometer },
              ].map((stream) => {
                const StreamIcon = stream.icon;
                const dotColor = getQualityColor(stream.name);
                return (
                  <div key={stream.name} className="flex items-center gap-2 text-slate-300 font-mono">
                    <span className={`h-2 w-2 rounded-full shadow-md ${dotColor}`} />
                    <StreamIcon className="h-3.5 w-3.5 text-slate-500" />
                    <span>{stream.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
export default Header;
