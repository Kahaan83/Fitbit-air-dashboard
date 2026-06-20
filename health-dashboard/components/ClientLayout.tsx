"use client";

import React, { useState, useEffect } from "react";
import Header from "./Header";
import SettingsModal from "./SettingsModal";
import ToastContainer from "./ToastContainer";
import { useDashboardStore } from "@/lib/store";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { dataMode, setLiveData, setLastSync, theme } = useDashboardStore();

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
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 md:py-8">
        {children}
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
export default ClientLayout;
