"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardStore } from "@/lib/store";
import { Activity, Heart, Moon, Settings as SettingsIcon, Database, RefreshCw } from "lucide-react";

interface HeaderProps {
  onOpenSettings: () => void;
}

export function Header({ onOpenSettings }: HeaderProps) {
  const pathname = usePathname();
  const { dataMode, setDataMode, lastSync, setLiveData, setLastSync, addToast } = useDashboardStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleRefresh = async () => {
    if (dataMode !== "live") return;
    setIsRefreshing(true);
    try {
      const liveRes = await fetch("/api/live-data");
      if (liveRes.ok) {
        const livePayload = await liveRes.json();
        setLiveData(livePayload);
        setLastSync(new Date().toISOString());
      } else {
        addToast("Live data fetch failed.", "error");
      }
    } catch (err) {
      addToast("Backend is offline.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleMode = async () => {
    if (dataMode === "live") {
      setDataMode("sample");
      addToast("Switched to Sample Data Mode.", "info");
    } else {
      setIsToggling(true);
      try {
        const statusRes = await fetch("/api/status");
        if (!statusRes.ok) throw new Error("Backend offline");
        const statusData = await statusRes.json();
        
        if (statusData.token_valid) {
          const liveRes = await fetch("/api/live-data");
          if (!liveRes.ok) throw new Error("Failed to fetch live data");
          const livePayload = await liveRes.json();
          
          setLiveData(livePayload);
          setLastSync(new Date().toISOString());
          setDataMode("live");
          addToast("Connected — Live Data Mode active! Successfully synced physiological measurements.", "success");
        } else {
          addToast("No valid Google OAuth token found. Please click 'Settings' to configure credentials and sign in first.", "error");
        }
      } catch (err) {
        addToast("Cannot connect to Google Health Gateway. Make sure your Python server is running on port 8000.", "error");
      } finally {
        setIsToggling(false);
      }
    }
  };

  // Navigation tabs definition
  const navigation = [
    { name: "Overview", href: "/", icon: Activity },
    { name: "Recovery", href: "/recovery", icon: Heart },
    { name: "Sleep", href: "/sleep", icon: Moon },
    { name: "Raw Metrics", href: "/raw", icon: Database },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-stretch justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-lg shadow-indigo-500/25">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-white text-base tracking-tight">
              Fitbit Air
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex h-full items-stretch gap-1 sm:gap-2">
            {navigation.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`flex items-center gap-1.5 px-3 py-4 text-sm font-medium nav-tab border-b-2 transition-all duration-150 ${
                    isActive
                      ? "border-white text-white"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.name}</span>
                </Link>
              );
            })}

            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-4 text-sm font-medium nav-tab border-b-2 border-transparent text-slate-400 hover:text-white transition-all duration-150"
            >
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </nav>

          {/* Status Badge & Sync Info */}
          <div className="flex items-center gap-3">
            {/* Sync timestamp */}
            <div className="hidden text-right text-xs md:block">
              <span className="text-slate-500">Last Sync:</span>{" "}
              <span className="font-mono text-slate-300">
                {lastSync ? new Date(lastSync).toLocaleTimeString() : "—"}
              </span>
            </div>

            {/* Refresh Button */}
            {dataMode === "live" && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors disabled:opacity-50"
                title="Refresh Data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
              </button>
            )}

            {/* Connection / Toggle Switch */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${dataMode === "live" ? "text-emerald-400" : "text-slate-400"}`}>
                {dataMode === "live" ? "Live" : "Demo"}
              </span>
              <button
                onClick={handleToggleMode}
                disabled={isToggling}
                className={`relative inline-flex h-6 w-16 items-center rounded-full border transition-all duration-300 ${
                  dataMode === "live"
                    ? "bg-emerald-500/20 border-emerald-500/40 cursor-pointer shadow-[0_0_12px_-3px_rgba(16,185,129,0.25)]"
                    : "bg-slate-800 border-slate-700 cursor-pointer"
                } disabled:opacity-50`}
                title="Click to toggle between Mock and Live Google Health API data"
              >
                <span
                  className={`absolute h-4 w-4 rounded-full transition-all duration-300 ${
                    dataMode === "live"
                      ? "right-1 bg-emerald-500"
                      : "left-1 bg-slate-500"
                  } ${isToggling ? "animate-pulse" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
