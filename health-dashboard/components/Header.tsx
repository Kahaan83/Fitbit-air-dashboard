"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardStore } from "@/lib/store";
import { Activity, Heart, Moon, Settings as SettingsIcon, Database, RefreshCw, Palette } from "lucide-react";

interface HeaderProps {
  onOpenSettings: () => void;
}

export function Header({ onOpenSettings }: HeaderProps) {
  const pathname = usePathname();
  const { dataMode, setDataMode, lastSync, setLiveData, setLastSync, addToast, liveData, theme, setTheme } = useDashboardStore();
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
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-soft)] bg-[var(--bg-base)]/70 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-stretch justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-primary)] shadow-lg shadow-[var(--accent-primary)]/20">
              <Activity className="h-5 w-5 text-[var(--bg-base)]" />
            </div>
            <span className="font-semibold text-[var(--text-primary)] text-base tracking-tight">
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
                      ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.name}</span>
                </Link>
              );
            })}

            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-4 text-sm font-medium nav-tab border-b-2 border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-150"
            >
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
              <span className="ml-1 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--border-medium)] text-[var(--accent-primary)] border border-[var(--border-soft)] leading-none select-none">
                {theme === "whoop" ? "Whoop" : "Premium"}
              </span>
            </button>
          </nav>

          {/* Status Badge & Sync Info */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "premium" ? "whoop" : "premium")}
              className="flex items-center justify-center rounded-lg p-2 text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors focus:outline-none"
              title={`Switch to ${theme === "premium" ? "Whoop" : "Premium"} Theme`}
            >
              <Palette className="h-4 w-4" />
            </button>

            {/* Sync timestamp */}
            <div className="hidden text-right text-xs md:block">
              <span className="text-[var(--text-secondary)]">Last Sync:</span>{" "}
              <span className="font-mono text-[var(--text-primary)]">
                {lastSync ? new Date(lastSync).toLocaleTimeString() : "—"}
              </span>
              {dataMode === "live" && liveData?.stale && (
                <div className="text-[10px] text-[var(--accent-amber)] font-medium mt-0.5 animate-pulse">
                  Data may be outdated
                </div>
              )}
            </div>

            {/* Refresh Button */}
            {dataMode === "live" && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center justify-center rounded-lg p-2 text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                title="Refresh Data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-[var(--accent-green)]" : ""}`} />
              </button>
            )}

            {/* Connection / Toggle Switch */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${dataMode === "live" ? "text-[var(--accent-green)]" : "text-[var(--text-secondary)]"}`}>
                {dataMode === "live" ? "Live" : "Demo"}
              </span>
              <button
                onClick={handleToggleMode}
                disabled={isToggling}
                aria-pressed={dataMode === "live"}
                className={`relative inline-flex h-6 w-16 items-center rounded-full border transition-all duration-300 ${
                  dataMode === "live"
                    ? "bg-[var(--accent-green)]/20 border-[var(--accent-green)]/40 cursor-pointer shadow-[0_0_12px_-3px_rgba(34,211,165,0.25)]"
                    : "bg-[var(--bg-surface)] border-[var(--border-medium)] cursor-pointer"
                } disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] focus-visible:outline-none`}
                title="Click to toggle between Mock and Live Google Health API data"
              >
                <span
                  className={`absolute h-4 w-4 rounded-full transition-all duration-300 ${
                    dataMode === "live"
                      ? "right-1 bg-[var(--accent-green)]"
                      : "left-1 bg-[var(--text-secondary)]"
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
