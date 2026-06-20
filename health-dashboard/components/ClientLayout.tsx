"use client";

import React, { useState, useEffect } from "react";
import SettingsModal from "./SettingsModal";
import ToastContainer from "./ToastContainer";
import { useDashboardStore } from "@/lib/store";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { dataMode, setLiveData, setLastSync, theme, isSettingsOpen, setIsSettingsOpen } = useDashboardStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (dataMode !== "live") return;

    const autoRefresh = async () => {
      try {
        const res = await fetch("/api/live-data");
        if (res.ok) {
          const payload = await res.json();
          setLiveData(payload);
          setLastSync(new Date().toISOString());
        }
      } catch (err) {
        console.error("[Auto-Refresh] Live data fetch failed:", err);
      }
    };

    // Run auto-refresh every 60 seconds (60000ms)
    const intervalId = setInterval(autoRefresh, 60000);

    return () => clearInterval(intervalId);
  }, [dataMode, setLiveData, setLastSync]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)] text-[var(--text-primary)] bg-radial-glow font-sans">
      <ToastContainer />
      {children}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
export default ClientLayout;
